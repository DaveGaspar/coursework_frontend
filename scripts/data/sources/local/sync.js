// Imports fixtures from the public APIs. Safe to re-run: rows are matched by external key, admin edits are kept
// and deleted rows are never restored.
import { IMPORT_WINDOW, LEAGUES, TTL, currentSeason } from '../../../core/config.js';
import { clearCache } from '../../../core/cache.js';
import { emit } from '../../../core/events.js';
import * as oldb from '../external/openligadb.js';
import * as tsdb from '../external/thesportsdb.js';
import { pageSummary } from '../external/wikipedia.js';
import { OLDB_TO_TSDB } from '../external/team-map.js';
import { extKey, mapOldbMatch, mapOldbTeam, mapTsdbEvent, mapTsdbEventTeam, mapTsdbTeam } from '../external/mappers.js';
import { finishedFigures, ticketTerms } from './business-data.js';
import { db } from './local-db.js';

const { PRIORITY } = tsdb;
const leagueByKey = (key) => LEAGUES.find((l) => l.key === key);
const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

export function editable(row, column) {
  return !(row._edited ?? []).includes(column);
}

function applyPatch(table, row, patch) {
  const allowed = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && editable(row, key) && row[key] !== value) allowed[key] = value;
  }
  return Object.keys(allowed).length ? db.update(table, row.id, allowed) : row;
}

function upsertTeam({ fields, ext }) {
  const tsdbId = ext.tsdb ?? (ext.oldb != null ? OLDB_TO_TSDB[ext.oldb] ?? null : null);
  const keys = [tsdbId && extKey('tsdbteam', tsdbId), ext.oldb != null && extKey('oldbteam', ext.oldb)].filter(Boolean);
  if (keys.some((k) => db.isTombstoned(k))) return null;
  const existing = db.find('teams', (t) => (tsdbId && t._ext?.tsdb === String(tsdbId)) || (ext.oldb != null && t._ext?.oldb === ext.oldb));
  if (!existing) {
    return db.insert('teams', {
      name: fields.name, coach_name: null, logo_url: fields.logo_url ?? null,
      _ext: { ...ext, keys, tsdb: tsdbId ? String(tsdbId) : null, oldb: ext.oldb ?? null }, _edited: [],
    });
  }
  const mergedExt = { ...existing._ext, keys: [...new Set([...(existing._ext?.keys ?? []), ...keys])] };
  if (tsdbId && !existing._ext?.tsdb) mergedExt.tsdb = String(tsdbId);
  if (ext.oldb != null && existing._ext?.oldb == null) Object.assign(mergedExt, { oldb: ext.oldb, shortName: ext.shortName ?? null });
  const patch = { _ext: mergedExt };
  if (!existing.logo_url && fields.logo_url && editable(existing, 'logo_url')) patch.logo_url = fields.logo_url;
  return db.update('teams', existing.id, patch);
}

function fillFinished(match) {
  if (match.status !== 'finished') return;
  const league = leagueByKey(match._ext?.league);
  const figures = finishedFigures(match._ext?.key ?? `local:${match.id}`, {
    tier: league?.tier ?? 2,
    capacity: match.ticket_capacity,
    price: match.ticket_price,
    realAttendance: match._ext?.spectators ?? match._ext?.viewers ?? null,
    stats: match._ext?.stats ?? {},
  });
  applyPatch('matches', match, figures);
}

function importMatch(league, { fields, ext }, homeMapped, awayMapped) {
  if (!fields.scheduled_at || db.isTombstoned(ext.key)) return null;
  const home = upsertTeam(homeMapped);
  const away = upsertTeam(awayMapped);
  if (!home || !away) return null;

  const existing = db.find('matches', (m) => m._ext?.key === ext.key);
  if (existing) {
    const patch = { ...fields, home_team_id: home.id, away_team_id: away.id };
    if (!patch.venue && !existing.venue && home._ext?.venue) patch.venue = home._ext.venue;
    applyPatch('matches', existing, patch);
    const merged = db.update('matches', existing.id, { _ext: { ...existing._ext, ...ext, goals: ext.goals ?? existing._ext?.goals ?? [] } });
    fillFinished(merged);
    return existing.id;
  }

  const terms = ticketTerms(ext.key, league.tier, home._ext?.capacity ?? null);
  const inserted = db.insert('matches', {
    home_team_id: home.id,
    away_team_id: away.id,
    venue: fields.venue ?? home._ext?.venue ?? null,
    scheduled_at: fields.scheduled_at,
    status: fields.status,
    league: fields.league,
    stream_url: null,
    home_score: fields.home_score ?? null,
    away_score: fields.away_score ?? null,
    attendance: null,
    total_fouls: null,
    yellow_cards: null,
    red_cards: null,
    revenue_tickets: null,
    revenue_merchandise: null,
    revenue_sponsorship: null,
    revenue_concessions: null,
    ticket_price: terms.ticket_price,
    ticket_capacity: terms.ticket_capacity,
    referee: fields.referee ?? null,
    poster_url: fields.poster_url ?? null,
    _ext: { ...ext, capacitySource: terms.capacitySource },
    _edited: [],
  });
  fillFinished(inserted);
  return inserted.id;
}

