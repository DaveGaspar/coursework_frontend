import { h, icon } from '../../scripts/core/dom.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';

// Round "back to top" button that appears after scrolling one screen down.
// Smooth scrolling comes from the CSS (turned off for reduced motion).
export function mountScrollTop() {
  const button = h('button', { class: 'scroll-top', type: 'button', 'data-i18n-attr': 'aria-label:common.backToTop' }, icon('arrow-up'));
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  });
  const sync = () => button.classList.toggle('scroll-top--visible', window.scrollY > window.innerHeight);
  window.addEventListener('scroll', sync, { passive: true });
  applyTranslations(button);
  document.body.append(button);
  sync();
}
