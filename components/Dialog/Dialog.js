import { h } from '../../scripts/core/dom.js';
import { clearErrors, setBusy, showError } from '../../scripts/core/forms.js';
import { loadTemplates, refs } from '../../scripts/core/template.js';
import { t } from '../../scripts/i18n/i18n.js';

const use = await loadTemplates(new URL('./Dialog.html', import.meta.url));
let count = 0;

// Opens a modal dialog. `onSubmit(form)` may throw (errors are shown in the dialog) or return false to stay open.
// Resolves with onSubmit's result (true when there is none), or null when cancelled.
export function openDialog({ title, content, submitLabel, danger = false, wide = false, onSubmit = null }) {
  return new Promise((resolve) => {
    const dialog = use('dialog');
    const ref = refs(dialog);
    const trigger = document.activeElement;
    let result = null;

    ref.title.id = `dialog-title-${(count += 1)}`;
    dialog.setAttribute('aria-labelledby', ref.title.id);
    ref.title.textContent = title;
    ref.submitLabel.textContent = submitLabel;
    if (danger) ref.submit.classList.replace('btn--primary', 'btn--danger');
    if (wide) dialog.classList.add('dialog--wide');
    ref.body.append(...[].concat(content));

    const close = () => dialog.close();
    ref.close.addEventListener('click', close);
    ref.cancel.addEventListener('click', close);
    ref.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(ref.form);
      if (!onSubmit) {
        result = true;
        close();
        return;
      }
      setBusy(ref.submit, true);
      try {
        const value = await onSubmit(ref.form);
        if (value !== false) {
          result = value ?? true;
          close();
        }
      } catch (err) {
        showError(ref.form, err);
      } finally {
        if (dialog.open) setBusy(ref.submit, false);
      }
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      resolve(result);
    });

    document.body.append(dialog);
    dialog.showModal();
    (ref.body.querySelector('input:not([type="hidden"]), select, textarea') ?? ref.submit).focus();
  });
}

// Asks before a destructive action. Resolves true or false.
export async function confirmDialog({ title, message, confirmLabel, danger = true }) {
  const body = h('p', { class: 'dialog__message', text: message });
  return (await openDialog({ title, content: body, submitLabel: confirmLabel ?? t('common.delete'), danger })) === true;
}
