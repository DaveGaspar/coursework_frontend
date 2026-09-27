// The free tier sometimes returns unrelated sample data, so every response is filtered by the requested id.
import { API, TSDB_REQUESTS_PER_MINUTE, TTL } from '../../../core/config.js';
import { cached } from '../../../core/cache.js';
import { NetworkError, RateLimitError } from '../../../core/errors.js';
import { getJSON, withQuery } from '../../../core/http.js';
import { createRequestQueue } from './request-queue.js';

const queue = createRequestQueue({ perMinute: TSDB_REQUESTS_PER_MINUTE, storageKey: 'sl:tsdb:requests' });

export const PRIORITY = { background: 0, normal: 5, visible: 10 };

const BACKOFF_MS = 30_000;

function call(endpoint, params, { ttl, priority = PRIORITY.normal, force = false }, pick) {
  const url = withQuery(`${API.theSportsDb}/${endpoint}`, params);
  const key = `tsdb:${endpoint}?${new URLSearchParams(params)}`;
  const task = async () => {
    try {
      return pick(await getJSON(url, { retries: 0 }));
    } catch (err) {
      if (err instanceof NetworkError || err instanceof RateLimitError) queue.pause(BACKOFF_MS);
      throw err;
    }
  };
  queue.promote(url, priority);
  return cached(key, ttl, () => queue.schedule(url, task, { priority }), { force });
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function pickEvent(e) {
  return {
    idEvent: str(e.idEvent), idLeague: str(e.idLeague), strSeason: str(e.strSeason), intRound: int(e.intRound),
    strTimestamp: str(e.strTimestamp), dateEvent: str(e.dateEvent), strTime: str(e.strTime),
    idHomeTeam: str(e.idHomeTeam), idAwayTeam: str(e.idAwayTeam), strHomeTeam: str(e.strHomeTeam), strAwayTeam: str(e.strAwayTeam),
    strHomeTeamBadge: str(e.strHomeTeamBadge), strAwayTeamBadge: str(e.strAwayTeamBadge),
    intHomeScore: int(e.intHomeScore), intAwayScore: int(e.intAwayScore), strStatus: str(e.strStatus), strProgress: str(e.strProgress),
    strPostponed: str(e.strPostponed), idVenue: str(e.idVenue), strVenue: str(e.strVenue), intSpectators: int(e.intSpectators),
    strOfficial: str(e.strOfficial), strPoster: str(e.strPoster), strThumb: str(e.strThumb), strVideo: str(e.strVideo),
  };
}

export function eventsRound(leagueId, round, season, options = {}) {
  return call('eventsround.php', { id: leagueId, r: round, s: season }, { ttl: TTL.fixtures, ...options },
    (json) => (json?.events ?? []).filter((e) => str(e.idLeague) === String(leagueId)).map(pickEvent));
}

export function lastLeagueEvent(leagueId, options = {}) {
  return call('eventspastleague.php', { id: leagueId }, { ttl: TTL.fixtures, ...options },
    (json) => (json?.events ?? []).filter((e) => str(e.idLeague) === String(leagueId)).map(pickEvent)[0] ?? null);
}

export function nextLeagueEvent(leagueId, options = {}) {
  return call('eventsnextleague.php', { id: leagueId }, { ttl: TTL.fixtures, ...options },
    (json) => (json?.events ?? []).filter((e) => str(e.idLeague) === String(leagueId)).map(pickEvent)[0] ?? null);
}

export function lookupEvent(eventId, { live = false, ...options } = {}) {
  return call('lookupevent.php', { id: eventId }, { ttl: live ? TTL.live : TTL.fixtures, priority: PRIORITY.visible, ...options },
    (json) => (json?.events ?? []).filter((e) => str(e.idEvent) === String(eventId)).map(pickEvent)[0] ?? null);
}

export function eventTimeline(eventId, { live = false, ...options } = {}) {
  return call('lookuptimeline.php', { id: eventId }, { ttl: live ? TTL.live : TTL.teams, priority: PRIORITY.visible, ...options }, (json) =>
    (json?.timeline ?? [])
      .filter((x) => str(x.idEvent) === String(eventId))
      .map((x) => {
        const kind = str(x.strTimeline)?.toLowerCase() ?? '';
        const detail = str(x.strTimelineDetail)?.toLowerCase() ?? '';
        let type = null;
        if (kind === 'goal') type = 'goal';
        else if (kind === 'card') type = detail.includes('red') ? 'red' : 'yellow';
        return type && {
          type, minute: int(x.intTime), player: str(x.strPlayer), home: str(x.strHome) === 'Yes',
          penalty: detail.includes('penalty'), ownGoal: detail.includes('own'),
        };
      })
      .filter(Boolean));
}

function pickTeam(t) {
  return {
    idTeam: str(t.idTeam), strTeam: str(t.strTeam), strTeamShort: str(t.strTeamShort), strSport: str(t.strSport),
    strCountry: str(t.strCountry), strLeague: str(t.strLeague), strBadge: str(t.strBadge), strFanart1: str(t.strFanart1),
    strColour1: str(t.strColour1), idVenue: str(t.idVenue), strStadium: str(t.strStadium), intStadiumCapacity: int(t.intStadiumCapacity),
    strLocation: str(t.strLocation),
  };
}

export function lookupTeam(teamId, options = {}) {
  return call('lookupteam.php', { id: teamId }, { ttl: TTL.teams, ...options },
    (json) => (json?.teams ?? []).filter((t) => str(t.idTeam) === String(teamId)).map(pickTeam)[0] ?? null);
}

export function searchSoccerTeam(name, country, options = {}) {
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return call('searchteams.php', { t: ascii }, { ttl: TTL.teams, ...options },
    (json) => (json?.teams ?? []).map(pickTeam).find((t) => t.strSport === 'Soccer' && t.strCountry === country) ?? null);
}

const POSITIONS = [
  [/goal ?keeper|keeper/i, 'Goalkeeper'],
  [/back|defen[cs]e|defender|sweeper|libero/i, 'Defender'],
  [/midfield|playmaker/i, 'Midfielder'],
  [/forward|striker|wing|attack|centre-forward|center forward/i, 'Forward'],
];

export function canonicalPosition(position) {
  if (!position) return null;
  for (const [re, value] of POSITIONS) if (re.test(position)) return value;
  return null;
}

export function teamSquad(teamId, options = {}) {
  return call('lookup_all_players.php', { id: teamId }, { ttl: TTL.players, ...options }, (json) => {
    const list = (json?.player ?? []).filter((p) => str(p.idTeam) === String(teamId) && str(p.strSport) !== 'Ice Hockey');
    const manager = list.find((p) => /^(manager|head coach|coach)$/i.test(str(p.strPosition) ?? ''));
    const players = list
      .map((p) => ({
        idPlayer: str(p.idPlayer), name: str(p.strPlayer), position: canonicalPosition(str(p.strPosition)),
        number: int(p.strNumber), cutout: str(p.strCutout),
      }))
      .filter((p) => p.idPlayer && p.name && p.position);
    return { coach: str(manager?.strPlayer), players };
  });
}

export function lookupVenue(venueId, options = {}) {
  return call('lookupvenue.php', { id: venueId }, { ttl: TTL.venue, ...options }, (json) => {
    const v = (json?.venues ?? []).find((x) => str(x.idVenue) === String(venueId));
    return v ? {
      idVenue: str(v.idVenue), strVenue: str(v.strVenue), intCapacity: int(v.intCapacity), strLocation: str(v.strLocation),
      strThumb: str(v.strThumb), strFanart1: str(v.strFanart1), strDescriptionEN: str(v.strDescriptionEN)?.slice(0, 600) ?? null,
    } : null;
  });
}

export function leagueTeams(leagueName) {
  return call('search_all_teams.php', { l: leagueName }, { ttl: TTL.teams, priority: PRIORITY.visible },
    (json) => (json?.teams ?? []).map(pickTeam).filter((t) => t.strSport === 'Soccer' && t.strLeague === leagueName));
}

export function imageSize(url, size) {
  return url && /r2\.thesportsdb\.com|thesportsdb\.com\/images/.test(url) ? `${url}/${size}` : url;
}
