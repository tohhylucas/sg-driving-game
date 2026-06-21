import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const WAIT_TIMEOUT_MS = 15_000;
const RECORDING_DURATION_MS = 1_500;
const RECORDING_FRAME_RATE = 10;
const ARTIFACT_DIR = 'artifacts';

async function main() {
  const artifactPrefix = getFlagValue('--artifact-prefix');
  const expectedPhase = getFlagValue('--expected-phase');
  const chromePath = await findChrome();
  const server = await createServer({
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 0
    }
  });

  let chrome;
  let cdp;
  let userDataDir;
  const browserLogEntries = [];
  const errors = [];

  try {
    await server.listen();
    const address = server.httpServer?.address();

    if (!address || typeof address === 'string') {
      throw new Error('Could not resolve Vite dev server address.');
    }

    const appUrl = `http://127.0.0.1:${address.port}/`;
    userDataDir = await mkdtemp(join(tmpdir(), 'sg-driving-game-chrome-'));
    chrome = launchChrome(chromePath, userDataDir);

    const port = await readDevToolsPort(userDataDir);
    const target = await createPageTarget(port, appUrl);
    cdp = await connectCdp(target.webSocketDebuggerUrl);

    cdp.on('Runtime.consoleAPICalled', (params) => {
      browserLogEntries.push(
        `console.${params.type}: ${formatConsoleArgs(params.args)}`
      );

      if (params.type === 'error' || params.type === 'assert') {
        errors.push(`console.${params.type}: ${formatConsoleArgs(params.args)}`);
      }
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      const entry = `runtime exception: ${params.exceptionDetails?.text ?? 'unknown error'}`;
      browserLogEntries.push(entry);
      errors.push(entry);
    });
    cdp.on('Log.entryAdded', (params) => {
      if (params.entry) {
        browserLogEntries.push(
          `browser.${params.entry.level}: ${params.entry.text}`
        );
      }

      if (params.entry?.level === 'error') {
        errors.push(`browser log: ${params.entry.text}`);
      }
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    const loaded = cdp.once('Page.loadEventFired', WAIT_TIMEOUT_MS);
    await cdp.send('Page.navigate', { url: appUrl });
    await loaded;
    await delay(300);

    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector('#game-canvas');
        const overlay = document.querySelector('#ui-overlay');
        return {
          title: document.title,
          canvasExists: canvas instanceof HTMLCanvasElement,
          overlayExists: overlay instanceof HTMLDivElement,
          canvasClientWidth: canvas instanceof HTMLCanvasElement ? canvas.clientWidth : 0,
          canvasClientHeight: canvas instanceof HTMLCanvasElement ? canvas.clientHeight : 0,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          overlayPhase: overlay instanceof HTMLDivElement ? overlay.dataset.phase ?? null : null
        };
      })()`,
      returnByValue: true
    });

    const smoke = result.result?.value;
    assertSmokeResult(smoke, expectedPhase);

    const artifactPaths = await writeArtifacts({
      artifactPrefix,
      appUrl,
      browserLogEntries,
      chromePath,
      cdp,
      errors,
      smoke
    });

    if (errors.length > 0) {
      console.error(`Chrome logs written to ${artifactPaths?.logsPath}`);
      throw new Error(`Browser smoke test saw page errors:\\n${errors.join('\\n')}`);
    }

    console.log(`Chrome smoke test passed at ${appUrl}`);
    console.log(JSON.stringify(smoke, null, 2));
    if (artifactPaths) {
      console.log(`Chrome recording: ${artifactPaths.recordingPath}`);
      console.log(`Chrome logs: ${artifactPaths.logsPath}`);
    }
  } finally {
    cdp?.close();
    await stopChrome(chrome);
    await server.close();

    if (userDataDir) {
      await removeTempDir(userDataDir);
    }
  }
}

function getFlagValue(name) {
  const flagIndex = process.argv.indexOf(name);

  if (flagIndex === -1) {
    return undefined;
  }

  return process.argv[flagIndex + 1];
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Try the next known install location.
    }
  }

  throw new Error(
    'Could not find Chrome. Set CHROME_PATH to the Chrome executable and rerun npm run test:browser.'
  );
}

function launchChrome(chromePath, userDataDir) {
  return spawn(chromePath, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);
}

async function readDevToolsPort(userDataDir) {
  const activePortFile = join(userDataDir, 'DevToolsActivePort');
  const start = Date.now();

  while (Date.now() - start < WAIT_TIMEOUT_MS) {
    try {
      const [port] = (await readFile(activePortFile, 'utf8')).trim().split(/\r?\n/);
      return Number(port);
    } catch {
      await delay(100);
    }
  }

  throw new Error('Chrome did not expose a DevTools port in time.');
}

async function createPageTarget(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' }
  );

  if (!response.ok) {
    throw new Error(`Chrome refused to create a page target: ${response.status}`);
  }

  return response.json();
}

function connectCdp(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);
    const pending = new Map();
    const listeners = new Map();
    let nextId = 1;

    const failOpen = setTimeout(
      () => reject(new Error('Timed out connecting to Chrome DevTools.')),
      WAIT_TIMEOUT_MS
    );

    ws.addEventListener('open', () => {
      clearTimeout(failOpen);
      resolve({
        close: () => ws.close(),
        on: (method, handler) => addListener(listeners, method, handler),
        once: (method, timeoutMs) => once(listeners, method, timeoutMs),
        send: (method, params = {}) => {
          const id = nextId;
          nextId += 1;
          ws.send(JSON.stringify({ id, method, params }));

          return new Promise((resolveSend, rejectSend) => {
            pending.set(id, { reject: rejectSend, resolve: resolveSend });
          });
        }
      });
    });

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);

      if (message.id) {
        const callback = pending.get(message.id);
        pending.delete(message.id);

        if (message.error) {
          callback?.reject(new Error(message.error.message));
        } else {
          callback?.resolve(message.result ?? {});
        }

        return;
      }

      const handlers = listeners.get(message.method) ?? [];
      for (const handler of handlers) {
        handler(message.params ?? {});
      }
    });

    ws.addEventListener('error', () => reject(new Error('Chrome DevTools WebSocket failed.')));
  });
}

function addListener(listeners, method, handler) {
  const handlers = listeners.get(method) ?? [];
  handlers.push(handler);
  listeners.set(method, handlers);

  return () => {
    listeners.set(
      method,
      (listeners.get(method) ?? []).filter((existing) => existing !== handler)
    );
  };
}

function once(listeners, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${method}.`));
    }, timeoutMs);

    const cleanup = addListener(listeners, method, (params) => {
      clearTimeout(timeout);
      cleanup();
      resolve(params);
    });
  });
}

