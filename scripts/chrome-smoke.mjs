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
const M6_RECORDING_DURATION_MS = 9_000;
const M7_RECORDING_DURATION_MS = 9_000;
const M8_RECORDING_DURATION_MS = 7_000;
const M9_RECORDING_DURATION_MS = 7_000;
const M10_RECORDING_DURATION_MS = 7_000;
const RECORDING_FRAME_RATE = 10;
const ARTIFACT_DIR = 'artifacts';
const M5_DRIVER_INTERVAL_MS = 100;
const M5_CHECKPOINT_RADIUS_M = 7;
const M5_STEER_DEADBAND_RAD = 0.14;
const M5_DESIRED_SPEED_MPS = 8.5;
const M5_TURN_SPEED_MPS = 5.5;
const M5_BRAKE_MARGIN_MPS = 1.5;
const M7_VIOLATION_TIMEOUT_MS = 7_500;
const M7_DRIVER_INTERVAL_MS = 250;

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
          } : null,
          m7: overlay instanceof HTMLDivElement ? {
            keepLeftDebugExists: overlay.querySelector('[data-rule-debug="keep-left"]') !== null,
            keepLeftDebugText: overlay.querySelector('[data-rule-debug="keep-left"]')?.textContent ?? null,
            keepLeftGracePeriodSec: Number(overlay.querySelector('[data-instrument="scoring-feedback"]')?.dataset.keepLeftGracePeriodSec ?? -1),
            keepLeftLaneSide: overlay.querySelector('[data-instrument="scoring-feedback"]')?.dataset.keepLeftLaneSide ?? null,
            keepLeftSessionActive: overlay.querySelector('[data-instrument="scoring-feedback"]')?.dataset.keepLeftSessionActive ?? null,
            scoringFeedbackExists: overlay.querySelector('[data-instrument="scoring-feedback"]') !== null,
            passCount: Number(overlay.querySelector('[data-instrument="scoring-feedback"]')?.dataset.passCount ?? -1),
            violationCount: Number(overlay.querySelector('[data-instrument="scoring-feedback"]')?.dataset.violationCount ?? -1),
            latestOutcome: overlay.querySelector('[data-instrument="scoring-feedback"]')?.dataset.latestOutcome ?? null
          } : null,
          m8: window.__SG_DRIVING_GAME_DEV__ ? {
            stopLineDiagnostics: window.__SG_DRIVING_GAME_DEV__.readDiagnostics().session.ruleDiagnostics.find(
              (entry) => entry.ruleId === 'stop-line'
            ) ?? null
          } : null,
          m9: window.__SG_DRIVING_GAME_DEV__ ? {
            sideHazardDiagnostics: window.__SG_DRIVING_GAME_DEV__.readDiagnostics().session.ruleDiagnostics.find(
              (entry) => entry.ruleId === 'side-hazard'
            ) ?? null
          } : null,
          m10: window.__SG_DRIVING_GAME_DEV__ ? {
            followingDiagnostics: window.__SG_DRIVING_GAME_DEV__.readDiagnostics().session.ruleDiagnostics.find(
              (entry) => entry.ruleId === 'following-time-gap'
            ) ?? null,
            movingElements: window.__SG_DRIVING_GAME_DEV__.readDiagnostics().movingElements
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
  // These reduced-isolation flags are only for this temporary smoke-test Chrome
  // profile. They keep headless WebGL and recording stable on Windows CI/local
  // runners and should not be copied into user-facing browser launches.
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
      const [port] = (await readFile(activePortFile, 'utf8'))
        .trim()
        .split(/\r?\n/);
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

            try {
              ws.send(JSON.stringify({ id, method, params }));
            } catch (error) {
              const callback = pending.get(id);
              pending.delete(id);
              callback?.reject(
                error instanceof Error ? error : new Error(String(error))
              );
            }
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

  if (
    expectedPhase === 'm4' ||
    expectedPhase === 'm5' ||
    expectedPhase === 'm6' ||
    expectedPhase === 'm7' ||
    expectedPhase === 'm8' ||
    expectedPhase === 'm9' ||
    expectedPhase === 'm10'
  ) {
    assertM4SmokeResult(smoke.m4);
  }

  if (
    expectedPhase === 'm7' ||
    expectedPhase === 'm8' ||
    expectedPhase === 'm9' ||
    expectedPhase === 'm10'
  ) {
    assertM7SmokeResult(smoke.m7);
  }

  if (
    expectedPhase === 'm8' ||
    expectedPhase === 'm9' ||
    expectedPhase === 'm10'
  ) {
    assertM8SmokeResult(smoke.m8);
  }

  if (expectedPhase === 'm9' || expectedPhase === 'm10') {
    assertM9SmokeResult(smoke.m9);
  }

  if (expectedPhase === 'm10') {
    assertM10SmokeResult(smoke.m10);
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

function assertM7SmokeResult(m7) {
  if (!m7?.scoringFeedbackExists) {
    throw new Error('Expected M7 scoring feedback surface to exist.');
  }

  if (m7.passCount !== 0 || m7.violationCount !== 0) {
    throw new Error('Expected M7 scoring feedback to start with zero events.');
  }

  if (!m7.keepLeftDebugExists) {
    throw new Error('Expected M7 keep-left debug readout to exist.');
  }

  if (!(m7.keepLeftGracePeriodSec > 0)) {
    throw new Error('Expected M7 keep-left debug to expose grace period.');
  }

  if (!['left', 'right'].includes(m7.keepLeftLaneSide)) {
    throw new Error('Expected M7 keep-left debug to expose lane side.');
  }

  if (m7.keepLeftSessionActive !== 'true') {
    throw new Error('Expected M7 keep-left debug to expose active session state.');
  }
}

function assertM8SmokeResult(m8) {
  const stopLineDiagnostics = m8?.stopLineDiagnostics;

  if (!stopLineDiagnostics) {
    throw new Error('Expected M8 stop-line diagnostics to exist.');
  }

  if (stopLineDiagnostics.activeZoneCount !== 1) {
    throw new Error('Expected M8 to start with one active stop-line rule zone.');
  }

  if (stopLineDiagnostics.pendingZoneCount !== 1) {
    throw new Error('Expected M8 stop-line rule zone to start pending.');
  }

  if (!(stopLineDiagnostics.completeStopMaxSpeedMps > 0)) {
    throw new Error('Expected M8 stop-line complete-stop threshold.');
  }
}

function assertM9SmokeResult(m9) {
  const sideHazardDiagnostics = m9?.sideHazardDiagnostics;

  if (!sideHazardDiagnostics) {
    throw new Error('Expected M9 side-hazard diagnostics to exist.');
  }

  if (sideHazardDiagnostics.activeHazardCount !== 1) {
    throw new Error('Expected M9 to start with one active side hazard.');
  }

  if (sideHazardDiagnostics.pendingHazardCount !== 1) {
    throw new Error('Expected M9 side hazard to start pending.');
  }
}

function assertM10SmokeResult(m10) {
  const followingDiagnostics = m10?.followingDiagnostics;

  if (!followingDiagnostics) {
    throw new Error('Expected M10 following time-gap diagnostics to exist.');
  }

  if (!(followingDiagnostics.safeTimeGapSec > 0)) {
    throw new Error('Expected M10 to expose a safe time-gap threshold.');
  }

  if (!(followingDiagnostics.detectionRangeM > 0)) {
    throw new Error('Expected M10 to expose a forward detection range.');
  }

  if (m10.movingElements?.length !== 1) {
    throw new Error('Expected M10 to start with one tracked moving element.');
  }

  if (m10.movingElements[0]?.kind !== 'lead-vehicle') {
    throw new Error('Expected M10 tracked moving element to be a lead vehicle.');
  }
}

function getRecordingDurationMs(expectedPhase) {
  if (expectedPhase === 'm4') {
    return M4_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm5') {
    return M5_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm6') {
    return M6_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm7') {
    return M7_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm8') {
    return M8_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm9') {
    return M9_RECORDING_DURATION_MS;
  }

  if (expectedPhase === 'm10') {
    return M10_RECORDING_DURATION_MS;
  }

  return RECORDING_DURATION_MS;
}

async function runM4AcceptanceSample(cdp) {
  const initial = await readM4HudState(cdp);

  await dispatchControlKey(cdp, 'keyDown', 'KeyW');
  await delay(650);

  const moving = await readM4HudState(cdp);

  await dispatchControlKey(cdp, 'keyDown', 'ArrowLeft');
  await delay(450);

  const steering = await readM4HudState(cdp);

  await dispatchControlKey(cdp, 'keyUp', 'ArrowLeft');
  await dispatchControlKey(cdp, 'keyUp', 'KeyW');

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
  await dispatchControlKey(cdp, 'keyDown', 'KeyW');
  await delay(850);
  await dispatchControlKey(cdp, 'keyDown', 'ArrowLeft');
  await delay(950);
  await dispatchControlKey(cdp, 'keyUp', 'ArrowLeft');
  await dispatchControlKey(cdp, 'keyDown', 'ArrowRight');
  await delay(950);
  await dispatchControlKey(cdp, 'keyUp', 'ArrowRight');
  await delay(550);
  await dispatchControlKey(cdp, 'keyUp', 'KeyW');
}

async function runM6DrivingScenario(cdp) {
  const sample = {};

  try {
    await delay(350);
    sample.initial = await readM6State(cdp);

    await dispatchControlKey(cdp, 'keyDown', 'KeyW');
    await delay(800);
    sample.accelerated = await readM6State(cdp);

    await dispatchControlKey(cdp, 'keyDown', 'ArrowLeft');
    await delay(450);
    sample.steering = await readM6State(cdp);
    await dispatchControlKey(cdp, 'keyUp', 'ArrowLeft');
    await dispatchControlKey(cdp, 'keyUp', 'KeyW');
    sample.beforeCoast = await readM6State(cdp);

    await delay(900);
    sample.coasted = await readM6State(cdp);

    await dispatchControlKey(cdp, 'keyDown', 'KeyS');
    await delay(900);
    sample.reversed = await readM6State(cdp);
    await dispatchControlKey(cdp, 'keyUp', 'KeyS');

    await delay(200);
    sample.beforeLook = await readM6State(cdp);
    await dispatchControlKey(cdp, 'keyDown', 'KeyA');
    await delay(550);
    sample.leftLook = await readM6State(cdp);
    await dispatchControlKey(cdp, 'keyUp', 'KeyA');
    await delay(700);
    sample.returnedFromLeft = await readM6State(cdp);

    await dispatchControlKey(cdp, 'keyDown', 'KeyD');
    await delay(550);
    sample.rightLook = await readM6State(cdp);
    await dispatchControlKey(cdp, 'keyUp', 'KeyD');
    await delay(700);
    sample.returnedFromRight = await readM6State(cdp);
  } finally {
    await releaseControlKeys(cdp, [
      'KeyW',
      'KeyS',
      'ArrowLeft',
      'ArrowRight',
      'KeyA',
      'KeyD'
    ]);
  }

  assertM6Scenario(sample);
  return sample;
}

async function readM6State(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const api = window.__SG_DRIVING_GAME_DEV__;
      const speedometer = document.querySelector('[data-instrument="speedometer"]');
      const wheel = document.querySelector('[data-instrument="steering-wheel"]');

      if (!api) {
        return { available: false };
      }

      const diagnostics = api.readDiagnostics();
      return {
        available: true,
        speedKmh: Number(speedometer?.dataset.speedKmh ?? 0),
        steer: Number(wheel?.dataset.steer ?? 0),
        carXM: diagnostics.car.position.x,
        carYM: diagnostics.car.position.y,
        carZM: diagnostics.car.position.z,
        speedMps: diagnostics.car.speedMps,
        cameraLookYawRad: diagnostics.camera.blindSpotLookYawRad,
        cameraDirectionXM: diagnostics.camera.direction.x,
        cameraDirectionYM: diagnostics.camera.direction.y,
        cameraDirectionZM: diagnostics.camera.direction.z,
        cameraXM: diagnostics.camera.position.x,
        cameraYM: diagnostics.camera.position.y,
        cameraZM: diagnostics.camera.position.z
      };
    })()`
  });
  const value = result.result?.value;

  if (!value?.available) {
    throw new Error('M6 browser acceptance requires dev diagnostics.');
  }

  return value;
}

function assertM6Scenario(sample) {
  if (!(sample.initial.cameraYM < sample.initial.carYM + 2)) {
    throw new Error('Expected M6 camera to use a low driver-seat height.');
  }

  if (!(sample.initial.cameraZM < sample.initial.carZM)) {
    throw new Error('Expected M6 camera to sit forward in/near the car cabin.');
  }

  if (!(sample.initial.cameraDirectionZM < -0.75)) {
    throw new Error('Expected M6 camera to face forward from the driver seat.');
  }

  if (!(sample.accelerated.speedMps > sample.initial.speedMps)) {
    throw new Error('Expected KeyW to accelerate the car in M6 scenario.');
  }

  if (!(sample.steering.steer > sample.initial.steer)) {
    throw new Error('Expected ArrowLeft to move the steering wheel in M6 scenario.');
  }

  if (!(sample.coasted.speedMps < sample.beforeCoast.speedMps)) {
    throw new Error('Expected releasing KeyW to coast the car toward zero speed.');
  }

  if (!(sample.reversed.speedMps < 0)) {
    throw new Error('Expected holding KeyS to brake and then reverse the car.');
  }

  if (!(sample.leftLook.cameraLookYawRad < sample.beforeLook.cameraLookYawRad)) {
    throw new Error('Expected KeyA to turn the camera left.');
  }

  if (!(sample.leftLook.cameraDirectionXM < sample.beforeLook.cameraDirectionXM)) {
    throw new Error('Expected KeyA to rotate the camera view direction left.');
  }

  if (
    !(
      Math.abs(sample.returnedFromLeft.cameraLookYawRad) <
      Math.abs(sample.leftLook.cameraLookYawRad)
    )
  ) {
    throw new Error('Expected camera to return toward center after releasing KeyA.');
  }

  if (!(sample.rightLook.cameraLookYawRad > sample.returnedFromLeft.cameraLookYawRad)) {
    throw new Error('Expected KeyD to turn the camera right.');
  }

  if (
    !(
      sample.rightLook.cameraDirectionXM >
      sample.returnedFromLeft.cameraDirectionXM
    )
  ) {
    throw new Error('Expected KeyD to rotate the camera view direction right.');
  }

  if (
    !(
      Math.abs(sample.returnedFromRight.cameraLookYawRad) <
      Math.abs(sample.rightLook.cameraLookYawRad)
    )
  ) {
    throw new Error('Expected camera to return toward center after releasing KeyD.');
  }
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

      await setM5Key(cdp, keyState, 'KeyW', shouldThrottle);
      await setM5Key(cdp, keyState, 'KeyS', shouldBrake);
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

async function runM7ViolationResetScenario(cdp) {
  const sample = {
    initial: await readM7State(cdp),
    violation: null,
    afterReset: null
  };
  const startedAt = Date.now();

  try {
    await dispatchControlKey(cdp, 'keyDown', 'KeyW');
    await dispatchControlKey(cdp, 'keyDown', 'ArrowRight');

    while (Date.now() - startedAt < M7_VIOLATION_TIMEOUT_MS) {
      await delay(M7_DRIVER_INTERVAL_MS);
      const state = await readM7State(cdp);

      if (state.violationCount > 0) {
        sample.violation = state;
        break;
      }
    }
  } finally {
    await dispatchControlKey(cdp, 'keyUp', 'ArrowRight');
    await dispatchControlKey(cdp, 'keyUp', 'KeyW');
  }

  if (!sample.violation) {
    throw new Error('Expected M7 drive to emit a keep-left violation.');
  }

  await dispatchControlKey(cdp, 'keyDown', 'KeyR');
  await delay(100);
  await dispatchControlKey(cdp, 'keyUp', 'KeyR');
  await delay(400);
  sample.afterReset = await readM7State(cdp);

  assertM7Scenario(sample);
  return sample;
}

async function runM8StopLineRuleScenario(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const [
        { DrivingSession },
        { StopLineRule },
        { getFixedTestTrackLayout }
      ] = await Promise.all([
        import('/src/rules/DrivingSession.ts'),
        import('/src/rules/StopLineRule.ts'),
        import('/src/world/testTrackLayout.ts')
      ]);
      const layout = getFixedTestTrackLayout();
      const zone = layout.stopLineRuleZones.find(
        (candidate) => candidate.junctionId === 't-junction'
      );
      const segment = layout.segments.find(
        (candidate) => candidate.id === zone?.segmentId
      );
      const api = window.__SG_DRIVING_GAME_DEV__;

      if (!zone || !segment || !api) {
        return { available: false };
      }

      const makeCarState = (signedApproachDistanceM, speedMps) => {
        const localZM =
          zone.stopLineLocalZM +
          signedApproachDistanceM *
            (zone.crossingDirection === -1 ? 1 : -1);

        return {
          position: {
            x: segment.center.xM + localZM * Math.sin(segment.headingRad),
            y: 0.01,
            z: segment.center.zM + localZM * Math.cos(segment.headingRad)
          },
          headingRad: segment.headingRad,
          speedMps
        };
      };
      const runScenario = (sessionId, steps) => {
        const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
        const events = [];

        rule.startSession(sessionId, layout);

        for (let index = 0; index < steps.length; index += 1) {
          const [signedApproachDistanceM, speedMps] = steps[index];
          events.push(
            ...rule.update({
              car: makeCarState(signedApproachDistanceM, speedMps),
              dtSec: 0.1,
              elapsedSec: (index + 1) / 10,
              sessionId,
              track: layout
            })
          );
        }

        return {
          diagnostics: rule.getDiagnostics(),
          events: events.map((event) => ({
            message: event.message,
            outcome: event.outcome,
            ruleId: event.ruleId
          }))
        };
      };
      const runTerminalFailureSession = () => {
        const session = new DrivingSession({
          rules: [new StopLineRule({ completeStopMaxSpeedMps: 0.1 })],
          track: layout
        });

        session.start(makeCarState(3, 0));
        session.update(makeCarState(1, 1), 0.1);
        session.update(makeCarState(-0.2, 1), 0.1);

        return {
          active: session.state.active,
          endReason: session.state.endReason,
          latestMessage: session.summary.events.at(-1)?.message
        };
      };
      const activeDiagnostics = api
        .readDiagnostics()
        .session.ruleDiagnostics.find((entry) => entry.ruleId === 'stop-line');
      const stoppedThenCrossed = runScenario(801, [
        [3, 2],
        [1, 0],
        [-0.2, 1]
      ]);
      const crossedWithoutStop = runScenario(802, [
        [1, 1],
        [-0.2, 1]
      ]);
      const rollingStop = runScenario(803, [
        [1, 0.11],
        [-0.2, 1]
      ]);
      const terminalFailureSession = runTerminalFailureSession();
      const reversedAndRetried = runScenario(804, [
        [1, 1],
        [3, -1],
        [1, 0],
        [-0.2, 1]
      ]);
      const checks = {
        activeAtSessionStart:
          activeDiagnostics?.activeZoneCount === 1 &&
          activeDiagnostics?.pendingZoneCount === 1,
        passAfterCompleteStop:
          stoppedThenCrossed.events.length === 1 &&
          stoppedThenCrossed.events[0].outcome === 'pass',
        retryAfterReverse:
          reversedAndRetried.events.length === 1 &&
          reversedAndRetried.events[0].outcome === 'pass',
        rollingStopViolates:
          rollingStop.events.length === 1 &&
          rollingStop.events[0].outcome === 'violation',
        violationWithoutStop:
          crossedWithoutStop.events.length === 1 &&
          crossedWithoutStop.events[0].outcome === 'violation',
        immediateFailureMessage:
          crossedWithoutStop.events[0]?.message ===
          'IMMEDIATE FAILURE: Stop line crossed without a complete stop',
        terminalFailureEndsSession:
          terminalFailureSession.active === false &&
          terminalFailureSession.endReason === 'failure' &&
          terminalFailureSession.latestMessage ===
            'IMMEDIATE FAILURE: Stop line crossed without a complete stop',
        zoneExposed:
          zone.kind === 'stop-line-rule-zone' &&
          zone.stopLineId === 't-junction-side-road-stop-line'
      };
      const allPassed = Object.values(checks).every(Boolean);
      const panel = document.createElement('div');
      panel.dataset.smokeAcceptance = 'm8-stop-line';
      panel.style.cssText = [
        'position:fixed',
        'left:16px',
        'top:16px',
        'z-index:9999',
        'max-width:520px',
        'padding:12px 14px',
        'border:2px solid #16a34a',
        'background:rgba(15,23,42,0.92)',
        'color:white',
        'font:13px/1.35 system-ui,sans-serif',
        'border-radius:6px'
      ].join(';');
      panel.innerHTML = [
        '<strong>M8 stop-line acceptance</strong>',
        ...Object.entries(checks).map(
          ([name, passed]) => '<div>' + (passed ? 'PASS ' : 'FAIL ') + name + '</div>'
        )
      ].join('');
      document.body.append(panel);

      return {
        available: true,
        activeDiagnostics,
        allPassed,
        checks,
        crossedWithoutStop,
        reversedAndRetried,
        rollingStop,
        stoppedThenCrossed,
        terminalFailureSession,
        zone
      };
    })()`
  });
  const value = result.result?.value;

  if (!value?.available) {
    throw new Error('M8 browser acceptance requires dev diagnostics and rule modules.');
  }

  if (!value.allPassed) {
    throw new Error(
      `M8 stop-line browser acceptance failed: ${JSON.stringify(value.checks)}`
    );
  }

  return value;
}

