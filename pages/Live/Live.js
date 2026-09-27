import { createStatusBadge } from '../../components/Badge/Badge.js';
import { mountChat } from '../../components/Chat/Chat.js';
import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { createTeamLogo } from '../../components/TeamLogo/TeamLogo.js';
import { boot } from '../../scripts/app.js';
import { h } from '../../scripts/core/dom.js';
import { debounce, on } from '../../scripts/core/events.js';
import { formatNumber } from '../../scripts/core/format.js';
import { getParam, replaceParams } from '../../scripts/core/url.js';
import { matchesRepo } from '../../scripts/data/index.js';
import { applyTranslations, onLanguageChange, t } from '../../scripts/i18n/i18n.js';
import { startLiveTicker } from '../../scripts/services/live-ticker.js';
import { kickoffLabel, liveClock, liveUrl, matchTitle, scoreLabel, shortTitle } from '../../scripts/services/match-display.js';
import { renderPlayer } from './player.js';

const user = await boot({ page: 'live' });

const $ = (id) => document.getElementById(id);
let match;
let chat;
let goalsSeen = 0;

function showProblem(content) {
  $('live-loading').remove();
  $('live-problem').replaceChildren(content);
  $('live-problem').hidden = false;
}

function teamBlock(el, team) {
  el.replaceChildren(createTeamLogo(team, { size: 'lg', decorative: true, lazy: false }), h('span', { class: 'scoreboard__name' }, team.name));
}

function renderScoreboard() {
  $('match-title').textContent = matchTitle(match);
  teamBlock($('home'), match.home_team);
  teamBlock($('away'), match.away_team);
  const pending = match.status === 'upcoming';
  $('score').textContent = pending ? t('common.vsShort') : scoreLabel(match);
  $('score').classList.toggle('scoreboard__score--pending', pending);
  $('scoreboard-meta').replaceChildren(...[
    createStatusBadge(match.status),
    match.status === 'live' && liveClock(match) && h('span', { class: 'num' }, liveClock(match)),
    h('span', null, [match.league, match.venue].filter(Boolean).join(' · ')),
  ].filter(Boolean));
}

function renderInfo() {
  const tba = t('common.toBeAnnounced');
  $('info-venue').textContent = match.venue ?? tba;
  $('info-date').textContent = kickoffLabel(match, 'full');
  $('info-attendance').textContent = match.status !== 'upcoming' && match.attendance ? formatNumber(match.attendance) : tba;
  $('info-referee').textContent = match.referee ?? tba;
}

function otherGame(m) {
  return h('li', null, h('a', { class: 'other-game', href: liveUrl(m), 'aria-label': `${matchTitle(m)}, ${t(`status.${m.status}`)}` },
    h('span', { class: 'other-game__title' }, shortTitle(m)),
    h('span', { class: 'other-game__side' }, m.status === 'live' ? liveClock(m) : kickoffLabel(m), createStatusBadge(m.status))));
}

async function renderOthers() {
  const rows = (await matchesRepo.list({ status: ['live', 'upcoming'], limit: 6 })).filter((m) => m.id !== match.id).slice(0, 5);
  $('others').replaceChildren(...(rows.length ? rows.map(otherGame) : [h('li', { class: 'muted text-sm', 'data-i18n': 'live.others.empty' })]));
  applyTranslations($('others'));
}

function render() {
  renderPlayer($('player'), match, { onKickoff: () => refresh({ fresh: true }) });
  renderScoreboard();
  renderInfo();
}

function postNewGoals(next) {
  for (const goal of next.goals.slice(goalsSeen)) {
    chat.system(t('live.chat.goal', {
      minute: goal.minute,
      scorer: goal.scorer ?? t('live.goal'),
      score: t('common.score', { home: goal.home_score, away: goal.away_score }),
    }));
  }
  goalsSeen = next.goals.length;
}

async function refresh({ fresh = false } = {}) {
  const next = await matchesRepo.get(match.id, { fresh }).catch(() => null);
  if (!next) return;
  postNewGoals(next);
  match = next;
  render();
  renderOthers().catch(() => {});
}

// Without ?match=, show the first live match, or else the next upcoming one.
async function pickMatch() {
  const id = getParam('match');
  if (id) return matchesRepo.get(id);
  const [live] = await matchesRepo.list({ status: 'live', limit: 1 });
  const next = live ?? (await matchesRepo.list({ status: 'upcoming', limit: 1 }))[0];
  if (next) replaceParams({ match: next.id });
  return next ?? null;
}

async function start() {
  try {
    match = await pickMatch();
  } catch (error) {
    if (error.code !== 'not_found') return showProblem(createErrorState({ error, onRetry: () => location.reload() }));
  }
  if (!match) {
    const action = h('a', { class: 'btn btn--primary', 'data-route': 'tickets', 'data-i18n': 'nav.buyTickets' });
    const [titleKey, textKey] = getParam('match') ? ['live.notFoundTitle', 'live.notFoundText'] : ['live.noneTitle', 'live.noneText'];
    return showProblem(createEmptyState({ icon: 'tv', titleKey, textKey, action }));
  }

  goalsSeen = match.goals.length;
  render();
  chat = mountChat($('chat'), { matchId: match.id, user });
  await renderOthers().catch(() => {});
  $('live-loading').remove();
  $('live').hidden = false;

  startLiveTicker({ poll: () => matchesRepo.pollLive().then(() => refresh()) });
  on('data:updated', debounce(() => refresh(), 1500));
  onLanguageChange(() => {
    render();
    renderOthers().catch(() => {});
  });
}

await start();