function formatConsoleArgs(args = []) {
  return args.map((arg) => arg.value ?? arg.description ?? arg.type).join(' ');
}

function assertSmokeResult(smoke, expectedPhase) {
  if (!smoke?.canvasExists) {
    throw new Error('Expected #game-canvas to exist.');
  }

  if (!smoke.overlayExists) {
    throw new Error('Expected #ui-overlay to exist.');
  }

  if (smoke.canvasClientWidth <= 0 || smoke.canvasClientHeight <= 0) {
    throw new Error('Expected #game-canvas to fill visible space.');
  }

  if (expectedPhase && smoke.overlayPhase !== expectedPhase) {
    throw new Error(
      `Expected #ui-overlay data-phase to be ${expectedPhase}, got ${smoke.overlayPhase}.`
    );
  }
}

async function writeArtifacts({
  artifactPrefix,
  appUrl,
  browserLogEntries,
  chromePath,
  cdp,
  errors,
  smoke
}) {
  if (!artifactPrefix) {
    return undefined;
  }

  await mkdir(ARTIFACT_DIR, { recursive: true });

  const recordingPath = join(
    ARTIFACT_DIR,
    `${artifactPrefix}-chrome-recording.webm`
  );
  const logsPath = join(ARTIFACT_DIR, `${artifactPrefix}-chrome-logs.txt`);
  const recording = await captureChromeRecording({
    cdp,
    durationMs: RECORDING_DURATION_MS,
    outputPath: recordingPath
  });

  await writeFile(
    logsPath,
    formatArtifactLog({
      appUrl,
      browserLogEntries,
      chromePath,
      errors,
      recording,
      recordingPath,
      smoke
    })
  );

  return {
    logsPath: toArtifactPath(logsPath),
    recordingPath: toArtifactPath(recordingPath)
  };
}

async function captureChromeRecording({ cdp, durationMs, outputPath }) {
  try {
    const recording = await captureCanvasRecording(cdp, durationMs);
    await writeFile(outputPath, recording.buffer);
    return recording;
  } catch (error) {
    return captureScreenshotRecording({ cdp, durationMs, outputPath, error });
  }
}

