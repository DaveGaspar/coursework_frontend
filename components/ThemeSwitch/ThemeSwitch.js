import { loadTemplates } from '../../scripts/core/template.js';
import { getThemePreference, onThemeChange, setThemePreference } from '../../scripts/core/theme.js';

const use = await loadTemplates(new URL('./ThemeSwitch.html', import.meta.url));

// System / Light / Dark segmented control.
export function createThemeSwitch() {
  const node = use('theme-switch');
  const sync = () => {
    for (const button of node.querySelectorAll('[data-theme-option]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeOption === getThemePreference()));
    }
  };
  node.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-option]');
    if (button) setThemePreference(button.dataset.themeOption);
  });
  onThemeChange(sync);
  sync();
  return node;
}
