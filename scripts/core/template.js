import { applyTranslations } from '../i18n/i18n.js';
import { ICON_SPRITE } from './dom.js';
import { ROUTES } from './url.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const files = new Map();

// Loads a component's .html file once and returns a function that clones one of its <template>s by id.
export async function loadTemplates(url) {
  const key = String(url);
  if (!files.has(key)) {
    files.set(key, fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => new DOMParser().parseFromString(html, 'text/html')));
  }
  const doc = await files.get(key);
  return (id) => {
    const template = doc.getElementById(id);
    if (!template) throw new Error(`Template "${id}" is missing in ${key}`);
    return hydrate(document.importNode(template.content, true).firstElementChild);
  };
}

// Elements marked with data-ref="name", collected into an object.
export function refs(root) {
  const out = {};
  for (const el of [root, ...root.querySelectorAll('[data-ref]')]) {
    if (el.dataset?.ref) out[el.dataset.ref] = el;
  }
  return out;
}

// Translates the markup, fills <svg data-icon="name"> icons and sets href on <a data-route="page">.
export function hydrate(root) {
  const all = (selector) => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  for (const svg of all('svg[data-icon]')) {
    let use = svg.querySelector('use');
    if (!use) {
      use = document.createElementNS(SVG_NS, 'use');
      svg.append(use);
    }
    use.setAttribute('href', `${ICON_SPRITE}#i-${svg.dataset.icon}`);
    if (!svg.hasAttribute('aria-label')) svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (!svg.classList.contains('brand__mark')) svg.classList.add('icon');
  }
  for (const link of all('a[data-route]')) {
    if (ROUTES[link.dataset.route]) link.setAttribute('href', ROUTES[link.dataset.route]);
  }
  applyTranslations(root);
  return root;
}
