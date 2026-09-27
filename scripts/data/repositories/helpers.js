import { AuthError, NotFoundError } from '../../core/errors.js';
import { readJSON, removeKey, writeJSON } from '../../core/storage.js';
import { liveClock, shortName } from '../sources/external/mappers.js';
import { db } from '../sources/local/local-db.js';

const SESSION_KEY = 'sl:session';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function latency(ms = 250) {
  return delay(ms);
}

export function sessionUserId() {
  return readJSON(SESSION_KEY, null, 'session')?.user_id ?? null;
}

export function startSession(userId) {
  writeJSON(SESSION_KEY, { user_id: userId, started_at: new Date().toISOString() }, 'session');
}

export function endSession() {
  removeKey(SESSION_KEY, 'session');
}

export function requireUser() {
  const id = sessionUserId();
  const user = id ? db.get('users', id) : null;
  if (!user) throw new AuthError('Sign in required', { code: 'unauthorized' });
  return user;
}

export function requireAdmin() {
  const user = requireUser();
  if (user.role !== 'admin') throw new AuthError('Admins only', { code: 'forbidden', status: 403 });
  return user;
}

export function publicUser(row) {
  const { password_hash: _hash, ...rest } = stripHidden(row);
  return rest;
}

export function stripHidden(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) if (!key.startsWith('_')) out[key] = value;
  return out;
}

export function markEdited(row, patch) {
  return [...new Set([...(row?._edited ?? []), ...Object.keys(patch)])];
}

export function mustGet(table, id) {
  const row = db.get(table, Number(id));
  if (!row) throw new NotFoundError(`${table} ${id} not found`);
  return row;
}

export function teamsById() {
  return new Map(db.all('teams').map((t) => [t.id, t]));
}

export function soldByMatch() {
  const sold = new Map();
  for (const t of db.all('tickets')) sold.set(t.match_id, (sold.get(t.match_id) ?? 0) + t.quantity);
  return sold;
}

export function teamSummary(team) {
  if (!team) return { id: 0, name: '', short_name: '?', logo_url: null };
  return { id: team.id, name: team.name, short_name: shortName(team), logo_url: team.logo_url ?? null };
}

export function toMatch(row, { teams = teamsById(), sold = soldByMatch() } = {}) {
  const home = teams.get(row.home_team_id);
  const away = teams.get(row.away_team_id);
  const clock = row.status === 'live' ? liveClock(row.scheduled_at) : { minute: null, period: null };
  const venueImage = home?._ext?.venueImage ?? null;
  return {
    ...stripHidden(row),
    home_team: teamSummary(home),
    away_team: teamSummary(away),
    tickets_left: Math.max(0, (row.ticket_capacity ?? 0) - (sold.get(row.id) ?? 0)),
    goals: row._ext?.goals ?? [],
    live_minute: clock.minute,
    live_period: clock.period,
    highlights_url: row.status === 'finished' ? row._ext?.video ?? null : null,
    backdrop_url: row._ext?.thumb ?? home?._ext?.fanart ?? venueImage?.url ?? null,
    venue_image_url: venueImage?.url ?? null,
    venue_image_credit: venueImage?.credit ?? null,
  };
}

export function looseIncludes(haystack, needle) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return norm(haystack).includes(norm(needle).trim());
}
