import { LIVE_POLL_MS } from '../core/config.js';
import { matchesRepo } from '../data/index.js';

// Refreshes live scores every 30 s while the tab is visible. Pages re-render on 'data:updated'.
export function startLiveTicker({ interval = LIVE_POLL_MS, poll = () => matchesRepo.pollLive() } = {}) {
  let timer = null;
  const tick = () => {
    if (document.visibilityState === 'visible') poll();
  };
  const start = () => {
    clearInterval(timer);
    timer = setInterval(tick, interval);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tick();
      start();
    } else {
      clearInterval(timer);
    }
  });
  start();
  return () => clearInterval(timer);
}
