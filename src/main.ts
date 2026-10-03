import './index.css';
import './neighborhood-theme.css';
import { Game } from './game/Game';

window.addEventListener('DOMContentLoaded', () => {
  (window as any).game = new Game();
  const overview = document.getElementById('neighborhood-overview-panel');
  const toggle = document.getElementById('btn-overview-toggle');
  const compact = window.matchMedia('(max-width: 600px)');
  const setCollapsed = (collapsed: boolean) => {
    if (overview) overview.dataset.collapsed = String(collapsed);
    toggle?.setAttribute('aria-expanded', String(!collapsed));
  };
  setCollapsed(compact.matches);
  compact.addEventListener('change', event => setCollapsed(event.matches));
  toggle?.addEventListener('click', () => setCollapsed(overview?.dataset.collapsed !== 'true'));
});
