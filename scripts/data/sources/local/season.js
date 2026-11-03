// This season's fixtures, teams, squads and pictures, saved with the site by tools/build-season.ps1.
// They fill the site straight away and stand in for the public APIs whenever those do not answer.
import { IMPORT_WINDOW } from '../../../core/config.js';
import { mapOldbMatch, mapOldbTeam, mapTsdbEvent, mapTsdbEventTeam, tsdbKickoff } from '../external/mappers.js';
import { pickMatch } from '../external/openligadb.js';
import { pickEvent, pickSquad, pickTeam, pickVenue } from '../external/thesportsdb.js';

const ROOT = new URL('../../../../', import.meta.url);
let loading = null;
let images = new Map();
let teams = new Map();

export function loadSeason() {
  loading ??= fetch(new URL('assets/data/season.json', ROOT))
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((data) => {
      images = new Map(Object.entries(data?.images ?? {}));
      teams = new Map(Object.entries(data?.teams ?? {}));
      return data;
    });
  return loading;
}

// The site's own copy of a picture from the public APIs, when it has one.
export function localImage(url) {
  const path = url ? images.get(url) : null;
  return path ? new URL(path, ROOT).href : url;
}

export function savedTeam(tsdbId) {
  const raw = tsdbId ? teams.get(String(tsdbId)) : null;
  if (!raw) return null;
  return { details: pickTeam(raw), venue: pickVenue(raw.venue), squad: raw.squad?.length ? pickSquad(raw.squad, raw.idTeam) : null };
}

function savedItems(league, rows, now) {
  if (league.source === 'openligadb') {
    return rows.map(pickMatch).map((m) => ({
      round: m.group?.groupOrderID, kickoff: Date.parse(m.matchDateTimeUTC), done: m.matchIsFinished,
      mapped: mapOldbMatch(m, league, now), home: mapOldbTeam(m.team1), away: mapOldbTeam(m.team2),
    }));
  }
  return rows.map(pickEvent).map((e) => ({
    round: e.intRound, kickoff: Date.parse(tsdbKickoff(e) ?? ''), done: e.intHomeScore !== null && e.intAwayScore !== null,
    mapped: mapTsdbEvent(e, league, now), home: mapTsdbEventTeam(e, 'home'), away: mapTsdbEventTeam(e, 'away'),
  }));
}

// The same rounds the live import takes: the last ones with results and the next ones still to come.
// Matches that kicked off after the copy was saved have no result in it, so they are left out.
export function savedMatches(league, data, now = Date.now()) {
  const known = savedItems(league, data?.leagues?.[league.key] ?? [], now).filter((x) => x.done || x.kickoff > now);
  const rounds = (list, dir) => [...new Set(list.sort((a, b) => dir * (a.kickoff - b.kickoff)).map((x) => x.round))];
  const wanted = new Set([
    ...rounds(known.filter((x) => x.done), -1).slice(0, IMPORT_WINDOW.past),
    ...rounds(known.filter((x) => !x.done), 1).slice(0, IMPORT_WINDOW.next),
  ]);
  return known.filter((x) => wanted.has(x.round));
}
