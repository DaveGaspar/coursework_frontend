import { h } from '../../scripts/core/dom.js';

// Loading placeholders in the shape of the content. Variants are in Skeleton.css.
export function skeleton(variant, count = 1) {
  return Array.from({ length: count }, () => h('span', { class: `skeleton skeleton--${variant}`, 'aria-hidden': 'true' }));
}

// Marks a container as loading and fills it with skeletons.
export function showSkeleton(container, variant, count = 1) {
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(...skeleton(variant, count));
}

export function doneLoading(container) {
  container.removeAttribute('aria-busy');
}
