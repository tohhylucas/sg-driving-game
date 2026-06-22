import { spawn } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
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
const M4_RECORDING_DURATION_MS = 4_500;
const M5_RECORDING_DURATION_MS = 35_000;
const RECORDING_FRAME_RATE = 10;
const ARTIFACT_DIR = 'artifacts';
const M5_DRIVER_INTERVAL_MS = 100;
const M5_CHECKPOINT_RADIUS_M = 7;
const M5_STEER_DEADBAND_RAD = 0.14;
const M5_DESIRED_SPEED_MPS = 8.5;
const M5_TURN_SPEED_MPS = 5.5;
const M5_BRAKE_MARGIN_MPS = 1.5;

const M5_ROUTE_CHECKPOINTS = [
  { id: 'cross-junction-first-pass', xM: 0, zM: -14 },
  { id: 'north-loop-bend', xM: 0, zM: -28 },
  { id: 'northwest-loop-bend', xM: -14, zM: -40 },
  { id: 'west-loop-bend', xM: -32, zM: -28 },
  { id: 'west-loop-straight', xM: -32, zM: 28 },
  { id: 'southwest-loop-bend', xM: -14, zM: 40 },
  { id: 'loop-rejoin', xM: 0, zM: 28 },
  { id: 't-junction-main-road-pass', xM: 0, zM: 14 }
];

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
    const target = await createPageTarget(port);
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
          overlayPhase: overlay instanceof HTMLDivElement ? overlay.dataset.phase ?? null : null,
          m4: overlay instanceof HTMLDivElement ? {
            mirrorIds: [...overlay.querySelectorAll('[data-mirror]')].map((element) => element.dataset.mirror),
            steeringWheelExists: overlay.querySelector('[data-instrument="steering-wheel"]') !== null,
            speedometerExists: overlay.querySelector('[data-instrument="speedometer"]') !== null,
            instructorAudioExists: overlay.querySelector('[data-instrument="instructor-audio"]') !== null,
            instructorCaptionExists: overlay.querySelector('[data-instrument="instructor-caption"], .cockpit__caption') !== null,
            instructorAudioText: overlay.querySelector('[data-instrument="instructor-audio"]')?.textContent ?? null,
            overlayText: overlay.innerText
          } : null
        };
      })()`,
      returnByValue: true
    });

    const smoke = result.result?.value;
    assertSmokeResult(smoke, expectedPhase);
    const acceptance =
      expectedPhase === 'm4' ? await runM4AcceptanceSample(cdp) : undefined;

    const artifactPaths = await writeArtifacts({
      acceptance,
      artifactPrefix,
      appUrl,
      browserLogEntries,
      chromePath,
      cdp,
      errors,
      expectedPhase,
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
      await access(candidate);
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
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-sync',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-sandbox',
    '--disable-features=RendererCodeIntegrity',
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    '--use-angle=swiftshader',
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

async function createPageTarget(port) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,
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

          return new Promise((resolveSend, rejectSend) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectSend(new Error(`Timed out waiting for ${method} response.`));
            }, WAIT_TIMEOUT_MS);

            pending.set(id, {
              reject: (error) => {
                clearTimeout(timeout);
                rejectSend(error);
              },
              resolve: (value) => {
                clearTimeout(timeout);
                resolveSend(value);
              }
            });
            ws.send(JSON.stringify({ id, method, params }));
          });
        }
      });
    });

    ws.addEventListener('message', (event) => {
      void parseCdpMessage(event.data)
        .then((message) => {
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
        })
        .catch((error) => {
          for (const callback of pending.values()) {
            callback.reject(error);
          }
          pending.clear();
        });
    });

    ws.addEventListener('close', (event) => {
      const error = new Error(
        `Chrome DevTools WebSocket closed: ${event.code} ${event.reason}`
      );
      for (const callback of pending.values()) {
        callback.reject(error);
      }
      pending.clear();
    });
    ws.addEventListener('error', () =>
      reject(new Error('Chrome DevTools WebSocket failed.'))
    );
  });
}

async function parseCdpMessage(data) {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }

  if (data instanceof ArrayBuffer) {
    return JSON.parse(Buffer.from(data).toString('utf8'));
  }

  if (ArrayBuffer.isView(data)) {
    return JSON.parse(
      Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
    );
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return JSON.parse(await data.text());
  }

  return JSON.parse(String(data));
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

  if (expectedPhase === 'm4' || expectedPhase === 'm5') {
    assertM4SmokeResult(smoke.m4);
  }
}

function assertM4SmokeResult(m4) {
  const mirrorIds = new Set(m4?.mirrorIds ?? []);

  for (const mirrorId of ['rearview', 'leftSide', 'rightSide']) {
    if (!mirrorIds.has(mirrorId)) {
      throw new Error(`Expected M4 mirror frame ${mirrorId} to exist.`);
    }
  }

  if (!m4?.steeringWheelExists) {
    throw new Error('Expected M4 steering wheel to exist.');
  }

  if (!m4?.speedometerExists) {
    throw new Error('Expected M4 speedometer to exist.');
  }

  if (!m4?.instructorAudioExists) {
    throw new Error('Expected M4 instructor audio placeholder to exist.');
  }

  if (m4.instructorCaptionExists) {
    throw new Error('Expected no instructor caption placeholder in M4.');
  }

  if ((m4.instructorAudioText ?? '').trim() !== '') {
    throw new Error('Expected instructor audio placeholder to contain no text.');
  }
}

function getRecordingDurationMs(expectedPhase) {
  if (expectedPhase === 'm4') {
    return M4_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm5') {
    return M5_RECORDING_DURATION_MS;
  }

  return RECORDING_DURATION_MS;
}

async function runM4AcceptanceSample(cdp) {
  const initial = await readM4HudState(cdp);

  await dispatchKey(cdp, 'keyDown', 'ArrowUp', 'ArrowUp', 38);
  await delay(650);

  const moving = await readM4HudState(cdp);

  await dispatchKey(cdp, 'keyDown', 'ArrowLeft', 'ArrowLeft', 37);
  await delay(450);

  const steering = await readM4HudState(cdp);

  await dispatchKey(cdp, 'keyUp', 'ArrowLeft', 'ArrowLeft', 37);
  await dispatchKey(cdp, 'keyUp', 'ArrowUp', 'ArrowUp', 38);

  if (!(moving.speedKmh > initial.speedKmh)) {
    throw new Error(
      `Expected speedometer to increase during M4 sample; before ${initial.speedKmh}, after ${moving.speedKmh}.`
    );
  }

  if (!(steering.steer > initial.steer)) {
    throw new Error(
      `Expected steering wheel data to change during M4 sample; before ${initial.steer}, after ${steering.steer}.`
    );
  }

  return {
    initial,
    moving,
    steering
  };
}

async function readM4HudState(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const speedometer = document.querySelector('[data-instrument="speedometer"]');
      const wheel = document.querySelector('[data-instrument="steering-wheel"]');
      const overlay = document.querySelector('#ui-overlay');
      return {
        speedKmh: Number(speedometer?.dataset.speedKmh ?? 0),
        steer: Number(wheel?.dataset.steer ?? 0),
        mirrorCount: overlay?.querySelectorAll('[data-mirror]').length ?? 0,
        instructorAudioText: overlay?.querySelector('[data-instrument="instructor-audio"]')?.textContent ?? ''
      };
    })()`
  });

  return result.result?.value;
}

