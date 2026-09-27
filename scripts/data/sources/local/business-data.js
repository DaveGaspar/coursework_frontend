// Values no public API provides (prices, capacity, revenue split). Seeded by the match id, so they never change
// between loads. Referees are never generated: naming a real referee for a match they did not officiate would be false.
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(key, purpose) {
  return mulberry32(hash(`${key}|${purpose}`));
}

const between = (rng, [min, max]) => min + rng() * (max - min);

export const TIERS = Object.freeze({
  0: { price: [95, 180], capacity: 60000, fill: [0.9, 1], sponsorship: [2_200_000, 3_600_000], merchandise: [12, 22], concessions: [14, 22] },
  1: { price: [60, 150], capacity: 50000, fill: [0.9, 1], sponsorship: [900_000, 1_900_000], merchandise: [8, 16], concessions: [10, 18] },
  2: { price: [35, 95], capacity: 40000, fill: [0.78, 1], sponsorship: [350_000, 900_000], merchandise: [6, 12], concessions: [8, 14] },
  3: { price: [18, 45], capacity: 22000, fill: [0.5, 0.95], sponsorship: [80_000, 260_000], merchandise: [3, 8], concessions: [6, 11] },
});

const tierOf = (tier) => TIERS[tier] ?? TIERS[2];

export function ticketTerms(key, tier, venueCapacity) {
  const t = tierOf(tier);
  const price = Math.round(between(seededRandom(key, 'price'), t.price) / 5) * 5;
  const known = Number.isFinite(venueCapacity) && venueCapacity > 0;
  return { ticket_price: price, ticket_capacity: known ? venueCapacity : t.capacity, capacitySource: known ? 'venue' : 'default' };
}

export function finishedFigures(key, { tier, capacity, price, realAttendance = null, stats = {} }) {
  const t = tierOf(tier);
  const seedKey = `${key}|${realAttendance ?? 'est'}`;
  const attendance = Number.isFinite(realAttendance) && realAttendance > 0
    ? realAttendance
    : Math.min(capacity, Math.round(capacity * between(seededRandom(seedKey, 'fill'), t.fill)));
  const money = (purpose, perHead) => Math.round(attendance * between(seededRandom(seedKey, purpose), perHead));
  const cards = seededRandom(seedKey, 'cards');
  const redRoll = cards();
  return {
    attendance,
    // Ticket revenue is below capacity × face value: season tickets and concessions are discounted.
    revenue_tickets: Math.round(attendance * price * between(seededRandom(seedKey, 'tickets'), [0.72, 0.92])),
    revenue_merchandise: money('merchandise', t.merchandise),
    revenue_concessions: money('concessions', t.concessions),
    revenue_sponsorship: Math.round(between(seededRandom(seedKey, 'sponsorship'), t.sponsorship) / 1000) * 1000,
    total_fouls: stats.fouls ?? Math.round(between(seededRandom(seedKey, 'fouls'), [16, 30])),
    yellow_cards: stats.yellow ?? Math.round(between(cards, [1, 7])),
    red_cards: stats.red ?? (redRoll < 0.1 ? 1 : 0),
  };
}

export const FINISHED_COLUMNS = Object.freeze([
  'attendance', 'revenue_tickets', 'revenue_merchandise', 'revenue_sponsorship', 'revenue_concessions',
  'total_fouls', 'yellow_cards', 'red_cards',
]);
