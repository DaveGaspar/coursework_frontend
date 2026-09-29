import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { boot } from '../../scripts/app.js';
import { h, icon } from '../../scripts/core/dom.js';
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatDate, formatNumber, formatPercent } from '../../scripts/core/format.js';
import { onThemeChange } from '../../scripts/core/theme.js';
import { reportsRepo } from '../../scripts/data/index.js';
import { applyTranslations, onLanguageChange, t } from '../../scripts/i18n/i18n.js';
import { matchTitle, shortTitle } from '../../scripts/services/match-display.js';
import { barChart, destroyCharts, donutChart, fillChartCard } from './charts.js';

await boot({ page: 'adminReports', access: 'admin' });

const $ = (id) => document.getElementById(id);
const STREAMS = ['tickets', 'sponsorship', 'merchandise', 'concessions'];
const RECENT = 10;
let summary;
let matches = [];

function statTile(iconName, labelKey, value) {
  return h('div', { class: 'stat-tile' },
    h('span', { class: 'stat-tile__well' }, icon(iconName, { size: 'lg' })),
    h('div', { class: 'stat-tile__body' },
      h('span', { class: 'stat-tile__label', 'data-i18n': labelKey }),
      h('span', { class: ['stat-tile__value', value.length > 8 && 'stat-tile__value--long'] }, value)));
}

function renderKpis() {
  const kpis = $('kpis');
  kpis.removeAttribute('aria-busy');
  kpis.replaceChildren(
    statTile('calendar', 'admin.reports.totalMatches', formatNumber(summary.total_matches)),
    statTile('users', 'admin.reports.avgAttendance', formatNumber(summary.avg_attendance)),
    statTile('trending-up', 'admin.reports.totalRevenue', formatCompactCurrency(summary.total_revenue)),
    statTile('trophy', 'admin.reports.totalGoals', formatNumber(summary.total_goals)));
  applyTranslations(kpis);
}

function renderDetails() {
  const select = $('match-select');
  const selected = Number(select.value) || matches[0].id;
  select.replaceChildren(...matches.map((m) => h('option', { value: m.id, selected: m.id === selected },
    `${matchTitle(m)} (${formatDate(m.scheduled_at, 'short')})`)));
  const m = matches.find((x) => x.id === selected);
  const tile = (labelKey, value) => h('div', { class: 'mini-tile' },
    h('span', { class: 'mini-tile__label', 'data-i18n': labelKey }), h('span', { class: 'mini-tile__value' }, value));
  $('mini-tiles').replaceChildren(
    tile('admin.reports.finalScore', t('common.score', { home: m.home_score ?? 0, away: m.away_score ?? 0 })),
    tile('admin.reports.attendance', formatNumber(m.attendance)),
    tile('admin.reports.revenue', formatCurrency(m.revenue_total, { whole: true })),
    tile('admin.reports.date', formatDate(m.scheduled_at, 'full')));
  const stat = (glyph, labelKey, value) => h('li', { class: 'stat-list__row' },
    glyph, h('span', { class: 'stat-list__label', 'data-i18n': labelKey }), h('span', { class: 'stat-list__value' }, formatNumber(value)));
  $('stat-list').replaceChildren(
    stat(icon('whistle', { className: 'stat-list__icon' }), 'admin.reports.fouls', m.total_fouls),
    stat(h('span', { class: 'card-glyph card-glyph--yellow', 'aria-hidden': 'true' }), 'admin.reports.yellowCards', m.yellow_cards),
    stat(h('span', { class: 'card-glyph card-glyph--red', 'aria-hidden': 'true' }), 'admin.reports.redCards', m.red_cards));
  applyTranslations($('mini-tiles'));
  applyTranslations($('stat-list'));
}

function table(headKeys, rows, foot = null) {
  const num = (i) => (i > 0 ? 'cell-num' : null);
  const cells = (list) => list.map((c, i) => h('td', { class: num(i), 'data-label': t(headKeys[i]) }, c));
  return h('table', { class: 'table table--stack' },
    h('thead', null, h('tr', null, headKeys.map((key, i) => h('th', { scope: 'col', class: num(i), 'data-i18n': key })))),
    h('tbody', null, rows.map((row) => h('tr', null, cells(row)))),
    foot && h('tfoot', null, h('tr', null, cells(foot))));
}

