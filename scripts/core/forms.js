import { applyTranslations } from '../i18n/i18n.js';
import { h, icon } from './dom.js';
import { errorMessageKey } from './errors.js';

// Disables a button and shows a spinner, optionally with another label ("Paying…").
export function setBusy(button, busy, busyKey) {
  const label = button.querySelector('[data-i18n]') ?? button;
  if (busy) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.prepend(h('span', { class: 'spinner', 'aria-hidden': 'true' }));
    if (busyKey) {
      label.dataset.idleKey = label.dataset.i18n ?? '';
      label.dataset.i18n = busyKey;
      applyTranslations(label);
    }
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.querySelector(':scope > .spinner')?.remove();
    if (label.dataset.idleKey) {
      label.dataset.i18n = label.dataset.idleKey;
      applyTranslations(label);
      delete label.dataset.idleKey;
    }
  }
}

function describedBy(input, id, add) {
  const ids = new Set((input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  if (add) ids.add(id);
  else ids.delete(id);
  if (ids.size) input.setAttribute('aria-describedby', [...ids].join(' '));
  else input.removeAttribute('aria-describedby');
}

// Shows (or clears, when key is null) the message under a field. `key` is a translation key.
export function setFieldError(input, key, params = {}) {
  const field = input.closest('.field') ?? input.parentElement;
  const id = `${input.id || input.name}-error`;
  field.querySelector(':scope > .field__error')?.remove();
  describedBy(input, id, Boolean(key));
  field.classList.toggle('field--invalid', Boolean(key));
  if (!key) {
    input.removeAttribute('aria-invalid');
    return;
  }
  input.setAttribute('aria-invalid', 'true');
  const text = h('span', { dataset: { i18n: key, i18nParams: JSON.stringify(params) } });
  field.append(h('p', { class: 'field__error', id }, icon('circle-alert', { size: 'sm' }), text));
  applyTranslations(text);
}

// Applies { fieldName: key } errors to a form and focuses the first invalid field.
export function showErrors(form, fields = {}) {
  let first = null;
  for (const [name, key] of Object.entries(fields)) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLElement)) continue;
    setFieldError(input, key);
    first ??= input;
  }
  first?.focus();
  return Boolean(first);
}

export function clearErrors(form) {
  for (const input of form.querySelectorAll('[aria-invalid="true"]')) setFieldError(input, null);
  const alert = form.querySelector('.form-alert');
  if (alert) alert.replaceChildren();
}

// Form-level message in a .form-alert (role="alert").
export function showFormAlert(form, key, params = {}) {
  const alert = form.querySelector('.form-alert');
  if (!alert) return;
  const text = h('span', { dataset: { i18n: key, i18nParams: JSON.stringify(params) } });
  alert.replaceChildren(icon('circle-alert'), text);
  applyTranslations(text);
}

// Shows a repository error: field errors when it has them, otherwise a form-level message.
export function showError(form, err) {
  if (err?.fields && showErrors(form, err.fields)) {
    showFormAlert(form, 'validation.summary', { count: Object.keys(err.fields).length });
    return;
  }
  showFormAlert(form, errorMessageKey(err));
}

// Show/hide button inside a password field.
export function bindPasswordToggle(button, input) {
  const sync = () => {
    const visible = input.type === 'text';
    button.setAttribute('aria-pressed', String(visible));
    button.dataset.i18nAttr = `aria-label:${visible ? 'common.hidePassword' : 'common.showPassword'}`;
    button.querySelector('use')?.setAttribute('href', button.querySelector('use').getAttribute('href').replace(/#i-.*/, `#i-${visible ? 'eye-off' : 'eye'}`));
    applyTranslations(button);
  };
  button.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    sync();
    input.focus();
  });
  sync();
}

// rules: { fieldName: (value) => translationKey | null }. Checks a field when it loses focus,
// then on every keystroke once it shows an error.
export function validateOnBlur(form, rules) {
  for (const [name, rule] of Object.entries(rules)) {
    const input = form.elements.namedItem(name);
    if (!input) continue;
    input.addEventListener('blur', () => {
      if (input.value) setFieldError(input, rule(input.value));
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') setFieldError(input, rule(input.value));
    });
  }
}

// Runs every rule; shows the errors and a summary. Returns true when the form is valid.
export function validateForm(form, rules) {
  const fields = {};
  for (const [name, rule] of Object.entries(rules)) {
    const input = form.elements.namedItem(name);
    const error = input ? rule(input.value) : null;
    if (error) fields[name] = error;
  }
  if (!showErrors(form, fields)) return true;
  showFormAlert(form, 'validation.summary', { count: Object.keys(fields).length });
  return false;
}

export function bindPasswordToggles(root) {
  for (const button of root.querySelectorAll('[data-password-toggle]')) {
    bindPasswordToggle(button, document.getElementById(button.dataset.passwordToggle));
  }
}
