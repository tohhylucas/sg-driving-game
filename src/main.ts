import { Game } from './core/Game';
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

const game = new Game({ canvas, uiRoot });

if (import.meta.env.DEV) {
  window.__SG_DRIVING_GAME_DEV__ = {
    readDiagnostics: () => game.readDiagnostics()
  };
}

game.start();