function streamRows() {
  const total = summary.total_revenue || 1;
  return STREAMS.map((key, i) => [
    h('span', { class: 'cell-swatch' }, h('span', { class: `swatch swatch--${i + 1}` }), t(`admin.reports.streams.${key}`)),
    formatCurrency(summary.revenue_by_stream[key], { whole: true }),
    formatPercent(summary.revenue_by_stream[key] / total, 1),
  ]);
}

function renderCharts() {
  destroyCharts();
  const recent = matches.slice(0, RECENT).reverse();
  const labels = recent.map(shortTitle);
  const byMatch = (id, titleKey, valueKey, format, tickFormat, headKey) => fillChartCard($(`${id}-card`), {
    id,
    titleKey,
    subtitleKey: 'admin.reports.lastMatches',
    subtitleParams: { count: recent.length },
    table: table(['admin.reports.match', headKey], recent.map((m) => [matchTitle(m), format(m[valueKey])])),
    chart: (canvas) => barChart(canvas, { labels, values: recent.map((m) => m[valueKey]), format, tickFormat }),
  });
  byMatch('attendance', 'admin.reports.attendanceByMatch', 'attendance', formatNumber, formatCompactNumber, 'admin.reports.attendance');
  byMatch('revenue', 'admin.reports.revenueByMatch', 'revenue_total', (v) => formatCurrency(v, { whole: true }), formatCompactCurrency, 'admin.reports.revenue');

  const head = ['admin.reports.stream', 'admin.reports.amount', 'admin.reports.share'];
  const foot = [t('admin.reports.total'), formatCurrency(summary.total_revenue, { whole: true }), formatPercent(1)];
  const values = STREAMS.map((key) => summary.revenue_by_stream[key]);
  fillChartCard($('donut-card'), {
    id: 'donut',
    titleKey: 'admin.reports.distribution',
    table: table(head, streamRows(), foot),
    body: (canvas) => h('div', { class: 'donut' },
      h('div', { class: 'donut__chart' }, canvas, h('div', { class: 'donut__center' },
        h('span', { class: 'donut__total' }, formatCompactCurrency(summary.total_revenue).replace(/[\u00a0\u202f]/, ' ')),
        h('span', { class: 'donut__caption', 'data-i18n': 'admin.reports.total' }))),
      h('ul', { class: 'legend', role: 'list' }, STREAMS.map((key, i) => h('li', { class: 'legend__item' },
        h('span', { class: `swatch swatch--${i + 1}` }),
        h('span', { class: 'legend__label', 'data-i18n': `admin.reports.streams.${key}` }),
        h('span', { class: 'legend__value' }, formatCompactCurrency(values[i]), ' ',
          h('span', { class: 'legend__pct' }, formatPercent(values[i] / (summary.total_revenue || 1)))))))),
    chart: (canvas) => donutChart(canvas, {
      labels: STREAMS.map((key) => t(`admin.reports.streams.${key}`)),
      values,
      format: (v) => formatCurrency(v, { whole: true }),
    }),
  });
  $('breakdown').replaceChildren(table(head, streamRows(), foot));
  applyTranslations($('breakdown'));
}

function renderAll() {
  renderKpis();
  if (!matches.length) return;
  renderDetails();
  renderCharts();
}

async function load() {
  try {
    [summary, matches] = await Promise.all([reportsRepo.summary(), reportsRepo.byMatch()]);
  } catch (error) {
    $('kpis').replaceWith(createErrorState({ error, onRetry: () => location.reload() }));
    return;
  }
  // Charts need a visible container to measure, so show the section before drawing.
  $('report-body').hidden = !matches.length;
  if (!matches.length) {
    $('report-empty').replaceChildren(createEmptyState({ icon: 'chart-column', titleKey: 'admin.reports.emptyTitle', textKey: 'admin.reports.emptyText' }));
    $('report-empty').hidden = false;
  }
  renderAll();
}

$('match-select').addEventListener('change', renderDetails);
onLanguageChange(renderAll);
onThemeChange(() => matches.length && renderCharts());
await load();