async function roundsFor(league, force) {
  if (league.source === 'openligadb') {
    const current = (await oldb.currentMatchday(league.shortcut, { force })) ?? 1;
    return range(current - (IMPORT_WINDOW.past - 1), current + IMPORT_WINDOW.next).filter((r) => r >= 1 && r <= 34);
  }
  const [last, next] = await Promise.all([
    tsdb.lastLeagueEvent(league.leagueId, { force }),
    tsdb.nextLeagueEvent(league.leagueId, { force }),
  ]);
  const lastRound = last?.intRound ?? Math.max(1, (next?.intRound ?? 2) - 1);
  const nextRound = next?.intRound ?? lastRound + 1;
  const rounds = new Set([
    ...range(lastRound - (IMPORT_WINDOW.past - 1), lastRound),
    ...range(nextRound, nextRound + IMPORT_WINDOW.next - 1),
  ]);
  return [...rounds].filter((r) => r >= 1 && r <= league.roundsPerSeason).sort((a, b) => a - b);
}

async function fetchRound(league, round, { force = false, live = false, priority = PRIORITY.normal } = {}) {
  const season = currentSeason();
  if (league.source === 'openligadb') {
    const list = await oldb.matchday(league.shortcut, season.openLigaDb, round, { force, live });
    return list.map((m) => ({ mapped: mapOldbMatch(m, league), home: mapOldbTeam(m.team1), away: mapOldbTeam(m.team2) }));
  }
  let events = await tsdb.eventsRound(league.leagueId, round, season.theSportsDb, { force, priority });
  if (league.leaguePhaseFromMonth != null) {
    // UCL rounds 1–8 also contain the summer qualifiers; keep the league phase only.
    const phaseStart = Date.UTC(season.startYear, league.leaguePhaseFromMonth, 1);
    events = events.filter((e) => Date.parse(`${e.dateEvent}T00:00:00Z`) >= phaseStart);
  }
  return events.map((e) => ({ mapped: mapTsdbEvent(e, league), home: mapTsdbEventTeam(e, 'home'), away: mapTsdbEventTeam(e, 'away') }));
}

export async function syncLeague(league, { force = false } = {}) {
  const meta = db.meta();
  if (!force && Date.now() - (meta.synced[league.key] ?? 0) < TTL.fixtures) return { league: league.key, count: 0, skipped: true };
  const rounds = await roundsFor(league, force);
  let count = 0;
  for (const round of rounds) {
    const items = await fetchRound(league, round, { force });
    for (const item of items) if (importMatch(league, item.mapped, item.home, item.away)) count += 1;
    emit('sync:progress', { league: league.key, count });
  }
  meta.synced[league.key] = Date.now();
  db.saveMeta();
  return { league: league.key, count };
}

let running = null;
const RETRY_DELAYS_MS = [45_000, 120_000, 300_000];

function retryLater(league, attempt = 0) {
  if (attempt >= RETRY_DELAYS_MS.length) return;
  setTimeout(() => {
    syncLeague(league, { force: true })
      .then(() => scheduleEnrichment())
      .catch(() => retryLater(league, attempt + 1));
  }, RETRY_DELAYS_MS[attempt]);
}

