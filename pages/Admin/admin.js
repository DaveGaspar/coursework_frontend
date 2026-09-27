import { h, icon } from '../../scripts/core/dom.js';
import { applyTranslations, t } from '../../scripts/i18n/i18n.js';

// A labelled form field for admin dialogs. Pass `options` ([{ value, text | labelKey }]) for a select.
export function field({ name, labelKey, type = 'text', value = null, options = null, full = false, attrs = {} }) {
  const id = `admin-${name}`;
  let control;
  if (options) {
    control = h('div', { class: 'field__control' },
      h('select', { class: 'select', id, name, ...attrs },
        options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value ?? ''), 'data-i18n': o.labelKey ?? null }, o.text ?? ''))),
      icon('chevron-down', { className: 'field__chevron' }));
  } else {
    control = h('input', { class: ['input', type === 'number' && 'input--num'], id, name, type, value: value ?? '', ...attrs });
  }
  const node = h('div', { class: ['field', full && 'field--full'] }, h('label', { class: 'field__label', for: id, 'data-i18n': labelKey }), control);
  applyTranslations(node);
  return node;
}

export const formValues = (form) => Object.fromEntries(new FormData(form));

// Table cell with the column name, shown as a label when the table stacks on phones.
export function cell(labelKey, content, className = null) {
  return h('td', { class: className, 'data-label': t(labelKey) }, content);
}

export function headerCell(labelKey, className = null) {
  return h('th', { scope: 'col', class: className, 'data-i18n': labelKey });
}

export function iconButton(iconName, labelKey, params, onClick, { danger = false } = {}) {
  return h('button', {
    class: ['btn btn--icon btn--sm', danger ? 'btn--danger-ghost' : 'btn--ghost'],
    type: 'button',
    'data-i18n-attr': `aria-label:${labelKey}`,
    'data-i18n-params': JSON.stringify(params),
    on: { click: onClick },
  }, icon(iconName));
}
