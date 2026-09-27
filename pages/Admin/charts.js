import { h, icon } from '../../scripts/core/dom.js';
import { applyTranslations, t } from '../../scripts/i18n/i18n.js';

// Chart.js is loaded by a classic <script> tag as window.Chart. Colours come from the CSS tokens,
// so charts follow the theme once they are redrawn.
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const seriesColor = (index) => css(`--series-${index + 1}`);
const charts = new Set();
const tableViews = new Set();

function common() {
  window.Chart.defaults.font.family = css('--font-body');
  window.Chart.defaults.color = css('--color-text-muted');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : {},
    plugins: { legend: { display: false } },
  };
}

function draw(canvas, config) {
  const chart = new window.Chart(canvas, config);
  charts.add(chart);
  return chart;
}

export function destroyCharts() {
  for (const chart of charts) chart.destroy();
  charts.clear();
}

export function barChart(canvas, { labels, values, format, tickFormat }) {
  const options = common();
  options.plugins.tooltip = { callbacks: { label: (ctx) => format(ctx.parsed.y) } };
  options.scales = {
    x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 60 } },
    y: { beginAtZero: true, border: { display: false }, grid: { color: css('--chart-grid') }, ticks: { callback: tickFormat } },
  };
  return draw(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: seriesColor(0), borderRadius: 6, maxBarThickness: 40 }] },
    options,
  });
}

export function donutChart(canvas, { labels, values, format }) {
  const options = common();
  options.cutout = '68%';
  options.plugins.tooltip = { callbacks: { label: (ctx) => `${ctx.label}: ${format(ctx.parsed)}` } };
  return draw(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: values.map((_, i) => seriesColor(i)), borderColor: css('--color-surface'), borderWidth: 2 }] },
    options,
  });
}

// Title, a "View as table" toggle, the chart and the same numbers as a table. `chart(canvas)` draws it.
export function fillChartCard(section, { id, titleKey, subtitleKey = null, subtitleParams = {}, chart, table, body = null }) {
  const canvas = h('canvas', { role: 'img', 'data-i18n-attr': 'aria-label:admin.reports.chartLabel', 'data-i18n-params': JSON.stringify({ title: t(titleKey) }) });
  const graphic = body ? body(canvas) : h('div', { class: 'chart-box' }, canvas);
  const tableBox = h('div', { class: 'table-scroll' }, table);
  const label = h('span');
  const toggle = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'aria-controls': `${id}-table` }, icon('table-2'), label);
  tableBox.id = `${id}-table`;
  const sync = () => {
    const asTable = tableViews.has(id);
    graphic.hidden = asTable;
    tableBox.hidden = !asTable;
    toggle.setAttribute('aria-pressed', String(asTable));
    label.dataset.i18n = asTable ? 'admin.reports.viewChart' : 'admin.reports.viewTable';
    applyTranslations(label);
  };
  toggle.addEventListener('click', () => {
    if (tableViews.has(id)) tableViews.delete(id);
    else tableViews.add(id);
    sync();
  });
  section.replaceChildren(
    h('div', { class: 'chart-card__header' },
      h('div', null,
        h('h2', { class: 'chart-card__title', id: `${id}-title`, 'data-i18n': titleKey }),
        subtitleKey && h('p', { class: 'chart-card__subtitle', 'data-i18n': subtitleKey, 'data-i18n-params': JSON.stringify(subtitleParams) })),
      toggle),
    graphic,
    tableBox);
  applyTranslations(section);
  sync();
  chart(canvas);
}
