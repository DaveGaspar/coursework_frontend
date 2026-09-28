import { loadTemplates, refs } from '../../scripts/core/template.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';

const use = await loadTemplates(new URL('./SeatMap.html', import.meta.url));

// Stadium plan plus a radio list of zones. The radios are the real (keyboard) control;
// clicking a stand on the plan just picks its radio. priceLabel(zoneId) gives each zone's price text.
export function createSeatMap({ zones, value, priceLabel, onChange }) {
  const node = use('seat-map');
  const ref = refs(node);
  const options = zones.map((zone) => {
    const option = use('seat-zone');
    const r = refs(option);
    Object.assign(r.radio, { value: zone.id, checked: zone.id === value });
    r.name.dataset.i18n = `checkout.seats.zones.${zone.id}.name`;
    r.text.dataset.i18n = `checkout.seats.zones.${zone.id}.text`;
    applyTranslations(option);
    return { id: zone.id, node: option, price: r.price };
  });
  ref.zones.append(...options.map((o) => o.node));

  const highlight = (id) => {
    for (const stand of ref.stadium.querySelectorAll('[data-zone]')) {
      stand.classList.toggle('seat-map__stand--selected', stand.dataset.zone === id);
    }
  };
  ref.zones.addEventListener('change', (event) => {
    highlight(event.target.value);
    onChange(event.target.value);
  });
  ref.stadium.addEventListener('click', (event) => {
    const radio = ref.zones.querySelector(`input[value="${event.target.closest('[data-zone]')?.dataset.zone}"]`);
    if (!radio || radio.checked) return;
    radio.checked = true;
    radio.focus({ preventScroll: true });
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const refresh = () => {
    for (const o of options) o.price.textContent = priceLabel(o.id);
  };
  refresh();
  highlight(value);
  return { element: node, refresh };
}
