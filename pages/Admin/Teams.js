import { confirmDialog, openDialog } from '../../components/Dialog/Dialog.js';
import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { createTeamLogo } from '../../components/TeamLogo/TeamLogo.js';
import { toast } from '../../components/Toast/Toast.js';
import { boot } from '../../scripts/app.js';
import { h, icon } from '../../scripts/core/dom.js';
import { debounce } from '../../scripts/core/events.js';
import { errorMessageKey } from '../../scripts/core/errors.js';
import { PLAYER_POSITIONS, playersRepo, teamsRepo } from '../../scripts/data/index.js';
import { applyTranslations, onLanguageChange, t } from '../../scripts/i18n/i18n.js';
import { cell, field, formValues, headerCell, iconButton } from './admin.js';

await boot({ page: 'adminTeams', access: 'admin' });

const list = document.getElementById('teams');
const search = document.getElementById('q');
const rosters = new Map();
let teams = [];

// Rosters come from TheSportsDB one team at a time, so they load when a card scrolls into view.
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    loadRoster(teams.find((team) => team.id === Number(entry.target.dataset.id)));
  }
}, { rootMargin: '300px' });

const failed = (error) => toast(errorMessageKey(error), { type: 'error' });

function coachView(line, team) {
  line.replaceChildren(
    h('span', { 'data-i18n': 'admin.teams.coach' }),
    team.coach_name ? h('strong', null, team.coach_name) : h('span', { 'data-i18n': 'common.notSet' }),
    iconButton('pencil', 'admin.teams.editCoach', { team: team.name }, () => coachEdit(line, team)),
  );
  applyTranslations(line);
}

// Enter saves, Escape or leaving the field cancels.
function coachEdit(line, team) {
  const input = h('input', { class: 'input', value: team.coach_name ?? '', maxlength: 100, 'data-i18n-attr': 'aria-label:admin.teams.coachLabel' });
  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    if (save && input.value.trim() !== (team.coach_name ?? '')) {
      try {
        Object.assign(team, await teamsRepo.update(team.id, { coach_name: input.value }));
        toast('admin.teams.coachSaved', { type: 'success' });
      } catch (error) {
        failed(error);
      }
    }
    coachView(line, team);
    line.querySelector('button').focus();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(false));
  line.replaceChildren(h('span', { 'data-i18n': 'admin.teams.coach' }), input);
  applyTranslations(line);
  input.focus();
  input.select();
}

function playerRow(team, player) {
  return h('tr', null,
    cell('admin.players.number', player.jersey_number != null ? `#${player.jersey_number}` : '—', 'cell-num'),
    cell('admin.players.name', player.full_name, 'cell-main'),
    cell('admin.players.position', player.position ? t(`positions.${player.position}`) : '—'),
    cell('admin.actions', h('div', { class: 'cluster' },
      iconButton('pencil', 'admin.players.edit', { name: player.full_name }, () => playerDialog(team, player)),
      iconButton('trash-2', 'admin.players.delete', { name: player.full_name }, () => deletePlayer(team, player), { danger: true })), 'cell-actions'));
}

function renderRoster(team) {
  const box = list.querySelector(`[data-id="${team.id}"] .team-card__roster`);
  const players = rosters.get(team.id);
  if (!box || !players) return;
  box.replaceChildren(players.length
    ? h('table', { class: 'table table--stack' },
      h('caption', { class: 'visually-hidden' }, t('admin.teams.rosterOf', { team: team.name })),
      h('thead', null, h('tr', null,
        headerCell('admin.players.number', 'cell-num'), headerCell('admin.players.name'),
        headerCell('admin.players.position'), headerCell('admin.actions', 'cell-actions'))),
      h('tbody', null, players.map((player) => playerRow(team, player))))
    : h('p', { class: 'muted text-sm', 'data-i18n': 'admin.teams.noPlayers' }));
  applyTranslations(box);
}

async function loadRoster(team, { force = false } = {}) {
  if (!team || (rosters.has(team.id) && !force)) return renderRoster(team);
  try {
    rosters.set(team.id, (await teamsRepo.get(team.id, { withPlayers: true })).players);
    renderRoster(team);
  } catch (error) {
    list.querySelector(`[data-id="${team.id}"] .team-card__roster`)
      ?.replaceChildren(createErrorState({ error, onRetry: () => loadRoster(team, { force: true }) }));
  }
}

function teamCard(team) {
  const coach = h('p', { class: 'team-card__coach' });
  coachView(coach, team);
  const card = h('article', { class: 'card card--accent team-card', 'aria-labelledby': `team-${team.id}`, dataset: { id: team.id } },
    h('header', { class: 'team-card__head' },
      createTeamLogo(team, { decorative: true }),
      h('div', { class: 'team-card__title' }, h('h2', { class: 'h2 team-card__name', id: `team-${team.id}` }, team.name), coach),
      h('div', { class: 'cluster team-card__actions' },
        h('button', { class: 'btn btn--secondary btn--sm', type: 'button', on: { click: () => playerDialog(team) } },
          icon('user-plus'), h('span', { 'data-i18n': 'admin.players.add' })),
        iconButton('pencil', 'admin.teams.edit', { team: team.name }, () => teamDialog(team)),
        iconButton('trash-2', 'admin.teams.delete', { team: team.name }, () => deleteTeam(team), { danger: true }))),
    h('div', { class: 'team-card__roster' }, h('span', { class: 'skeleton skeleton--text', 'aria-hidden': 'true' })));
  applyTranslations(card);
  return card;
}

