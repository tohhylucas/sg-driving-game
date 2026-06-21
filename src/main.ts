import { Game } from './core/Game';
import './styles.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-overlay');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

if (!uiRoot) {
  throw new Error('Missing #ui-overlay element.');
}

const game = new Game({ canvas, uiRoot });
game.start();
