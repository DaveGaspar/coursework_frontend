import { h, icon } from '../../scripts/core/dom.js';
import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';
import { assetUrl } from '../../scripts/core/url.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';
import { createBadge } from '../Badge/Badge.js';

const use = await loadTemplates(new URL('./SavedCard.html', import.meta.url));
const BRANDS = ['visa', 'mastercard', 'amex'];

// Brand logo, or a generic card icon for unknown brands.
export function brandMark(brand) {
  if (!BRANDS.includes(brand)) return icon('credit-card', { label: null });
  const img = h('img', {
    src: assetUrl(`assets/img/card-brands/${brand}.svg`),
    width: 44,
    height: 30,
    'data-i18n-attr': `alt:cards.brands.${brand}`,
  });
  applyTranslations(img);
  return img;
}

function fill(node, card) {
  const ref = refs(node);
  ref.brand.append(brandMark(card.brand));
  ref.number.dataset.i18n = 'cards.endingIn';
  ref.number.dataset.i18nParams = JSON.stringify({ last4: card.card_last_four });
  ref.meta.dataset.i18n = 'cards.meta';
  ref.meta.dataset.i18nParams = JSON.stringify({ expiry: card.expiry_date, name: card.cardholder_name });
  if (card.is_default) ref.actions.append(createBadge({ kind: 'default', key: 'cards.default' }));
  return ref;
}

// Selectable card for the checkout radio list.
export function createSavedCardOption(card, { name, checked = false }) {
  const node = use('saved-card');
  const ref = fill(node, card);
  Object.assign(ref.radio, { name, value: String(card.id), checked });
  return hydrate(node);
}

// Card in My account, with its own action buttons.
export function createSavedCardItem(card, actions = []) {
  const node = use('saved-card-item');
  fill(node, card).actions.append(...actions);
  return hydrate(node);
}

export function createNewCardOption({ name, checked = false }) {
  const node = use('new-card-option');
  Object.assign(refs(node).radio, { name, checked });
  return node;
}