function render() {
  const q = search.value.trim().toLowerCase();
  const shown = teams.filter((team) => team.name.toLowerCase().includes(q));
  document.getElementById('count').textContent = t('admin.teams.count', { count: shown.length });
  list.removeAttribute('aria-busy');
  observer.disconnect();
  if (!shown.length) {
    list.replaceChildren(createEmptyState({ icon: 'users', titleKey: 'admin.teams.emptyTitle', textKey: 'admin.teams.emptyText' }));
    return;
  }
  list.replaceChildren(...shown.map(teamCard));
  for (const card of list.children) {
    if (rosters.has(Number(card.dataset.id))) renderRoster(teams.find((team) => team.id === Number(card.dataset.id)));
    else observer.observe(card);
  }
}

async function load() {
  try {
    teams = await teamsRepo.list();
    render();
  } catch (error) {
    list.removeAttribute('aria-busy');
    list.replaceChildren(createErrorState({ error, onRetry: load }));
  }
}

async function teamDialog(team = null) {
  const saved = await openDialog({
    title: t(team ? 'admin.teams.editTitle' : 'admin.teams.addTitle'),
    submitLabel: t(team ? 'common.saveChanges' : 'admin.teams.add'),
    content: h('div', { class: 'form-grid' },
      field({ name: 'name', labelKey: 'admin.teams.name', value: team?.name, full: true, attrs: { maxlength: 100, required: true } }),
      field({ name: 'coach_name', labelKey: 'admin.teams.coachLabel', value: team?.coach_name, full: true, attrs: { maxlength: 100 } }),
      field({ name: 'logo_url', labelKey: 'admin.teams.logo', type: 'url', value: team?.logo_url, full: true, attrs: { placeholder: 'https://' } })),
    onSubmit: (form) => (team ? teamsRepo.update(team.id, formValues(form)) : teamsRepo.create(formValues(form))),
  });
  if (!saved) return;
  toast(team ? 'admin.teams.updated' : 'admin.teams.created', { type: 'success', params: { team: saved.name } });
  await load();
}

async function deleteTeam(team) {
  const counts = await teamsRepo.get(team.id).catch(() => team);
  const ok = await confirmDialog({
    title: t('admin.teams.deleteTitle', { team: team.name }),
    message: t('admin.teams.deleteText', { players: counts.player_count, matches: counts.match_count }),
  });
  if (!ok) return;
  try {
    await teamsRepo.remove(team.id);
    rosters.delete(team.id);
    toast('admin.teams.deleted', { type: 'success', params: { team: team.name } });
    await load();
  } catch (error) {
    failed(error);
  }
}

async function playerDialog(team, player = null) {
  const saved = await openDialog({
    title: t(player ? 'admin.players.editTitle' : 'admin.players.addTitle', { team: team.name }),
    submitLabel: t(player ? 'common.saveChanges' : 'admin.players.add'),
    content: h('div', { class: 'form-grid' },
      field({ name: 'full_name', labelKey: 'admin.players.name', value: player?.full_name, full: true, attrs: { maxlength: 100, required: true, autocomplete: 'off' } }),
      field({ name: 'jersey_number', labelKey: 'admin.players.number', type: 'number', value: player?.jersey_number, attrs: { min: 1, max: 99, inputmode: 'numeric' } }),
      field({
        name: 'position',
        labelKey: 'admin.players.position',
        value: player?.position ?? 'Midfielder',
        options: PLAYER_POSITIONS.map((value) => ({ value, labelKey: `positions.${value}` })),
      })),
    onSubmit: (form) => (player
      ? playersRepo.update(player.id, formValues(form))
      : playersRepo.create({ ...formValues(form), team_id: team.id })),
  });
  if (!saved) return;
  toast(player ? 'admin.players.updated' : 'admin.players.created', { type: 'success', params: { name: saved.full_name } });
  await loadRoster(team, { force: true });
}

async function deletePlayer(team, player) {
  const ok = await confirmDialog({ title: t('admin.players.deleteTitle', { name: player.full_name }), message: t('admin.players.deleteText') });
  if (!ok) return;
  try {
    await playersRepo.remove(player.id);
    toast('admin.players.deleted', { type: 'success', params: { name: player.full_name } });
    await loadRoster(team, { force: true });
  } catch (error) {
    failed(error);
  }
}

document.getElementById('add-team').addEventListener('click', () => teamDialog());
document.getElementById('filters').addEventListener('submit', (event) => event.preventDefault());
search.addEventListener('input', debounce(render, 200));
onLanguageChange(render);
await load();
