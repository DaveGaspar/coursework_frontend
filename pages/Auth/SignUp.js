import { boot } from '../../scripts/app.js';
import { bindPasswordToggles, clearErrors, setBusy, showError, validateForm, validateOnBlur } from '../../scripts/core/forms.js';
import { validateEmail, validatePassword, validateUsername } from '../../scripts/core/validators.js';
import { flash, signUp } from '../../scripts/services/auth.js';
import { destination, keepNext } from './auth-form.js';

const user = await boot({ page: 'signup' });
if (user) location.replace(destination(user));

const form = document.getElementById('signup-form');
const button = form.querySelector('[type="submit"]');
const field = (name) => form.elements.namedItem(name);
const rules = {
  username: validateUsername,
  email: validateEmail,
  password: validatePassword,
  confirm: (value) => {
    if (!value) return 'validation.passwordRequired';
    return value === field('password').value ? null : 'validation.passwordMismatch';
  },
};

bindPasswordToggles(form);
validateOnBlur(form, rules);
keepNext(document.getElementById('switch-link'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  if (!validateForm(form, rules)) return;
  setBusy(button, true, 'auth.creating');
  try {
    const created = await signUp({
      username: field('username').value.trim(),
      email: field('email').value.trim(),
      password: field('password').value,
    });
    flash('auth.welcomeNew', 'success', { name: created.username });
    location.assign(destination(created));
  } catch (err) {
    setBusy(button, false);
    showError(form, err);
  }
});
