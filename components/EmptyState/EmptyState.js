import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';

const use = await loadTemplates(new URL('./EmptyState.html', import.meta.url));

// Icon, title, one line of help and an optional action. Texts are translation keys.
export function createEmptyState({ icon = 'info', titleKey, textKey = null, params = {}, action = null, compact = false }) {
  const node = use('empty-state');
  const ref = refs(node);
  if (compact) node.classList.add('empty-state--compact');
  ref.icon.dataset.icon = icon;
  ref.title.dataset.i18n = titleKey;
  ref.title.dataset.i18nParams = JSON.stringify(params);
  if (textKey) {
    ref.text.dataset.i18n = textKey;
    ref.text.dataset.i18nParams = JSON.stringify(params);
    ref.text.hidden = false;
  }
  if (action) {
    ref.action.append(action);
    ref.action.hidden = false;
  }
  return hydrate(node);
}
