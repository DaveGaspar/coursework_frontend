// h() only sets textContent, never innerHTML, so API or user data can't inject markup.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'use', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'title']);
const LATE_PROPS = new Set(['value', 'checked', 'selected', 'indeterminate']);
export const ICON_SPRITE = new URL('../../assets/icons/sprite.svg', import.meta.url).pathname;

function appendChildren(el, children) {
  for (const child of children) {
    if (child == null || child === false || child === true) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, attrs = null, ...children) {
  const isSvg = SVG_TAGS.has(tag);
  const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  const late = [];
  let ref;
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      if (cls) el.setAttribute('class', cls);
    } else if (key === 'text') {
      el.textContent = String(value);
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) if (dv != null) el.dataset[dk] = String(dv);
    } else if (key === 'on') {
      for (const [event, handler] of Object.entries(value)) if (handler) el.addEventListener(event, handler);
    } else if (key === 'ref') {
      ref = value;
    } else if (LATE_PROPS.has(key) && !isSvg) {
      late.push([key, value]);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  appendChildren(el, children);
  for (const [key, value] of late) {
    el[key] = value;
    if (key === 'checked' && value) el.setAttribute('checked', '');
    if (key === 'selected' && value) el.setAttribute('selected', '');
  }
  if (ref) ref(el);
  return el;
}

export function icon(name, { size, className, label } = {}) {
  return h('svg', {
    class: ['icon', size && `icon--${size}`, className],
    'aria-hidden': label ? null : 'true',
    role: label ? 'img' : null,
    'aria-label': label ?? null,
    focusable: 'false',
  }, h('use', { href: `${ICON_SPRITE}#i-${name}` }));
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function render(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
}

export function delegate(root, type, selector, handler) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

let liveRegion;
export function announce(message) {
  if (!liveRegion) {
    liveRegion = h('div', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = message; }, 60);
}

export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function initials(name, max = 2) {
  const words = String(name ?? '').replace(/[^\p{L}\p{N}\s_.-]/gu, '').split(/[\s_.-]+/).filter(Boolean);
  const skip = new Set(['fc', 'cf', 'sc', 'sv', 'vfl', 'vfb', 'tsg', 'afc', 'ac', 'fk', 'sk', '1.', 'de', 'the']);
  const meaningful = words.filter((w) => !skip.has(w.toLowerCase()) && !/^\d+$/.test(w));
  const source = meaningful.length ? meaningful : words;
  return source.slice(0, max).map((w) => w[0]).join('').toUpperCase() || '?';
}