export function syncAll({ force = false } = {}) {
  if (running && !force) return running;
  running = (async () => {
    const settled = await Promise.allSettled(LEAGUES.map((league) => syncLeague(league, { force })));
    scheduleEnrichment();
    settled.forEach((r, i) => { if (r.status === 'rejected') retryLater(LEAGUES[i]); });
    return settled.map((r, i) => ({ league: LEAGUES[i].key, ok: r.status === 'fulfilled', count: r.status === 'fulfilled' ? r.value.count : 0 }));
  })().finally(() => { running = null; });
  return running;
}

export async function refreshFromSources() {
  clearCache('oldb:');
  clearCache('tsdb:events');
  clearCache('tsdb:lookupevent');
  return syncAll({ force: true });
}

let lastLiveRefresh = 0;

export async function refreshLive({ force = false } = {}) {
  if (!force && Date.now() - lastLiveRefresh < TTL.live) return;
  lastLiveRefresh = Date.now();
  const now = Date.now();
  const due = db.filter('matches', (m) => m._ext?.source && editable(m, 'status')
    && (m.status === 'live' || (m.status === 'upcoming' && Date.parse(m.scheduled_at) <= now)));
  const rounds = new Map();
  for (const m of due) rounds.set(`${m._ext.league}|${m._ext.round}`, { league: leagueByKey(m._ext.league), round: m._ext.round });
  await Promise.allSettled([...rounds.values()].filter((r) => r.league && r.round).map(async ({ league, round }) => {
    const items = await fetchRound(league, round, { force: true, live: true, priority: PRIORITY.visible });
    for (const item of items) importMatch(league, item.mapped, item.home, item.away);
  }));
}

function timelineGoals(timeline) {
  const score = { home: 0, away: 0 };
  return timeline
    .filter((x) => x.type === 'goal')
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
    .map((g) => {
      const team = g.ownGoal ? (g.home ? 'away' : 'home') : (g.home ? 'home' : 'away');
      score[team] += 1;
      return { minute: g.minute, scorer: g.player, team, home_score: score.home, away_score: score.away, is_penalty: g.penalty, is_own_goal: g.ownGoal };
    });
}

export async function refreshMatch(matchId, { live = false } = {}) {
  const match = db.get('matches', matchId);
  const league = leagueByKey(match?._ext?.league);
  if (!match || !league) return;
  if (match._ext.source === 'oldb') {
    const raw = await oldb.match(match._ext.id, { force: live });
    if (raw) importMatch(league, mapOldbMatch(raw, league), mapOldbTeam(raw.team1), mapOldbTeam(raw.team2));
    return;
  }
  const event = await tsdb.lookupEvent(match._ext.id, { live, force: live });
  if (event) importMatch(league, mapTsdbEvent(event, league), mapTsdbEventTeam(event, 'home'), mapTsdbEventTeam(event, 'away'));
  const current = db.get('matches', matchId);
  if (!current || current.status === 'upcoming' || (current._ext.timelineAt && !live)) return;
  const timeline = await tsdb.eventTimeline(current._ext.id, { live });
  const stats = {
    ...(current._ext.stats ?? {}),
    yellow: timeline.filter((x) => x.type === 'yellow').length,
    red: timeline.filter((x) => x.type === 'red').length,
  };
  const updated = db.update('matches', matchId, { _ext: { ...current._ext, goals: timelineGoals(timeline), stats, timelineAt: Date.now() } });
  fillFinished(updated);
}

