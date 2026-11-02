import { h } from '../../scripts/core/dom.js';
import { fallBackToStock, stockPhoto } from '../../scripts/core/stock-photos.js';
import { matchesRepo } from '../../scripts/data/index.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';

function caption(credit) {
  const line = h('figcaption', { class: 'credit' },
    h('span', { 'data-i18n': 'home.why.photo' }), ' ',
    credit?.url ? h('a', { href: credit.url }, credit.label) : credit?.label);
  applyTranslations(line);
  return line;
}

// Real stadium photo for the "Why Sports Live" panel, taken from one of the featured matches,
// or a bundled stadium photo when there is none or it does not load.
export async function renderWhyPhoto(figure, matches) {
  const withVenue = matches.filter((m) => m.venue);
  let match = withVenue.find((m) => m.venue_image_url);
  if (!match && withVenue.length) match = await matchesRepo.get(withVenue[0].id).catch(() => null);
  const seed = match?.id ?? matches[0]?.id ?? 0;
  const remote = match?.venue_image_url ?? null;
  const src = remote ?? stockPhoto(seed).src;
  if (figure.dataset.photo === src) return;

  figure.dataset.photo = src;
  const img = h('img', {
    class: 'why__photo',
    src,
    width: 640,
    height: 480,
    loading: 'lazy',
    decoding: 'async',
    'data-i18n-attr': remote ? 'alt:home.why.photoAlt' : 'alt:home.why.stockAlt',
    'data-i18n-params': remote ? JSON.stringify({ venue: match.venue, team: match.home_team.name }) : null,
  });
  if (remote) {
    fallBackToStock(img, seed, (credit) => {
      img.setAttribute('data-i18n-attr', 'alt:home.why.stockAlt');
      applyTranslations(figure);
      figure.querySelector('figcaption')?.replaceWith(caption(credit));
    });
  }
  figure.replaceChildren(img, caption(remote ? match.venue_image_credit : stockPhoto(seed).credit));
  figure.removeAttribute('aria-busy');
  applyTranslations(figure);
}
