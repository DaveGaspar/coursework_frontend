import { h } from '../../scripts/core/dom.js';
import { routeTo } from '../../scripts/core/url.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';
import { createTeamLogo } from '../../components/TeamLogo/TeamLogo.js';

const MAX_TEAMS = 18;

// Grayscale badges that turn to colour on hover; each links to that team's matches in Buy tickets.
export function renderTeamsStrip(list, teams) {
  const shown = teams
    .filter((team) => team.logo_url && team.match_count > 0)
    .sort((a, b) => b.match_count - a.match_count || a.name.localeCompare(b.name))
    .slice(0, MAX_TEAMS);
  list.replaceChildren(...shown.map((team) => h('li', null, h('a', {
    class: 'teams-strip__link',
    href: routeTo('tickets', { q: team.name }),
    'data-i18n-attr': 'aria-label:home.teams.link',
    'data-i18n-params': JSON.stringify({ team: team.name }),
  }, createTeamLogo(team, { size: 'lg', decorative: true })))));
  list.removeAttribute('aria-busy');
  applyTranslations(list);
}
