import { icon } from '../../scripts/core/dom.js';
import { formatNumber } from '../../scripts/core/format.js';
import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';

const use = await loadTemplates(new URL('./Stepper.html', import.meta.url));

// Fills an <ol class="stepper"> with steps (translation keys). Returns a function that moves to a step (0-based).
export function mountStepper(list, labelKeys) {
  const steps = labelKeys.map((key) => {
    const step = use('stepper-step');
    refs(step).label.dataset.i18n = key;
    list.append(hydrate(step));
    return step;
  });
  return (current) => {
    steps.forEach((step, index) => {
      const ref = refs(step);
      const done = index < current;
      step.classList.toggle('stepper__step--done', done);
      if (index === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      ref.dot.replaceChildren(done ? icon('check', { size: 'sm' }) : formatNumber(index + 1));
      ref.done.hidden = !done;
    });
  };
}
