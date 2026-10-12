import { setDram, showsDram } from '../../scripts/core/currency.js';
import { loadTemplates } from '../../scripts/core/template.js';
import { onLanguageChange } from '../../scripts/i18n/i18n.js';

const use = await loadTemplates(new URL('./CurrencySwitch.html', import.meta.url));

// $ / ֏ segmented control. Switching redraws the prices in place.
export function createCurrencySwitch() {
  const node = use('currency-switch');
  const sync = () => {
    for (const button of node.querySelectorAll('[data-amd]')) {
      button.setAttribute('aria-pressed', String((button.dataset.amd === 'true') === showsDram()));
    }
  };
  node.addEventListener('click', (event) => {
    const button = event.target.closest('[data-amd]');
    if (button) setDram(button.dataset.amd === 'true');
  });
  // setDram announces itself through the same event as a language switch.
  onLanguageChange(sync);
  sync();
  return node;
}