async function runM9SideHazardScenario(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const [
        { DrivingSession },
        {
          SideHazardRule,
          isCarCollidingWithSideHazard,
          isCarInsideSideHazardTriggerZone
        },
        { getFixedTestTrackLayout }
      ] = await Promise.all([
        import('/src/rules/DrivingSession.ts'),
        import('/src/rules/SideHazardRule.ts'),
        import('/src/world/testTrackLayout.ts')
      ]);
      const layout = getFixedTestTrackLayout();
      const hazard = layout.sideHazards[0];
      const segment = layout.segments.find(
        (candidate) => candidate.id === hazard?.segmentId
      );
      const api = window.__SG_DRIVING_GAME_DEV__;

      if (!hazard || !segment || !api) {
        return { available: false };
      }

      const makeCarState = (localXM, localZM, speedMps) => ({
        position: {
          x:
            segment.center.xM +
            localXM * Math.cos(segment.headingRad) +
            localZM * Math.sin(segment.headingRad),
          y: 0.01,
          z:
            segment.center.zM -
            localXM * Math.sin(segment.headingRad) +
            localZM * Math.cos(segment.headingRad)
        },
        headingRad: segment.headingRad,
        speedMps
      });
      const runScenario = (sessionId, steps) => {
        const rule = new SideHazardRule();
        const events = [];

        rule.startSession(sessionId, layout);

        for (let index = 0; index < steps.length; index += 1) {
          const [localXM, localZM, speedMps] = steps[index];
          events.push(
            ...rule.update({
              car: makeCarState(localXM, localZM, speedMps),
              dtSec: 0.1,
              elapsedSec: (index + 1) / 10,
              sessionId,
              track: layout
            })
          );
        }

        return {
          diagnostics: rule.getDiagnostics(),
          events: events.map((event) => ({
            message: event.message,
            outcome: event.outcome,
            ruleId: event.ruleId
          }))
        };
      };
      const runTerminalFailureSession = () => {
        const session = new DrivingSession({
          rules: [new SideHazardRule()],
          track: layout
        });

        session.start(makeCarState(layout.defaultDrivingLane.centerOffsetM, 0, 0));
        session.update(
          makeCarState(
            hazard.collisionBox.centerLocalXM,
            hazard.collisionBox.centerLocalZM,
            3
          ),
          0.1
        );

        return {
          active: session.state.active,
          endReason: session.state.endReason,
          latestMessage: session.summary.events.at(-1)?.message
        };
      };
      const activeDiagnostics = api
        .readDiagnostics()
        .session.ruleDiagnostics.find((entry) => entry.ruleId === 'side-hazard');
      const leftLaneAtTrigger = makeCarState(
        layout.defaultDrivingLane.centerOffsetM,
        hazard.triggerZone.centerLocalZM,
        3
      );
      const leftLaneAtHazard = makeCarState(
        layout.defaultDrivingLane.centerOffsetM,
        hazard.collisionBox.centerLocalZM,
        3
      );
      const collision = runScenario(901, [
        [
          hazard.collisionBox.centerLocalXM,
          hazard.collisionBox.centerLocalZM,
          3
        ]
      ]);
      const duplicateCollision = runScenario(902, [
        [
          hazard.collisionBox.centerLocalXM,
          hazard.collisionBox.centerLocalZM,
          3
        ],
        [
          hazard.collisionBox.centerLocalXM,
          hazard.collisionBox.centerLocalZM,
          3
        ]
      ]);
      const safeClear = runScenario(903, [
        [
          layout.defaultDrivingLane.centerOffsetM,
          hazard.triggerZone.centerLocalZM,
          3
        ],
        [
          layout.defaultDrivingLane.centerOffsetM,
          hazard.clearanceLocalZM + hazard.clearanceDirection * 0.5,
          3
        ]
      ]);
      const terminalFailureSession = runTerminalFailureSession();
      const checks = {
        activeAtSessionStart:
          activeDiagnostics?.activeHazardCount === 1 &&
          activeDiagnostics?.pendingHazardCount === 1,
        collisionViolates:
          collision.events.length === 1 &&
          collision.events[0].outcome === 'violation',
        immediateFailureMessage:
          collision.events[0]?.message ===
          'IMMEDIATE FAILURE: Side hazard collision',
        terminalFailureEndsSession:
          terminalFailureSession.active === false &&
          terminalFailureSession.endReason === 'failure' &&
          terminalFailureSession.latestMessage ===
            'IMMEDIATE FAILURE: Side hazard collision',
        duplicateIncidentSuppressed:
          duplicateCollision.events.length === 1 &&
          duplicateCollision.diagnostics.violationHazardCount === 1,
        fixedScriptedVisibleHazard:
          layout.sideHazards.length === 1 &&
          hazard.kind === 'side-hazard' &&
          hazard.scenarioType === 'bicycle' &&
          hazard.visible === true,
        noCameraCheckScoring:
          collision.events[0]?.ruleId === 'side-hazard' &&
          !/mirror|blind|camera/i.test(collision.events[0]?.message ?? ''),
        noInvisibleTriggerCollision:
          isCarInsideSideHazardTriggerZone(layout, hazard, leftLaneAtTrigger) &&
          !isCarCollidingWithSideHazard(layout, hazard, leftLaneAtHazard),
        safeClearPasses:
          safeClear.events.length === 1 &&
          safeClear.events[0].outcome === 'pass'
      };
      const allPassed = Object.values(checks).every(Boolean);
      const panel = document.createElement('div');
      panel.dataset.smokeAcceptance = 'm9-side-hazard';
      panel.style.cssText = [
        'position:fixed',
        'left:16px',
        'top:16px',
        'z-index:9999',
        'max-width:560px',
        'padding:12px 14px',
        'border:2px solid #16a34a',
        'background:rgba(15,23,42,0.92)',
        'color:white',
        'font:13px/1.35 system-ui,sans-serif',
        'border-radius:6px'
      ].join(';');
      panel.innerHTML = [
        '<strong>M9 side-hazard acceptance</strong>',
        ...Object.entries(checks).map(
          ([name, passed]) => '<div>' + (passed ? 'PASS ' : 'FAIL ') + name + '</div>'
        )
      ].join('');
      document.body.append(panel);

      return {
        available: true,
        activeDiagnostics,
        allPassed,
        checks,
        collision,
        duplicateCollision,
        hazard,
        safeClear,
        terminalFailureSession
      };
    })()`
  });
  const value = result.result?.value;

  if (!value?.available) {
    throw new Error('M9 browser acceptance requires dev diagnostics and rule modules.');
  }

  if (!value.allPassed) {
    throw new Error(
      `M9 side-hazard browser acceptance failed: ${JSON.stringify(value.checks)}`
    );
  }

  return value;
}

async function runM10FollowingScenario(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const [
        {
          FollowingTimeGapRule,
          computeFollowingTimeGapSec,
          selectNearestForwardMovingElement
        },
        { getScriptedMovingElementStates },
        { getFixedTestTrackLayout }
      ] = await Promise.all([
        import('/src/rules/FollowingTimeGapRule.ts'),
        import('/src/world/scriptedMovingElements.ts'),
        import('/src/world/testTrackLayout.ts')
      ]);
      const layout = getFixedTestTrackLayout();
      const leadVehicle = layout.movingElements[0];
      const segment = layout.segments.find(
        (candidate) => candidate.id === leadVehicle?.segmentId
      );
      const api = window.__SG_DRIVING_GAME_DEV__;

      if (!leadVehicle || !segment || !api) {
        return { available: false };
      }

      const laneXM = layout.defaultDrivingLane.centerOffsetM;
      const makeCarState = (localXM, localZM, speedMps) => ({
        position: {
          x:
            segment.center.xM +
            localXM * Math.cos(segment.headingRad) +
            localZM * Math.sin(segment.headingRad),
          y: 0.01,
          z:
            segment.center.zM -
            localXM * Math.sin(segment.headingRad) +
            localZM * Math.cos(segment.headingRad)
        },
        headingRad: segment.headingRad,
        speedMps
      });
      const makeElement = (id, localXM, localZM, speedMps = leadVehicle.speedMps) => {
        const state = makeCarState(localXM, localZM, speedMps);

        return {
          id,
          kind: 'lead-vehicle',
          segmentId: segment.id,
          position: state.position,
          headingRad: state.headingRad,
          speedMps,
          lengthM: leadVehicle.lengthM,
          widthM: leadVehicle.widthM
        };
      };
      const runRule = (sessionId, config, steps) => {
        const rule = new FollowingTimeGapRule(config);
        const events = [];
        let elapsedSec = 0;

        rule.startSession(sessionId, layout);

        for (const step of steps) {
          elapsedSec += step.dtSec;
          events.push(
            ...rule.update({
              car: makeCarState(step.carLocalXM, step.carLocalZM, step.carSpeedMps),
              dtSec: step.dtSec,
              elapsedSec,
              movingElements: step.elements.map((element) =>
                makeElement(
                  element.id,
                  element.localXM,
                  element.localZM,
                  element.speedMps
                )
              ),
              sessionId,
              track: layout
            })
          );
        }

        return {
          diagnostics: rule.getDiagnostics(),
          events: events.map((event) => ({
            message: event.message,
            outcome: event.outcome,
            ruleId: event.ruleId
          }))
        };
      };
      const liveDiagnostics = api.readDiagnostics();
      const followingDiagnostics = liveDiagnostics.session.ruleDiagnostics.find(
        (entry) => entry.ruleId === 'following-time-gap'
      );
      const scriptedAtStart = getScriptedMovingElementStates(layout, 0)[0];
      const scriptedAfterOneSecond = getScriptedMovingElementStates(layout, 1)[0];
      const car = makeCarState(laneXM, 0, 10);
      const nearest = makeElement('nearest', laneXM, -12);
      const selected = selectNearestForwardMovingElement(layout, car, [
        makeElement('farther', laneXM, -24),
        makeElement('adjacent', -laneXM, -6),
        nearest,
        makeElement('behind', laneXM, 6)
      ]);
      const timeGapSec = computeFollowingTimeGapSec(
        car,
        selected?.forwardDistanceM ?? 0,
        selected?.element ?? nearest
      );
      const safeCompletion = runRule(1001, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 1
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 5,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -24 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 5,
          dtSec: 0.5,
          elements: []
        }
      ]);
      const shortClean = runRule(1002, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 5,
          dtSec: 0.4,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -24 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 5,
          dtSec: 0.1,
          elements: []
        }
      ]);
      const unsafe = runRule(1003, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -10 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -10 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -24 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.1,
          elements: []
        }
      ]);
      const strictThreshold = runRule(1004, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 3,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -27 }]
        }
      ]);
      const lenientThreshold = runRule(1005, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -27 }]
        }
      ]);
      const reentry = runRule(1006, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 0.5,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 5,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -24 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 5,
          dtSec: 0.1,
          elements: []
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -10 }]
        }
      ]);
      const hysteresis = runRule(1007, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 1,
        recoveryHysteresisSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.6,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -22 }]
        },
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 0.5,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -26 }]
        }
      ]);
      const noSideHazardFollowing = runRule(1008, {
        detectionRangeM: 50,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 1,
          elements: []
        }
      ]);
      const outsideRange = runRule(1009, {
        detectionRangeM: 8,
        minimumEncounterDurationSec: 1,
        safeTimeGapSec: 2,
        unsafeGracePeriodSec: 0.5
      }, [
        {
          carLocalXM: laneXM,
          carLocalZM: 0,
          carSpeedMps: 10,
          dtSec: 1,
          elements: [{ id: 'lead', localXM: laneXM, localZM: -20 }]
        }
      ]);
      const checks = {
        activeAtSessionStart:
          followingDiagnostics?.safeTimeGapSec > 0 &&
          followingDiagnostics?.detectionRangeM > 0,
        cleanCompletionPasses:
          safeCompletion.events.length === 1 &&
          safeCompletion.events[0].outcome === 'pass',
        deterministicLeadVehicle:
          layout.movingElements.length === 1 &&
          leadVehicle.kind === 'lead-vehicle' &&
          leadVehicle.tracked === true &&
          scriptedAtStart.id === leadVehicle.id &&
          scriptedAfterOneSecond.position.z !== scriptedAtStart.position.z,
        detectionRangeRequired:
          outsideRange.events.length === 0 &&
          outsideRange.diagnostics.activeEncounterElementId === undefined,
        globalThresholdUsed:
          strictThreshold.events.length === 1 &&
          strictThreshold.events[0].outcome === 'violation' &&
          lenientThreshold.events.length === 0,
        hysteresisMaintainsUnsafeState:
          hysteresis.events.length === 1 &&
          hysteresis.events[0].outcome === 'violation',
        liveGameTracksLeadVehicle:
          liveDiagnostics.movingElements.length === 1 &&
          liveDiagnostics.movingElements[0].kind === 'lead-vehicle',
        nearestCurrentLaneOnly:
          selected?.element.id === 'nearest',
        noContinuousSafePass:
          safeCompletion.events.length === 1,
        noPassAfterViolationAndNoDuplicates:
          unsafe.events.length === 1 &&
          unsafe.events[0].outcome === 'violation' &&
          unsafe.diagnostics.violationEncounterCount === 1,
        sameObjectReentryIsIndependent:
          reentry.events.length === 2 &&
          reentry.events[0].outcome === 'pass' &&
          reentry.events[1].outcome === 'violation',
        sideHazardIgnored:
          layout.sideHazards.length === 1 &&
          noSideHazardFollowing.events.length === 0,
        shortCleanEncounterUnscored:
          shortClean.events.length === 0,
        timeGapFromLiveState:
          Number.isFinite(timeGapSec) &&
          timeGapSec > 0 &&
          selected?.forwardDistanceM > 0,
        unsafeGraceViolates:
          unsafe.events.length === 1 &&
          unsafe.events[0].ruleId === 'following-time-gap'
      };
      const allPassed = Object.values(checks).every(Boolean);
      const panel = document.createElement('div');
      panel.dataset.smokeAcceptance = 'm10-following-time-gap';
      panel.style.cssText = [
        'position:fixed',
        'left:16px',
        'top:16px',
        'z-index:9999',
        'max-width:640px',
        'padding:12px 14px',
        'border:2px solid #16a34a',
        'background:rgba(15,23,42,0.92)',
        'color:white',
        'font:13px/1.35 system-ui,sans-serif',
        'border-radius:6px'
      ].join(';');
      panel.innerHTML = [
        '<strong>M10 following time-gap acceptance</strong>',
        ...Object.entries(checks).map(
          ([name, passed]) => '<div>' + (passed ? 'PASS ' : 'FAIL ') + name + '</div>'
        )
      ].join('');
      document.body.append(panel);

      return {
        available: true,
        allPassed,
        checks,
        cleanCompletion: safeCompletion,
        followingDiagnostics,
        hysteresis,
        reentry,
        unsafe
      };
    })()`
  });
  const value = result.result?.value;

  if (!value?.available) {
    throw new Error('M10 browser acceptance requires dev diagnostics and rule modules.');
  }

  if (!value.allPassed) {
    throw new Error(
      `M10 following time-gap browser acceptance failed: ${JSON.stringify(value.checks)}`
    );
  }

  return value;
}

