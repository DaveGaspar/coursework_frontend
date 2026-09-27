import { loadTemplates } from '../../scripts/core/template.js';
import { getLanguage, onLanguageChange, setLanguage } from '../../scripts/i18n/i18n.js';

const use = await loadTemplates(new URL('./LanguageSwitcher.html', import.meta.url));

// EN / ՀՅ segmented control. Switching re-translates the page in place.
export function createLanguageSwitcher() {
  const node = use('language-switcher');
  const sync = () => {
    for (const button of node.querySelectorAll('[data-lang]')) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === getLanguage()));
    }
  };
  node.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lang]');
    if (button) setLanguage(button.dataset.lang);
  });
  onLanguageChange(sync);
  sync();
  return node;
}
