import { createEmptyState } from '../../components/EmptyState/EmptyState.js';
import { createErrorState } from '../../components/ErrorState/ErrorState.js';
import { createHeroCarousel } from '../../components/HeroCarousel/HeroCarousel.js';
import { renderPosterRow } from '../../components/PosterRow/PosterRow.js';
import { boot } from '../../scripts/app.js';
import { h } from '../../scripts/core/dom.js';
import { debounce, on } from '../../scripts/core/events.js';
import { hydrate } from '../../scripts/core/template.js';
import { matchesRepo, teamsRepo } from '../../scripts/data/index.js';
import { getLanguage, onLanguageChange } from '../../scripts/i18n/i18n.js';
import { startLiveTicker } from '../../scripts/services/live-ticker.js';
import { renderTeamsStrip } from './teams-strip.js';
import { renderWhyPhoto } from './why.js';

await boot({ page: 'home' });

const el = {
  hero: document.getElementById('hero'),
  live: document.getElementById('live-row'),
  upcoming: document.getElementById('upcoming-row'),
  why: document.getElementById('why-media'),
  teams: document.getElementById('teams-strip'),
};
let data = null;
let rendered = '';

// Live first, then upcoming matches that have a background image, then the rest, soonest first.
function featured(live, upcoming) {
  return [...live, ...upcoming.filter((m) => m.backdrop_url), ...upcoming.filter((m) => !m.backdrop_url)].slice(0, 4);
}

// Only what is visible, so background updates that change nothing on screen don't re-render.
function signature(matches, teams) {
  const m = matches.map((x) => [x.id, x.status, x.home_score, x.away_score, x.live_minute, x.poster_url, x.backdrop_url,
    x.home_team.logo_url, x.away_team.logo_url, x.tickets_left > 0]);
  return JSON.stringify([getLanguage(), m, teams.map((t) => [t.id, t.logo_url, t.match_count])]);
}

function renderHero(matches) {
  if (!matches.length) {
    const action = hydrate(h('a', { class: 'btn btn--primary', 'data-route': 'tickets', 'data-i18n': 'nav.buyTickets' }));
    el.hero.replaceChildren(createEmptyState({ icon: 'calendar', titleKey: 'home.hero.emptyTitle', textKey: 'home.hero.emptyText', action }));
  } else {
    const start = Number(el.hero.querySelector('.hero')?.dataset.index ?? 0);
    el.hero.replaceChildren(createHeroCarousel(matches, { start }));
  }
  el.hero.removeAttribute('aria-busy');
}

function render() {
  const { matches, teams } = data;
  const key = signature(matches, teams);
  if (key === rendered) return;
  rendered = key;

  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches.filter((m) => m.status === 'upcoming');
  document.querySelector('.home__live-dot').hidden = !live.length;
  renderHero(featured(live, upcoming));
  const seeUpcoming = hydrate(h('a', { class: 'btn btn--secondary', href: '#upcoming', 'data-i18n': 'home.live.emptyAction' }));
  renderPosterRow(el.live, live, {
    empty: createEmptyState({ icon: 'radio', titleKey: 'home.live.emptyTitle', textKey: 'home.live.emptyText', action: seeUpcoming, compact: true }),
  });
  renderPosterRow(el.upcoming, upcoming.slice(0, 12), {
    empty: createEmptyState({ icon: 'calendar', titleKey: 'home.upcoming.emptyTitle', compact: true }),
  });
  renderTeamsStrip(el.teams, teams);
  renderWhyPhoto(el.why, featured(live, upcoming)).catch(() => {});
}

async function load() {
  try {
    const [matches, teams] = await Promise.all([
      matchesRepo.list({ status: ['live', 'upcoming'] }),
      teamsRepo.list(),
    ]);
    data = { matches, teams };
    render();
  } catch (error) {
    if (data) return;
    const retry = () => load();
    for (const target of [el.hero, el.live, el.upcoming]) {
      target.removeAttribute('aria-busy');
      target.replaceChildren(createErrorState({ error, onRetry: retry }));
    }
  }
}

await load();
on('data:updated', debounce(load, 1200));
onLanguageChange(() => data && render());
startLiveTicker({ poll: () => matchesRepo.pollLive().then(load) });
