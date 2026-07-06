import './index.css';
import { Game } from './game/Game';

window.addEventListener('DOMContentLoaded', () => {
  (window as any).game = new Game();
});
