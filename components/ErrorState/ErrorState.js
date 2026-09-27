import { errorMessageKey } from '../../scripts/core/errors.js';
import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';

const use = await loadTemplates(new URL('./ErrorState.html', import.meta.url));

// Inline error card with a "Try again" button.
export function createErrorState({ error = null, key = null, onRetry = null }) {
  const node = use('error-state');
  const ref = refs(node);
  ref.text.dataset.i18n = key ?? (error ? errorMessageKey(error) : 'errors.loadFailed');
  if (onRetry) ref.retry.addEventListener('click', onRetry);
  else ref.retry.remove();
  return hydrate(node);
}
