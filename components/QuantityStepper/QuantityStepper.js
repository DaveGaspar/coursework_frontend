import { formatNumber } from '../../scripts/core/format.js';
import { loadTemplates, refs } from '../../scripts/core/template.js';

const use = await loadTemplates(new URL('./QuantityStepper.html', import.meta.url));

// [−] 2 [+] with a limited range. onChange(value) runs after every change.
export function createQuantityStepper({ value = 1, min = 1, max = 10, labelledBy = null, onChange = () => {} }) {
  const node = use('quantity');
  const ref = refs(node);
  if (labelledBy) node.setAttribute('aria-labelledby', labelledBy);
  let current = value;
  let limit = max;

  const render = () => {
    ref.value.textContent = formatNumber(current);
    ref.minus.disabled = current <= min;
    ref.plus.disabled = current >= limit;
  };
  const set = (next) => {
    const clamped = Math.max(min, Math.min(limit, next));
    if (clamped === current) return;
    current = clamped;
    render();
    onChange(current);
  };
  ref.minus.addEventListener('click', () => set(current - 1));
  ref.plus.addEventListener('click', () => set(current + 1));
  render();

  return {
    element: node,
    get value() { return current; },
    setMax(next) {
      limit = Math.max(min, next);
      if (current > limit) set(limit);
      else render();
    },
    refresh: render,
  };
}
