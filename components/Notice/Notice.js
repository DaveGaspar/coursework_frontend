import { on } from '../../scripts/core/events.js';
import { loadTemplates } from '../../scripts/core/template.js';

const use = await loadTemplates(new URL('./Notice.html', import.meta.url));

// Shows "Showing saved data" under the header the first time cached data is served instead of fresh data.
export function initStaleNotice() {
  let shown = false;
  on('data:stale', () => {
    if (shown) return;
    shown = true;
    const header = document.getElementById('site-header');
    header?.after(use('stale-notice'));
  });
}
