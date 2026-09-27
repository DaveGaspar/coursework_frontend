import { h } from '../../scripts/core/dom.js';
import { createMatchCard } from '../MatchCard/MatchCard.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Horizontal, snap-scrolling row of match posters. Prev/next buttons live in the section header:
// <div class="poster-row__controls" data-row-controls="{container id}"> with [data-dir="prev"] and [data-dir="next"].
export function renderPosterRow(container, matches, { empty = null } = {}) {
  container.removeAttribute('aria-busy');
  const controls = document.querySelector(`[data-row-controls="${container.id}"]`);
  if (!matches.length) {
    container.replaceChildren(...(empty ? [empty] : []));
    if (controls) controls.hidden = true;
    return;
  }
  const track = h('ul', { class: 'poster-row__track', role: 'list' },
    matches.map((match, index) => h('li', null, createMatchCard(match, { lazy: index > 3 }))));
  container.replaceChildren(track);
  if (!controls) return;

  controls.hidden = false;
  const prev = controls.querySelector('[data-dir="prev"]');
  const next = controls.querySelector('[data-dir="next"]');
  const update = () => {
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  };
  const scroll = (direction) => track.scrollBy({
    left: direction * track.clientWidth * 0.8,
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
  });
  prev.onclick = () => scroll(-1);
  next.onclick = () => scroll(1);
  track.addEventListener('scroll', update, { passive: true });
  requestAnimationFrame(update);
}
