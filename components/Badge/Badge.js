import { h, icon } from '../../scripts/core/dom.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';

// A pill badge. Pass a translation `key` (with `params`) or plain `text` for data such as a league name.
export function createBadge({ kind = 'meta', key = null, params = {}, text = null, iconName = null }) {
  const label = key
    ? h('span', { dataset: { i18n: key, i18nParams: JSON.stringify(params) } })
    : h('span', { text });
  const badge = h('span', { class: `badge badge--${kind}` }, iconName && icon(iconName), label);
  applyTranslations(badge);
  return badge;
}

export function createStatusBadge(status) {
  return createBadge({ kind: status, key: `status.${status}` });
}