async function runM4DrivingScenario(cdp) {
  await delay(350);
  await dispatchKey(cdp, 'keyDown', 'ArrowUp', 'ArrowUp', 38);
  await delay(850);
  await dispatchKey(cdp, 'keyDown', 'ArrowLeft', 'ArrowLeft', 37);
  await delay(950);
  await dispatchKey(cdp, 'keyUp', 'ArrowLeft', 'ArrowLeft', 37);
  await dispatchKey(cdp, 'keyDown', 'ArrowRight', 'ArrowRight', 39);
  await delay(950);
  await dispatchKey(cdp, 'keyUp', 'ArrowRight', 'ArrowRight', 39);
  await delay(550);
  await dispatchKey(cdp, 'keyUp', 'ArrowUp', 'ArrowUp', 38);
}

async function runM5DrivingScenario(cdp, maxDurationMs) {
  const startedAt = Date.now();
  const keyState = new Map();
  const checkpointStates = M5_ROUTE_CHECKPOINTS.map((checkpoint) => ({
    ...checkpoint,
    minDistanceM: Number.POSITIVE_INFINITY,
    reached: false,
    reachedAtMs: null
  }));
  const samples = [];
  let targetIndex = 0;

  try {
    while (
      Date.now() - startedAt < maxDurationMs &&
      targetIndex < checkpointStates.length
    ) {
      const diagnostics = await readM5Diagnostics(cdp);
      const car = diagnostics.car;
      const target = checkpointStates[targetIndex];
      const distanceM = getDistanceM(car.position, target);
      target.minDistanceM = Math.min(target.minDistanceM, distanceM);

      if (distanceM <= M5_CHECKPOINT_RADIUS_M) {
        target.reached = true;
        target.reachedAtMs = Date.now() - startedAt;
        targetIndex += 1;
      }

      const activeTarget =
        checkpointStates[Math.min(targetIndex, checkpointStates.length - 1)];
      const headingErrorRad = getHeadingErrorRad(car, activeTarget);
      const desiredSpeedMps =
        Math.abs(headingErrorRad) > 0.65
          ? M5_TURN_SPEED_MPS
          : M5_DESIRED_SPEED_MPS;
      const shouldBrake =
        car.speedMps > desiredSpeedMps + M5_BRAKE_MARGIN_MPS;
      const shouldThrottle = !shouldBrake && car.speedMps < desiredSpeedMps;

      await setM5Key(cdp, keyState, 'ArrowUp', shouldThrottle);
      await setM5Key(cdp, keyState, 'ArrowDown', shouldBrake);
      await setM5Key(
        cdp,
        keyState,
        'ArrowLeft',
        headingErrorRad > M5_STEER_DEADBAND_RAD
      );
      await setM5Key(
        cdp,
        keyState,
        'ArrowRight',
        headingErrorRad < -M5_STEER_DEADBAND_RAD
      );

      if (samples.length < 20) {
        samples.push({
          atMs: Date.now() - startedAt,
          checkpointId: activeTarget.id,
          distanceM: Number(distanceM.toFixed(2)),
          headingErrorRad: Number(headingErrorRad.toFixed(3)),
          speedMps: Number(car.speedMps.toFixed(2)),
          xM: Number(car.position.x.toFixed(2)),
          zM: Number(car.position.z.toFixed(2))
        });
      }

      await delay(M5_DRIVER_INTERVAL_MS);
    }
  } finally {
    await releaseM5DrivingKeys(cdp, keyState);
  }

  return {
    completed: checkpointStates.every((checkpoint) => checkpoint.reached),
    durationMs: Date.now() - startedAt,
    checkpointRadiusM: M5_CHECKPOINT_RADIUS_M,
    checkpoints: checkpointStates.map((checkpoint) => ({
      id: checkpoint.id,
      reached: checkpoint.reached,
      reachedAtMs: checkpoint.reachedAtMs,
      minDistanceM: Number(checkpoint.minDistanceM.toFixed(2))
    })),
    samples
  };
}

