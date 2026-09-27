import { h } from '../../scripts/core/dom.js';
import { matchesRepo } from '../../scripts/data/index.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';

// Real stadium photo for the "Why Sports Live" panel, taken from one of the featured matches.
export async function renderWhyPhoto(figure, matches) {
  const withVenue = matches.filter((m) => m.venue);
  let match = withVenue.find((m) => m.venue_image_url);
  if (!match && withVenue.length) match = await matchesRepo.get(withVenue[0].id).catch(() => null);
  if (!match?.venue_image_url || figure.dataset.photo === match.venue_image_url) return;

  figure.dataset.photo = match.venue_image_url;
  const img = h('img', {
    class: 'why__photo',
    src: match.venue_image_url,
    width: 640,
    height: 480,
    loading: 'lazy',
    decoding: 'async',
    'data-i18n-attr': 'alt:home.why.photoAlt',
    'data-i18n-params': JSON.stringify({ venue: match.venue, team: match.home_team.name }),
  });
  const credit = match.venue_image_credit;
  const caption = h('figcaption', { class: 'credit' },
    h('span', { 'data-i18n': 'home.why.photo' }), ' ',
    credit?.url ? h('a', { href: credit.url }, credit.label) : credit?.label);
  figure.replaceChildren(img, caption);
  figure.removeAttribute('aria-busy');
  applyTranslations(figure);
}