async function captureCanvasRecording(cdp, durationMs) {
  const result = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(${recordCanvasInPage.toString()})(${durationMs})`
  });
  const value = result.result?.value;

  if (!value?.base64 || value.sizeBytes <= 0) {
    throw new Error('Chrome recording failed: no WebM bytes were produced.');
  }

  return {
    buffer: Buffer.from(value.base64, 'base64'),
    durationMs,
    mimeType: value.mimeType,
    sizeBytes: value.sizeBytes,
    source: value.source
  };
}

async function captureScreenshotRecording({ cdp, durationMs, outputPath, error }) {
  const framesDir = await mkdtemp(join(tmpdir(), 'sg-driving-game-frames-'));
  const frameIntervalMs = 1000 / RECORDING_FRAME_RATE;
  const startedAt = Date.now();
  let frameCount = 0;

  try {
    while (Date.now() - startedAt < durationMs || frameCount === 0) {
      const frameStartedAt = Date.now();
      frameCount += 1;
      const screenshot = await cdp.send('Page.captureScreenshot', {
        captureBeyondViewport: false,
        format: 'png'
      });

      await writeFile(
        join(framesDir, `frame-${String(frameCount).padStart(4, '0')}.png`),
        Buffer.from(screenshot.data, 'base64')
      );

      const remainingFrameMs = frameIntervalMs - (Date.now() - frameStartedAt);

      if (remainingFrameMs > 0) {
        await delay(remainingFrameMs);
      }
    }

    await runFfmpeg([
      '-y',
      '-framerate',
      String(RECORDING_FRAME_RATE),
      '-i',
      join(framesDir, 'frame-%04d.png'),
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      outputPath
    ]);

    const buffer = await readFile(outputPath);

    if (buffer.byteLength <= 0) {
      throw new Error('ffmpeg produced an empty WebM recording.');
    }

    return {
      durationMs,
      frameCount,
      mimeType: 'video/webm',
      sizeBytes: buffer.byteLength,
      source:
        `Chrome DevTools Protocol screenshots encoded with ffmpeg after ` +
        `canvas MediaRecorder fallback: ${error.message}`
    };
  } finally {
    await removeTempDir(framesDir);
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args, {
      windowsHide: true
    });
    let stderr = '';

    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    process.on('error', reject);
    process.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

async function recordCanvasInPage(durationMs) {
  const canvas = document.querySelector('#game-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Expected #game-canvas to be a canvas.');
  }

  if (!canvas.captureStream) {
    throw new Error('Canvas captureStream is unavailable in this Chrome run.');
  }

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is unavailable in this Chrome run.');
  }

  const stream = canvas.captureStream(30);
  const preferredMimeType = 'video/webm;codecs=vp9';
  const mimeType = MediaRecorder.isTypeSupported(preferredMimeType)
    ? preferredMimeType
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];

  await new Promise((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener('error', () => {
      reject(new Error('MediaRecorder failed while capturing the canvas.'));
    });
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.start(100);
    window.setTimeout(() => recorder.stop(), durationMs);
  });

  for (const track of stream.getTracks()) {
    track.stop();
  }

  const blob = new Blob(chunks, { type: mimeType });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return {
    base64: btoa(binary),
    mimeType,
    sizeBytes: bytes.byteLength,
    source: 'Chrome canvas.captureStream() recorded with MediaRecorder'
  };
}

function formatArtifactLog({
  appUrl,
  browserLogEntries,
  chromePath,
  errors,
  recording,
  recordingPath,
  smoke
}) {
  return [
    'Chrome verification',
    `Timestamp: ${new Date().toISOString()}`,
    `Chrome path: ${chromePath}`,
    `App URL: ${appUrl}`,
    `Recording: ${toArtifactPath(recordingPath)}`,
    `Recording source: ${recording.source}`,
    `Recording duration ms: ${recording.durationMs}`,
    `Recording frames: ${recording.frameCount ?? 'not reported'}`,
    `Recording MIME type: ${recording.mimeType}`,
    `Recording bytes: ${recording.sizeBytes}`,
    '',
    'Smoke result:',
    JSON.stringify(smoke, null, 2),
    '',
    'Browser log entries:',
    browserLogEntries.length > 0 ? browserLogEntries.join('\n') : 'none',
    '',
    `Console/runtime error result: ${errors.length > 0 ? errors.join('\n') : 'none'}`,
    ''
  ].join('\n');
}

function toArtifactPath(path) {
  return path.replaceAll('\\', '/');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopChrome(chrome) {
  if (!chrome || chrome.exitCode !== null) {
    return;
  }

  const exited = new Promise((resolve) => {
    chrome.once('exit', resolve);
  });

  chrome.kill();
  await Promise.race([exited, delay(5_000)]);
}

async function removeTempDir(path) {
  let lastError;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(path, { force: true, recursive: true });
      return;
    } catch (error) {
      lastError = error;
      await delay(300);
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