async function readM5Diagnostics(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const api = window.__SG_DRIVING_GAME_DEV__;
      if (!api) {
        return { available: false };
      }

      return { available: true, ...api.readDiagnostics() };
    })()`
  });
  const value = result.result?.value;

  if (!value?.available) {
    throw new Error('M5 browser acceptance requires dev diagnostics.');
  }

  return value;
}

async function setM5Key(cdp, keyState, code, shouldBeDown) {
  if (keyState.get(code) === shouldBeDown) {
    return;
  }

  keyState.set(code, shouldBeDown);
  await dispatchKey(
    cdp,
    shouldBeDown ? 'keyDown' : 'keyUp',
    code,
    code,
    getArrowKeyCode(code)
  );
}

async function releaseM5DrivingKeys(cdp, keyState) {
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    if (keyState.get(code)) {
      await dispatchKey(cdp, 'keyUp', code, code, getArrowKeyCode(code));
      keyState.set(code, false);
    }
  }
}

function getArrowKeyCode(code) {
  switch (code) {
    case 'ArrowDown':
      return 40;
    case 'ArrowLeft':
      return 37;
    case 'ArrowRight':
      return 39;
    case 'ArrowUp':
      return 38;
    default:
      throw new Error(`Unsupported M5 driving key: ${code}`);
  }
}

function getDistanceM(position, point) {
  return Math.hypot(position.x - point.xM, position.z - point.zM);
}

function getHeadingErrorRad(car, point) {
  const desiredHeadingRad = Math.atan2(
    -(point.xM - car.position.x),
    -(point.zM - car.position.z)
  );

  return wrapAngleRad(desiredHeadingRad - car.headingRad);
}

function wrapAngleRad(angleRad) {
  let wrapped = angleRad;

  while (wrapped <= -Math.PI) {
    wrapped += Math.PI * 2;
  }

  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2;
  }

  return wrapped;
}

async function dispatchKey(cdp, type, code, key, windowsVirtualKeyCode) {
  await cdp.send('Input.dispatchKeyEvent', {
    code,
    key,
    type,
    windowsVirtualKeyCode
  });
}

async function writeArtifacts({
  acceptance,
  artifactPrefix,
  appUrl,
  browserLogEntries,
  chromePath,
  cdp,
  errors,
  expectedPhase,
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
    durationMs: getRecordingDurationMs(expectedPhase),
    expectedPhase,
    outputPath: recordingPath
  });

  if (expectedPhase === 'm5' && !recording.acceptance?.completed) {
    errors.push('M5 acceptance drive did not reach every route checkpoint.');
  }

  await writeFile(
    logsPath,
    formatArtifactLog({
      appUrl,
      browserLogEntries,
      chromePath,
      errors,
      acceptance,
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

async function captureChromeRecording({
  cdp,
  durationMs,
  expectedPhase,
  outputPath
}) {
  if (expectedPhase === 'm4') {
    return captureM4PageRecording({ cdp, durationMs, outputPath });
  }

  if (expectedPhase === 'm5') {
    return captureM5DrivingRecording({ cdp, durationMs, outputPath });
  }

  try {
    const recording = await captureCanvasRecording(cdp, durationMs);
    await writeFile(outputPath, recording.buffer);
    return recording;
  } catch (error) {
    return captureScreenshotRecording({ cdp, durationMs, outputPath, error });
  }
}

async function captureM5DrivingRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM5DrivingScenario(cdp, durationMs - 1_000);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M5 records full page while driving the fixed test track.'),
    outputPath
  });
  const acceptance = await scenario;

  return {
    ...recording,
    acceptance,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while dispatching M5 driving input'
  };
}

async function captureM4PageRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM4DrivingScenario(cdp);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M4 records full page so DOM cockpit instruments are visible.'),
    outputPath
  });

  await scenario;

  return {
    ...recording,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while dispatching M4 driving input'
  };
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
  acceptance,
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
    `Chrome: ${chromePath ? 'detected' : 'not detected'}`,
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
    'M4 acceptance sample:',
    acceptance ? JSON.stringify(acceptance, null, 2) : 'not run',
    '',
    'M5 acceptance drive:',
    recording.acceptance
      ? JSON.stringify(recording.acceptance, null, 2)
      : 'not run',
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
