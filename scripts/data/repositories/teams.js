import { ValidationError } from '../../core/errors.js';
import { validateOptionalUrl } from '../../core/validators.js';
import { db } from '../sources/local/local-db.js';
import { whenMatchesAvailable } from '../sources/local/seed.js';
import { ensureRoster } from '../sources/local/sync.js';
import { shortName } from '../sources/external/mappers.js';
import { latency, markEdited, mustGet, requireAdmin, stripHidden } from './helpers.js';

const byNumber = (a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || a.full_name.localeCompare(b.full_name);

function toTeam(row, { players = null } = {}) {
  const matches = db.filter('matches', (m) => m.home_team_id === row.id || m.away_team_id === row.id);
  const team = {
    ...stripHidden(row),
    short_name: shortName(row),
    venue: row._ext?.venue ?? null,
    leagues: [...new Set(matches.map((m) => m.league))].sort(),
    player_count: db.filter('players', (p) => p.team_id === row.id).length,
    match_count: matches.length,
  };
  if (players) team.players = players;
  return team;
}

function clean(input) {
  const out = {};
  const fields = {};
  if ('name' in input) {
    out.name = String(input.name ?? '').trim();
    if (!out.name) fields.name = 'validation.required';
    else if (out.name.length > 100) fields.name = 'validation.tooLong';
  }
  if ('coach_name' in input) out.coach_name = String(input.coach_name ?? '').trim() || null;
  if ('logo_url' in input) {
    out.logo_url = String(input.logo_url ?? '').trim() || null;
    const error = validateOptionalUrl(out.logo_url);
    if (error) fields.logo_url = error;
  }
  if (Object.keys(fields).length) throw new ValidationError('Invalid team', { fields });
  return out;
}

export const teamsRepo = {
  async list({ withPlayers = false } = {}) {
    await whenMatchesAvailable();
    const players = withPlayers ? db.all('players').map(stripHidden) : [];
    return db.all('teams')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => toTeam(t, withPlayers ? { players: players.filter((p) => p.team_id === t.id).sort(byNumber) } : {}));
  },

  async get(id, { withPlayers = false } = {}) {
    const row = mustGet('teams', id);
    if (withPlayers) await ensureRoster(row.id).catch(() => {});
    const players = withPlayers ? db.filter('players', (p) => p.team_id === row.id).map(stripHidden).sort(byNumber) : null;
    return toTeam(mustGet('teams', id), { players });
  },

  async create(data) {
    requireAdmin();
    const values = clean({ name: data.name, coach_name: data.coach_name, logo_url: data.logo_url });
    const row = db.insert('teams', { coach_name: null, logo_url: null, ...values, _ext: null, _edited: Object.keys(values) });
    await latency();
    return toTeam(row, { players: [] });
  },

  async update(id, data) {
    requireAdmin();
    const existing = mustGet('teams', id);
    const values = clean(data);
    const row = db.update('teams', existing.id, { ...values, _edited: markEdited(existing, values) });
    await latency();
    return toTeam(row);
  },

  async remove(id) {
    requireAdmin();
    const team = mustGet('teams', id);
    const players = db.removeWhere('players', (p) => p.team_id === team.id);
    const matches = db.removeWhere('matches', (m) => m.home_team_id === team.id || m.away_team_id === team.id);
    const matchIds = new Set(matches.map((m) => m.id));
    const tickets = db.removeWhere('tickets', (t) => matchIds.has(t.match_id));
    db.remove('teams', team.id);
    for (const key of team._ext?.keys ?? []) db.addTombstone(key);
    for (const m of matches) db.addTombstone(m._ext?.key ?? null);
    for (const p of players) db.addTombstone(p._ext?.key ?? null);
    await latency();
    return { deleted_players: players.length, deleted_matches: matches.length, deleted_tickets: tickets.length };
  },
};
