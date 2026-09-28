import { ValidationError } from '../../core/errors.js';
import { db } from '../sources/local/local-db.js';
import { checkNewCard, storeCard } from './cards.js';
import { latency, mustGet, requireUser, soldByMatch, stripHidden, teamsById, toMatch } from './helpers.js';

export const MAX_TICKETS_PER_ORDER = 10;

// Stadium zones; the match's ticket_price is the cheapest (behind the goal).
export const SEAT_ZONES = [
  { id: 'goal', multiplier: 1 },
  { id: 'side', multiplier: 1.5 },
  { id: 'main', multiplier: 2 },
  { id: 'vip', multiplier: 4 },
];

export function zonePrice(basePrice, zoneId) {
  const zone = SEAT_ZONES.find((z) => z.id === zoneId) ?? SEAT_ZONES[0];
  return Math.round(basePrice * zone.multiplier * 100) / 100;
}

export const ticketsRepo = {
  async buy({ match_id: matchId, quantity, zone = SEAT_ZONES[0].id, card }) {
    const user = requireUser();
    const match = mustGet('matches', matchId);
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_TICKETS_PER_ORDER) {
      throw new ValidationError('Invalid quantity', { fields: { quantity: 'validation.quantity' } });
    }
    if (!SEAT_ZONES.some((z) => z.id === zone)) throw new ValidationError('Invalid zone', { fields: { zone: 'validation.required' } });
    if (match.status !== 'upcoming') throw new ValidationError('Match not on sale', { code: 'match_not_on_sale' });
    const left = match.ticket_capacity - (soldByMatch().get(match.id) ?? 0);
    if (qty > left) throw new ValidationError('Not enough tickets', { code: 'not_enough_tickets', fields: { quantity: 'validation.notEnoughTickets' } });

    let used;
    if (card && 'saved_card_id' in card) {
      used = db.find('payment_cards', (c) => c.id === Number(card.saved_card_id) && c.user_id === user.id);
      if (!used) throw new ValidationError('Unknown card', { fields: { card: 'validation.cardChoose' } });
    } else {
      const safe = checkNewCard(card);
      used = card.save ? storeCard(user.id, safe) : safe;
    }

    await latency(900);
    const price = zonePrice(match.ticket_price, zone);
    const ticket = db.insert('tickets', {
      match_id: match.id,
      user_id: user.id,
      quantity: qty,
      seat_zone: zone,
      price_per_ticket: price,
      purchased_at: new Date().toISOString(),
    });
    return {
      ticket: stripHidden(ticket),
      match: toMatch(db.get('matches', match.id)),
      total: Math.round(qty * price * 100) / 100,
      card: { brand: used.brand, card_last_four: used.card_last_four },
    };
  },

  async mine() {
    const user = requireUser();
    const teams = teamsById();
    const sold = soldByMatch();
    const rank = { live: 0, upcoming: 1, finished: 2 };
    return db.filter('tickets', (t) => t.user_id === user.id)
      .map((t) => {
        const match = db.get('matches', t.match_id);
        return match ? { ...stripHidden(t), match: toMatch(match, { teams, sold }) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => rank[a.match.status] - rank[b.match.status]
        || (a.match.status === 'finished' ? -1 : 1) * (Date.parse(a.match.scheduled_at) - Date.parse(b.match.scheduled_at)));
  },
};
