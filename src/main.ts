import { Game } from './core/Game';
import { parseMapData, type MapData } from './world/mapData';
import './styles.css';

declare global {
  interface Window {
    __SG_DRIVING_GAME_DEV__?: {
      readDiagnostics: () => ReturnType<Game['readDiagnostics']>;
    };
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-overlay');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

if (!uiRoot) {
  throw new Error('Missing #ui-overlay element.');
}

const gameCanvas = canvas;
const gameUiRoot = uiRoot;

async function loadPreviewMapData(): Promise<MapData | undefined> {
  const mapDataUrl = new URL(window.location.href).searchParams.get('mapData');

  if (!mapDataUrl) {
    return undefined;
  }

  if (!mapDataUrl.startsWith('/')) {
    throw new Error('mapData must be a root-relative URL.');
  }

  const response = await fetch(mapDataUrl);

  if (!response.ok) {
    throw new Error(`Unable to load mapData from ${mapDataUrl}.`);
  }

  return parseMapData(await response.json());
}

async function startGame(): Promise<void> {
  const game = new Game({
    canvas: gameCanvas,
    previewMapData: await loadPreviewMapData(),
    uiRoot: gameUiRoot
  });

  if (import.meta.env.DEV) {
    window.__SG_DRIVING_GAME_DEV__ = {
      readDiagnostics: () => game.readDiagnostics()
    };
  }

  game.start();
}

void startGame();