async function readM7State(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const api = window.__SG_DRIVING_GAME_DEV__;
      const feedback = document.querySelector('[data-instrument="scoring-feedback"]');

      if (!api || !(feedback instanceof HTMLElement)) {
        return { available: false };
      }

      const diagnostics = api.readDiagnostics();
      const keepLeftDiagnostics = diagnostics.session.ruleDiagnostics.find(
        (entry) => entry.ruleId === 'keep-left'
      );
      const keepLeftDebug = feedback.querySelector('[data-rule-debug="keep-left"]');

      return {
        available: true,
        active: diagnostics.session.active,
        diagnosticGracePeriodSec: keepLeftDiagnostics?.gracePeriodSec ?? null,
        diagnosticLaneSide: keepLeftDiagnostics?.laneSide ?? null,
        feedbackGracePeriodSec: Number(feedback.dataset.keepLeftGracePeriodSec ?? -1),
        feedbackLaneSide: feedback.dataset.keepLeftLaneSide ?? null,
        feedbackOutsideLaneSec: Number(feedback.dataset.keepLeftOutsideLaneSec ?? -1),
        feedbackSessionActive: feedback.dataset.keepLeftSessionActive ?? null,
        feedbackWithinDefaultLane: feedback.dataset.keepLeftWithinDefaultLane ?? null,
        keepLeftDebugText: keepLeftDebug?.textContent ?? null,
        latestOutcome: feedback.dataset.latestOutcome ?? '',
        passCount: Number(feedback.dataset.passCount ?? 0),
        sessionId: diagnostics.session.sessionId,
        violationCount: Number(feedback.dataset.violationCount ?? 0),
        xM: diagnostics.car.position.x,
        zM: diagnostics.car.position.z
      };
    })()`
  });
  const value = result.result?.value;

  if (!value?.available) {
    throw new Error('M7 browser acceptance requires dev diagnostics.');
  }

  return value;
}

function assertM7Scenario(sample) {
  assertM7DebugState(sample.initial, 'initial');
  assertM7DebugState(sample.violation, 'violation');
  assertM7DebugState(sample.afterReset, 'after reset');

  if (sample.violation.violationCount !== 1) {
    throw new Error('Expected one M7 keep-left violation in feedback.');
  }

  if (sample.violation.latestOutcome !== 'violation') {
    throw new Error('Expected latest M7 feedback outcome to be violation.');
  }

  if (!(sample.afterReset.sessionId > sample.violation.sessionId)) {
    throw new Error('Expected reset to start a new M7 session.');
  }

  if (
    sample.afterReset.passCount !== 0 ||
    sample.afterReset.violationCount !== 0
  ) {
    throw new Error('Expected reset to clear M7 feedback counts.');
  }

  if (!sample.afterReset.active) {
    throw new Error('Expected reset to leave a new M7 session active.');
  }
}

function assertM7DebugState(state, label) {
  if (!(state.feedbackGracePeriodSec > 0)) {
    throw new Error(`Expected ${label} M7 debug grace period to be visible.`);
  }

  if (state.feedbackGracePeriodSec !== state.diagnosticGracePeriodSec) {
    throw new Error(`Expected ${label} M7 debug grace period to match diagnostics.`);
  }

  if (!['left', 'right'].includes(state.feedbackLaneSide)) {
    throw new Error(`Expected ${label} M7 debug lane side to be visible.`);
  }

  if (state.feedbackLaneSide !== state.diagnosticLaneSide) {
    throw new Error(`Expected ${label} M7 debug lane side to match diagnostics.`);
  }

  if (state.feedbackSessionActive !== String(state.active)) {
    throw new Error(`Expected ${label} M7 debug session state to match diagnostics.`);
  }

  if (!state.keepLeftDebugText?.includes(`Side ${state.feedbackLaneSide}`)) {
    throw new Error(`Expected ${label} M7 debug text to include lane side.`);
  }

  if (!state.keepLeftDebugText?.includes(`Session ${state.active ? 'active' : 'finished'}`)) {
    throw new Error(`Expected ${label} M7 debug text to include session state.`);
  }
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
  await dispatchControlKey(cdp, shouldBeDown ? 'keyDown' : 'keyUp', code);
}

async function releaseM5DrivingKeys(cdp, keyState) {
  for (const code of ['KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight']) {
    if (keyState.get(code)) {
      await dispatchControlKey(cdp, 'keyUp', code);
      keyState.set(code, false);
    }
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

async function dispatchControlKey(cdp, type, code) {
  const { key, windowsVirtualKeyCode } = getControlKeyInfo(code);
  await dispatchKey(cdp, type, code, key, windowsVirtualKeyCode);
}

async function releaseControlKeys(cdp, codes) {
  for (const code of codes) {
    await dispatchControlKey(cdp, 'keyUp', code);
  }
}

function getControlKeyInfo(code) {
  switch (code) {
    case 'ArrowDown':
      return { key: 'ArrowDown', windowsVirtualKeyCode: 40 };
    case 'ArrowLeft':
      return { key: 'ArrowLeft', windowsVirtualKeyCode: 37 };
    case 'ArrowRight':
      return { key: 'ArrowRight', windowsVirtualKeyCode: 39 };
    case 'ArrowUp':
      return { key: 'ArrowUp', windowsVirtualKeyCode: 38 };
    case 'KeyA':
      return { key: 'a', windowsVirtualKeyCode: 65 };
    case 'KeyD':
      return { key: 'd', windowsVirtualKeyCode: 68 };
    case 'KeyR':
      return { key: 'r', windowsVirtualKeyCode: 82 };
    case 'KeyS':
      return { key: 's', windowsVirtualKeyCode: 83 };
    case 'KeyW':
      return { key: 'w', windowsVirtualKeyCode: 87 };
    default:
      throw new Error(`Unsupported browser control key: ${code}`);
  }
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

  if (expectedPhase === 'm8' && !recording.acceptance?.allPassed) {
    errors.push('M8 stop-line acceptance scenario did not pass every check.');
  }

  if (expectedPhase === 'm9' && !recording.acceptance?.allPassed) {
    errors.push('M9 side-hazard acceptance scenario did not pass every check.');
  }

  if (expectedPhase === 'm10' && !recording.acceptance?.allPassed) {
    errors.push('M10 following time-gap acceptance scenario did not pass every check.');
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

  if (expectedPhase === 'm6') {
    return captureM6DrivingRecording({ cdp, durationMs, outputPath });
  }

  if (expectedPhase === 'm7') {
    return captureM7DrivingRecording({ cdp, durationMs, outputPath });
  }

  if (expectedPhase === 'm8') {
    return captureM8StopLineRecording({ cdp, durationMs, outputPath });
  }

  if (expectedPhase === 'm9') {
    return captureM9SideHazardRecording({ cdp, durationMs, outputPath });
  }

  if (expectedPhase === 'm10') {
    return captureM10FollowingRecording({ cdp, durationMs, outputPath });
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

async function captureM6DrivingRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM6DrivingScenario(cdp);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M6 records full page while dispatching control input.'),
    outputPath
  });
  const acceptance = await scenario;

  return {
    ...recording,
    acceptance,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while dispatching M6 controls'
  };
}

async function captureM7DrivingRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM7ViolationResetScenario(cdp);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M7 records full page while driving into a keep-left violation.'),
    outputPath
  });
  const acceptance = await scenario;

  return {
    ...recording,
    acceptance,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while dispatching M7 scoring input'
  };
}

async function captureM8StopLineRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM8StopLineRuleScenario(cdp);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M8 records the stop-line rule acceptance panel and HUD.'),
    outputPath
  });
  const acceptance = await scenario;

  return {
    ...recording,
    acceptance,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while running M8 stop-line rule acceptance'
  };
}

async function captureM9SideHazardRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM9SideHazardScenario(cdp);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M9 records the side-hazard rule acceptance panel and HUD.'),
    outputPath
  });
  const acceptance = await scenario;

  return {
    ...recording,
    acceptance,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while running M9 side-hazard acceptance'
  };
}

async function captureM10FollowingRecording({ cdp, durationMs, outputPath }) {
  const scenario = runM10FollowingScenario(cdp);
  const recording = await captureScreenshotRecording({
    cdp,
    durationMs,
    error: new Error('M10 records the following time-gap acceptance panel and HUD.'),
    outputPath
  });
  const acceptance = await scenario;

  return {
    ...recording,
    acceptance,
    source:
      'Chrome DevTools Protocol full-page screenshots encoded with ffmpeg while running M10 following time-gap acceptance'
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
    'Pre-recording acceptance sample:',
    acceptance ? JSON.stringify(acceptance, null, 2) : 'not run',
    '',
    'Recorded acceptance scenario:',
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

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await rm(path, { force: true, recursive: true });
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
