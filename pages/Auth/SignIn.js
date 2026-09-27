import { boot } from '../../scripts/app.js';
import { bindPasswordToggles, clearErrors, setBusy, showError, validateForm, validateOnBlur } from '../../scripts/core/forms.js';
import { flash, signIn } from '../../scripts/services/auth.js';
import { destination, keepNext } from './auth-form.js';

const user = await boot({ page: 'signin' });
if (user) location.replace(destination(user));

const form = document.getElementById('signin-form');
const button = form.querySelector('[type="submit"]');
const rules = {
  login: (value) => (value.trim() ? null : 'validation.loginRequired'),
  password: (value) => (value ? null : 'validation.passwordRequired'),
};

bindPasswordToggles(form);
validateOnBlur(form, rules);
keepNext(document.getElementById('switch-link'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  if (!validateForm(form, rules)) return;
  setBusy(button, true, 'auth.signingIn');
  try {
    const signedIn = await signIn({
      login: form.elements.namedItem('login').value.trim(),
      password: form.elements.namedItem('password').value,
    });
    flash('auth.welcome', 'success', { name: signedIn.username });
    location.assign(destination(signedIn));
  } catch (err) {
    setBusy(button, false);
    showError(form, err);
    form.elements.namedItem('password').focus();
  }
});
