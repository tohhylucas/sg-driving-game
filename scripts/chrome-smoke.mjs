import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

async function main() {
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

    const errors = [];
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error' || params.type === 'assert') {
        errors.push(`console.${params.type}: ${formatConsoleArgs(params.args)}`);
      }
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      errors.push(`runtime exception: ${params.exceptionDetails?.text ?? 'unknown error'}`);
    });
    cdp.on('Log.entryAdded', (params) => {
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
    assertSmokeResult(smoke);

    if (errors.length > 0) {
      throw new Error(`Browser smoke test saw page errors:\\n${errors.join('\\n')}`);
    }

    console.log(`Chrome smoke test passed at ${appUrl}`);
    console.log(JSON.stringify(smoke, null, 2));
  } finally {
    cdp?.close();
    await stopChrome(chrome);
    await server.close();

    if (userDataDir) {
      await removeTempDir(userDataDir);
    }
  }
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

function assertSmokeResult(smoke) {
  if (!smoke?.canvasExists) {
    throw new Error('Expected #game-canvas to exist.');
  }

  if (!smoke.overlayExists) {
    throw new Error('Expected #ui-overlay to exist.');
  }

  if (smoke.canvasClientWidth <= 0 || smoke.canvasClientHeight <= 0) {
    throw new Error('Expected #game-canvas to fill visible space.');
  }
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
