import { LEAGUES } from '../../core/config.js';
import { ValidationError } from '../../core/errors.js';
import { toDateInputValue } from '../../core/format.js';
import { validateOptionalUrl } from '../../core/validators.js';
import { db } from '../sources/local/local-db.js';
import { whenMatchesAvailable } from '../sources/local/seed.js';
import { refreshFromSources, refreshLive, refreshMatch, venueImage } from '../sources/local/sync.js';
import { latency, looseIncludes, markEdited, mustGet, requireAdmin, soldByMatch, teamsById, toMatch } from './helpers.js';

const STATUSES = ['upcoming', 'live', 'finished'];
const INT_COLUMNS = ['home_score', 'away_score', 'attendance', 'total_fouls', 'yellow_cards', 'red_cards', 'ticket_capacity'];
const MONEY_COLUMNS = ['ticket_price', 'revenue_tickets', 'revenue_merchandise', 'revenue_sponsorship', 'revenue_concessions'];
const TEXT_COLUMNS = ['venue', 'league', 'stream_url', 'referee', 'poster_url'];
const WRITABLE = ['home_team_id', 'away_team_id', 'scheduled_at', 'status', ...TEXT_COLUMNS, ...INT_COLUMNS, ...MONEY_COLUMNS];

function clean(input, existing = null) {
  const out = {};
  const fields = {};
  for (const key of WRITABLE) {
    if (!(key in input)) continue;
    let value = input[key];
    if (typeof value === 'string') value = value.trim();
    if (value === '' || value === undefined) value = null;
    if (INT_COLUMNS.includes(key) && value !== null) {
      value = Number(value);
      if (!Number.isInteger(value) || value < 0) fields[key] = 'validation.wholeNumber';
    }
    if (MONEY_COLUMNS.includes(key) && value !== null) {
      value = Math.round(Number(value) * 100) / 100;
      if (!Number.isFinite(value) || value < 0) fields[key] = 'validation.money';
    }
    if ((key === 'home_team_id' || key === 'away_team_id') && value !== null) value = Number(value);
    out[key] = value;
  }
  for (const key of ['stream_url', 'poster_url']) {
    const error = key in out ? validateOptionalUrl(out[key]) : null;
    if (error) fields[key] = error;
  }
  const merged = { ...existing, ...out };
  if (!merged.home_team_id || !db.get('teams', merged.home_team_id)) fields.home_team_id = 'validation.required';
  if (!merged.away_team_id || !db.get('teams', merged.away_team_id)) fields.away_team_id = 'validation.required';
  if (merged.home_team_id && merged.home_team_id === merged.away_team_id) fields.away_team_id = 'validation.sameTeams';
  if (!merged.league) fields.league = 'validation.required';
  if (!STATUSES.includes(merged.status)) fields.status = 'validation.required';
  if (!merged.scheduled_at || Number.isNaN(Date.parse(merged.scheduled_at))) fields.scheduled_at = 'validation.dateTime';
  else if ('scheduled_at' in out) out.scheduled_at = new Date(merged.scheduled_at).toISOString();
  if (merged.ticket_price == null) fields.ticket_price = 'validation.required';
  if (merged.ticket_capacity == null) fields.ticket_capacity = 'validation.required';
  if (Object.keys(fields).length) throw new ValidationError('Invalid match', { fields });
  return out;
}

export const matchesRepo = {
  async list({ status, league, date, q, team_id: teamId, limit, sort = 'asc' } = {}) {
    await whenMatchesAvailable();
    refreshLive().catch(() => {});
    const teams = teamsById();
    const sold = soldByMatch();
    const statuses = status ? [].concat(status) : null;
    let rows = db.all('matches')
      .filter((m) => !statuses || statuses.includes(m.status))
      .filter((m) => !league || m.league === league)
      .filter((m) => !date || toDateInputValue(m.scheduled_at) === date)
      .filter((m) => !teamId || m.home_team_id === Number(teamId) || m.away_team_id === Number(teamId))
      .map((m) => toMatch(m, { teams, sold }))
      .filter((m) => !q || looseIncludes(m.home_team.name, q) || looseIncludes(m.away_team.name, q));
    rows.sort((a, b) => (sort === 'desc' ? -1 : 1) * (Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)));
    if (limit) rows = rows.slice(0, limit);
    return rows;
  },

  async get(id, { fresh = false } = {}) {
    await whenMatchesAvailable();
    const row = mustGet('matches', id);
    if (fresh) await refreshMatch(row.id, { live: row.status === 'live' }).catch(() => {});
    await venueImage(db.get('matches', row.id) ?? row).catch(() => null);
    return toMatch(mustGet('matches', id));
  },

  async leagues() {
    await whenMatchesAvailable();
    const names = new Set(LEAGUES.map((l) => l.name));
    for (const m of db.all('matches')) if (m.league) names.add(m.league);
    return [...names].map((name) => ({ name }));
  },

  async create(data) {
    requireAdmin();
    const values = clean(data);
    const row = db.insert('matches', {
      venue: null, stream_url: null, home_score: null, away_score: null, attendance: null, total_fouls: null,
      yellow_cards: null, red_cards: null, revenue_tickets: null, revenue_merchandise: null, revenue_sponsorship: null,
      revenue_concessions: null, referee: null, poster_url: null, ...values, _ext: null, _edited: WRITABLE,
    });
    await latency();
    return toMatch(row);
  },

  async update(id, data) {
    requireAdmin();
    const existing = mustGet('matches', id);
    const values = clean(data, existing);
    const row = db.update('matches', existing.id, { ...values, _edited: markEdited(existing, values) });
    await latency();
    return toMatch(row);
  },

  async remove(id) {
    requireAdmin();
    const existing = mustGet('matches', id);
    const tickets = db.removeWhere('tickets', (t) => t.match_id === existing.id);
    db.remove('matches', existing.id);
    db.addTombstone(existing._ext?.key ?? null);
    await latency();
    return { deleted_tickets: tickets.length };
  },

  async refresh() {
    requireAdmin();
    return { leagues: await refreshFromSources() };
  },

  async pollLive() {
    await refreshLive({ force: true }).catch(() => {});
  },
};
