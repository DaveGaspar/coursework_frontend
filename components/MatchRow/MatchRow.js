import { formatCurrency, formatDate, formatTime } from '../../scripts/core/format.js';
import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';
import { checkoutUrl, matchTitle } from '../../scripts/services/match-display.js';
import { createBadge } from '../Badge/Badge.js';
import { createTeamLogo } from '../TeamLogo/TeamLogo.js';

const use = await loadTemplates(new URL('./MatchRow.html', import.meta.url));
const LOW_STOCK = 0.1;

function teamLabel(slot, team) {
  slot.append(createTeamLogo(team, { size: 'sm', decorative: true }), document.createTextNode(team.name));
}

// Tickets badge: "Sold out", a warning under 10% of seats, otherwise the count.
export function ticketsBadge(match) {
  const left = match.tickets_left;
  if (left <= 0) return createBadge({ kind: 'soldout', key: 'tickets.soldOut' });
  const low = match.ticket_capacity > 0 && left / match.ticket_capacity < LOW_STOCK;
  return createBadge({ kind: low ? 'low' : 'meta', key: 'tickets.left', params: { count: left }, iconName: low ? 'triangle-alert' : null });
}

// One match in the Buy tickets list (as an <li>).
export function createMatchRow(match) {
  const item = use('match-row');
  const ref = refs(item);
  ref.badges.append(createBadge({ kind: 'league', text: match.league }), ticketsBadge(match));
  teamLabel(ref.home, match.home_team);
  teamLabel(ref.away, match.away_team);
  ref.date.dateTime = match.scheduled_at;
  ref.date.textContent = formatDate(match.scheduled_at, 'full');
  ref.time.textContent = formatTime(match.scheduled_at);
  if (match.venue) ref.venue.textContent = match.venue;
  else ref.venueItem.remove();
  ref.price.textContent = formatCurrency(match.ticket_price, { whole: Number.isInteger(match.ticket_price) });

  if (match.tickets_left > 0) {
    ref.buy.href = checkoutUrl(match);
    ref.buy.dataset.i18nAttr = 'aria-label:tickets.buyFor';
    ref.buy.dataset.i18nParams = JSON.stringify({ match: matchTitle(match) });
    ref.soldOut.remove();
  } else {
    ref.buy.remove();
    ref.soldOut.hidden = false;
  }
  return hydrate(item);
}