export async function enrichTeam(teamId, priority = PRIORITY.background) {
  let team = db.get('teams', teamId);
  if (!team) return null;
  if (team._ext?.enrichedAt && Date.now() - team._ext.enrichedAt < TTL.teams) return team;
  let tsdbId = team._ext?.tsdb;
  if (!tsdbId && team._ext?.oldb != null) {
    tsdbId = OLDB_TO_TSDB[team._ext.oldb] ?? (await tsdb.searchSoccerTeam(team._ext.shortName ?? team.name, 'Germany', { priority }).catch(() => null))?.idTeam;
  }
  const details = tsdbId ? await tsdb.lookupTeam(tsdbId, { priority }).catch(() => null) : null;
  team = db.get('teams', teamId);
  if (!team) return null;
  if (!details) {
    return db.update('teams', teamId, { _ext: { ...team._ext, enrichedAt: Date.now() } });
  }
  const mapped = mapTsdbTeam(details);
  // lookupteam has no capacity on the free tier; the venue lookup has it (plus stadium photos).
  const venue = details.idVenue ? await tsdb.lookupVenue(details.idVenue, { priority }).catch(() => null) : null;
  if (venue?.intCapacity) mapped.ext.capacity = venue.intCapacity;
  const photo = venue?.strThumb ?? venue?.strFanart1 ?? null;
  if (photo) Object.assign(mapped.ext, { venueImage: { url: photo, credit: { label: 'TheSportsDB', url: 'https://www.thesportsdb.com' } }, venueImageAt: Date.now() });
  team = db.get('teams', teamId);
  if (!team) return null;
  const patch = { _ext: { ...team._ext, ...mapped.ext, enrichedAt: Date.now() } };
  if (mapped.fields.logo_url && editable(team, 'logo_url')) patch.logo_url = mapped.fields.logo_url;
  team = db.update('teams', teamId, patch);

  for (const m of db.filter('matches', (x) => x.home_team_id === teamId)) {
    const p = {};
    if (!m.venue && mapped.ext.venue) p.venue = mapped.ext.venue;
    if (m._ext?.capacitySource === 'default' && mapped.ext.capacity && editable(m, 'ticket_capacity')) p.ticket_capacity = mapped.ext.capacity;
    if (!Object.keys(p).length) continue;
    const updated = applyPatch('matches', m, p);
    if (p.ticket_capacity) fillFinished(db.update('matches', m.id, { _ext: { ...updated._ext, capacitySource: 'venue' } }));
  }
  return team;
}

export function scheduleEnrichment() {
  const now = Date.now();
  const rank = (m) => (m.status === 'live' ? 0 : m.status === 'upcoming' ? 1 + (Date.parse(m.scheduled_at) - now) / 1e12 : 3);
  const order = [];
  for (const m of db.all('matches').sort((a, b) => rank(a) - rank(b))) order.push(m.home_team_id, m.away_team_id);
  for (const t of db.all('teams')) order.push(t.id);
  [...new Set(order)].forEach((teamId, index) => {
    enrichTeam(teamId, index < 16 ? PRIORITY.normal : PRIORITY.background).catch(() => {});
  });
}

export async function ensureRoster(teamId, priority = PRIORITY.visible) {
  const team = db.get('teams', teamId);
  if (!team || team._ext?.rosterAt || !team._ext) return;
  const enriched = await enrichTeam(teamId, priority);
  const tsdbId = enriched?._ext?.tsdb;
  const squad = tsdbId ? await tsdb.teamSquad(tsdbId, { priority }).catch(() => null) : null;
  const current = db.get('teams', teamId);
  if (!current) return;
  if (squad) {
    for (const p of squad.players) {
      const key = extKey('tsdbplayer', p.idPlayer);
      if (db.isTombstoned(key) || db.find('players', (x) => x._ext?.key === key)) continue;
      db.insert('players', {
        team_id: teamId, full_name: p.name, position: p.position, jersey_number: p.number,
        _ext: { key, cutout: p.cutout }, _edited: [],
      });
    }
  }
  const patch = { _ext: { ...current._ext, rosterAt: squad ? Date.now() : null } };
  if (squad?.coach && !current.coach_name && editable(current, 'coach_name')) patch.coach_name = squad.coach;
  db.update('teams', teamId, patch);
}

export async function venueImage(match) {
  const home = db.get('teams', match.home_team_id);
  if (home?._ext?.venueImageAt && Date.now() - home._ext.venueImageAt < TTL.venue) return home._ext.venueImage ?? null;
  let image = null;
  const venueId = match._ext?.venueId ?? home?._ext?.venueId;
  if (venueId) {
    const venue = await tsdb.lookupVenue(venueId, { priority: PRIORITY.visible }).catch(() => null);
    const url = venue?.strThumb ?? venue?.strFanart1;
    if (url) image = { url, credit: { label: 'TheSportsDB', url: 'https://www.thesportsdb.com' } };
  }
  const venueName = match.venue ?? home?._ext?.venue;
  if (!image && venueName) {
    const summary = await pageSummary(venueName).catch(() => null);
    if (summary?.image) image = { url: summary.image, credit: { label: 'Wikimedia Commons', url: summary.filePage ?? summary.pageUrl } };
  }
  if (home) db.update('teams', home.id, { _ext: { ...db.get('teams', home.id)._ext, venueImage: image, venueImageAt: Date.now() } });
  return image;
}
