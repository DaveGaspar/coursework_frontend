import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { createMatchRow } from '../../components/MatchRow/MatchRow.js';
import { boot } from '../../scripts/app.js';
import { h } from '../../scripts/core/dom.js';
import { debounce, on } from '../../scripts/core/events.js';
import { formatNumber } from '../../scripts/core/format.js';
import { getParam, replaceParams } from '../../scripts/core/url.js';
import { matchesRepo } from '../../scripts/data/index.js';
import { applyTranslations, onLanguageChange, t } from '../../scripts/i18n/i18n.js';

await boot({ page: 'tickets' });

const form = document.getElementById('filters');
const list = document.getElementById('match-list');
const count = document.getElementById('count');
const status = document.getElementById('results-status');
const clear = document.getElementById('clear');
const field = (name) => form.elements.namedItem(name);

function filters() {
  return { league: field('league').value, date: field('date').value, q: field('q').value.trim() };
}

async function fillLeagues() {
  const leagues = await matchesRepo.leagues();
  const select = field('league');
  const wanted = getParam('league') ?? '';
  select.append(...leagues.map(({ name }) => h('option', { value: name }, name)));
  select.value = leagues.some((l) => l.name === wanted) ? wanted : '';
}

function clearButton() {
  return h('button', { class: 'btn btn--secondary', type: 'button', on: { click: resetFilters } },
    h('span', { 'data-i18n': 'tickets.clearFilters' }));
}

function renderList(matches, active) {
  list.removeAttribute('aria-busy');
  count.textContent = t('tickets.count', { count: formatNumber(matches.length) });
  status.textContent = t('tickets.results', { count: matches.length });
  if (!matches.length) {
    const empty = active
      ? createEmptyState({ icon: 'list-filter', titleKey: 'tickets.emptyTitle', textKey: 'tickets.emptyText', action: clearButton() })
      : createEmptyState({ icon: 'calendar', titleKey: 'tickets.noneTitle', textKey: 'tickets.noneText' });
    list.replaceChildren(h('li', null, empty));
    applyTranslations(list);
    return;
  }
  list.replaceChildren(...matches.map(createMatchRow));
}

let request = 0;
async function load() {
  const current = filters();
  const active = Boolean(current.league || current.date || current.q);
  clear.hidden = !active;
  replaceParams(current);
  const id = (request += 1);
  try {
    const matches = await matchesRepo.list({ status: 'upcoming', ...current, sort: 'asc' });
    if (id === request) renderList(matches, active);
  } catch (error) {
    if (id !== request) return;
    list.removeAttribute('aria-busy');
    list.replaceChildren(h('li', null, createErrorState({ error, onRetry: load })));
  }
}

function resetFilters() {
  form.reset();
  field('league').value = '';
  load();
  field('league').focus();
}

field('date').value = getParam('date') ?? '';
field('q').value = getParam('q') ?? '';
await fillLeagues().catch(() => {});

form.addEventListener('submit', (event) => event.preventDefault());
field('league').addEventListener('change', load);
field('date').addEventListener('change', load);
field('q').addEventListener('input', debounce(load, 250));
clear.addEventListener('click', resetFilters);
on('data:updated', debounce(load, 1500));
onLanguageChange(load);
await load();
