import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';

const use = await loadTemplates(new URL('./Toast.html', import.meta.url));
const ICONS = { success: 'circle-check', error: 'circle-alert', info: 'info', warning: 'triangle-alert' };
const DURATION_MS = 5000;
let region;

function getRegion() {
  if (!region?.isConnected) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  return region;
}

// Shows a translated message for 5 seconds (paused while hovered or focused).
export function toast(key, { type = 'info', params = {}, titleKey = null } = {}) {
  const node = use('toast');
  const ref = refs(node);
  node.classList.add(`toast--${type}`);
  ref.icon.dataset.icon = ICONS[type] ?? ICONS.info;
  ref.message.dataset.i18n = key;
  ref.message.dataset.i18nParams = JSON.stringify(params);
  if (titleKey) {
    ref.title.dataset.i18n = titleKey;
    ref.title.hidden = false;
  }
  hydrate(node);

  let timer = null;
  let left = DURATION_MS;
  let started = 0;
  const dismiss = () => {
    clearTimeout(timer);
    node.dataset.leaving = '';
    setTimeout(() => node.remove(), 250);
  };
  const start = () => {
    started = Date.now();
    timer = setTimeout(dismiss, left);
  };
  const pause = () => {
    clearTimeout(timer);
    left = Math.max(1000, left - (Date.now() - started));
  };
  node.addEventListener('mouseenter', pause);
  node.addEventListener('mouseleave', start);
  node.addEventListener('focusin', pause);
  node.addEventListener('focusout', start);
  ref.close.addEventListener('click', dismiss);

  getRegion().append(node);
  start();
}
