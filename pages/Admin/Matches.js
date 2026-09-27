import { createStatusBadge } from '../../components/Badge/Badge.js';
import { confirmDialog } from '../../components/Dialog/Dialog.js';
import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { toast } from '../../components/Toast/Toast.js';
import { boot } from '../../scripts/app.js';
import { h } from '../../scripts/core/dom.js';
import { debounce, on } from '../../scripts/core/events.js';
import { errorMessageKey } from '../../scripts/core/errors.js';
import { setBusy } from '../../scripts/core/forms.js';
import { getParam, replaceParams } from '../../scripts/core/url.js';
import { matchesRepo, teamsRepo } from '../../scripts/data/index.js';
import { applyTranslations, onLanguageChange, t } from '../../scripts/i18n/i18n.js';
import { kickoffLabel, matchTitle } from '../../scripts/services/match-display.js';
import { cell, headerCell, iconButton } from './admin.js';
import { matchDialog } from './match-dialog.js';

await boot({ page: 'adminMatches', access: 'admin' });

const box = document.getElementById('matches');
const form = document.getElementById('filters');
const status = form.elements.namedItem('status');
const search = form.elements.namedItem('q');

function row(match) {
  const title = matchTitle(match);
  return h('tr', null,
    cell('admin.matches.match', title, 'cell-main'),
    cell('admin.matches.dateTime', kickoffLabel(match, 'full')),
    cell('admin.matches.venue', match.venue ?? '—'),
    cell('admin.matches.league', match.league),
    cell('admin.matches.status', createStatusBadge(match.status)),
    cell('admin.actions', h('div', { class: 'cluster' },
      iconButton('pencil', 'admin.matches.edit', { match: title }, () => editMatch(match)),
      iconButton('trash-2', 'admin.matches.delete', { match: title }, () => deleteMatch(match), { danger: true })), 'cell-actions'));
}

let request = 0;
async function load() {
  const filters = { status: status.value, q: search.value.trim() };
  replaceParams(filters);
  const id = (request += 1);
  try {
    const matches = await matchesRepo.list({ status: filters.status || undefined, q: filters.q, sort: 'desc' });
    if (id !== request) return;
    document.getElementById('count').textContent = t('admin.matches.count', { count: matches.length });
    box.removeAttribute('aria-busy');
    box.replaceChildren(matches.length
      ? h('div', { class: 'table-scroll' }, h('table', { class: 'table table--stack' },
        h('caption', { class: 'visually-hidden', 'data-i18n': 'admin.matches.title' }),
        h('thead', null, h('tr', null, ['match', 'dateTime', 'venue', 'league', 'status'].map((key) => headerCell(`admin.matches.${key}`)),
          headerCell('admin.actions', 'cell-actions'))),
        h('tbody', null, matches.map(row))))
      : createEmptyState({ icon: 'calendar', titleKey: 'admin.matches.emptyTitle', textKey: 'admin.matches.emptyText', compact: true }));
    applyTranslations(box);
  } catch (error) {
    if (id !== request) return;
    box.removeAttribute('aria-busy');
    box.replaceChildren(createErrorState({ error, onRetry: load }));
  }
}

async function openEditor(match = null) {
  const [teams, leagues] = await Promise.all([teamsRepo.list(), matchesRepo.leagues()]);
  const saved = await matchDialog({ match, teams, leagues });
  if (!saved) return;
  toast(match ? 'admin.matches.updated' : 'admin.matches.created', { type: 'success', params: { match: matchTitle(saved) } });
  await load();
}
const editMatch = (match) => openEditor(match).catch((error) => toast(errorMessageKey(error), { type: 'error' }));

async function deleteMatch(match) {
  const title = matchTitle(match);
  const sold = Math.max(0, match.ticket_capacity - match.tickets_left);
  const ok = await confirmDialog({
    title: t('admin.matches.deleteTitle', { match: title }),
    message: t(sold ? 'admin.matches.deleteText' : 'admin.matches.deleteTextNoTickets', { count: sold }),
  });
  if (!ok) return;
  try {
    await matchesRepo.remove(match.id);
    toast('admin.matches.deleted', { type: 'success', params: { match: title } });
    await load();
  } catch (error) {
    toast(errorMessageKey(error), { type: 'error' });
  }
}

async function refresh(event) {
  const button = event.currentTarget;
  setBusy(button, true, 'admin.matches.refreshing');
  try {
    await matchesRepo.refresh();
    toast('admin.matches.refreshed', { type: 'success' });
    await load();
  } catch (error) {
    toast(errorMessageKey(error), { type: 'error' });
  } finally {
    setBusy(button, false);
  }
}

status.value = getParam('status') ?? '';
search.value = getParam('q') ?? '';
form.addEventListener('submit', (event) => event.preventDefault());
status.addEventListener('change', load);
search.addEventListener('input', debounce(load, 250));
document.getElementById('add-match').addEventListener('click', () => editMatch(null));
document.getElementById('refresh').addEventListener('click', refresh);
on('data:updated', debounce(load, 1500));
onLanguageChange(load);
await load();
