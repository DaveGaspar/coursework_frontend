import { loadTemplates, refs } from '../../scripts/core/template.js';
import {
  detectBrand, digitsOnly, formatCardNumber, formatExpiry,
  validateCardNumber, validateCardholder, validateCvv, validateExpiry,
} from '../../scripts/core/validators.js';
import { brandMark } from '../SavedCard/SavedCard.js';

const use = await loadTemplates(new URL('./CardForm.html', import.meta.url));

function bindTooltip(button, tip) {
  const show = () => { tip.hidden = false; };
  const hide = () => { tip.hidden = true; };
  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('focus', show);
  button.addEventListener('blur', hide);
  button.addEventListener('click', () => { tip.hidden = !tip.hidden; });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
}

// Card number, expiry, CVV and name, formatted while typing. `rules` plug into validateForm().
// The full number and CVV only ever leave this form inside the purchase request; nothing stores them.
export function createCardForm({ withSave = true } = {}) {
  const node = use('card-form');
  const ref = refs(node);
  const input = (name) => node.querySelector(`[name="${name}"]`);
  const number = input('number');
  const expiry = input('expiry');
  const cvv = input('cvv');
  let brand = null;
  let save = false;

  const updateBrand = () => {
    const next = digitsOnly(number.value).length >= 2 ? detectBrand(number.value) : null;
    if (next === brand) return;
    brand = next;
    ref.brand.replaceChildren(...(brand && brand !== 'other' ? [brandMark(brand)] : []));
    cvv.maxLength = brand === 'amex' ? 4 : 3;
  };
  number.addEventListener('input', () => {
    number.value = formatCardNumber(number.value);
    updateBrand();
  });
  expiry.addEventListener('input', (event) => {
    if (!event.inputType?.startsWith('delete')) expiry.value = formatExpiry(expiry.value);
  });
  cvv.addEventListener('input', () => {
    cvv.value = digitsOnly(cvv.value).slice(0, cvv.maxLength);
  });
  bindTooltip(ref.tipButton, ref.tip);

  if (withSave) {
    ref.save.addEventListener('click', () => {
      save = !save;
      ref.save.setAttribute('aria-checked', String(save));
    });
  } else {
    ref.saveRow.remove();
  }

  return {
    element: node,
    rules: {
      number: validateCardNumber,
      expiry: validateExpiry,
      cvv: (value) => validateCvv(value, detectBrand(number.value)),
      name: validateCardholder,
    },
    values: () => ({
      number: digitsOnly(number.value),
      expiry: expiry.value.trim(),
      cvv: cvv.value,
      name: input('name').value.trim(),
      save,
    }),
    focus: () => number.focus(),
  };
}
