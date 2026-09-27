const MINUTE = 60_000;
// OpenLigaDB has no match clock: no final result 150 min after kickoff means it is over.
const MAX_MATCH_MS = 150 * MINUTE;

export function extKey(source, id) {
  return `${source}:${id}`;
}

export function toUtcIso(value) {
  if (!value) return null;
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function oldbStatus(m, now = Date.now()) {
  if (m.matchIsFinished) return 'finished';
  const kickoff = Date.parse(m.matchDateTimeUTC);
  if (!Number.isFinite(kickoff) || now < kickoff) return 'upcoming';
  return now - kickoff > MAX_MATCH_MS ? 'finished' : 'live';
}

export function oldbScore(m, status) {
  const final = m.results.find((r) => r.typeId === 2) ?? [...m.results].sort((a, b) => b.order - a.order)[0];
  if (final && (status === 'finished' || !m.goals.length)) return { home: final.home, away: final.away };
  const lastGoal = m.goals[m.goals.length - 1];
  if (lastGoal) return { home: lastGoal.home, away: lastGoal.away };
  return status === 'upcoming' ? { home: null, away: null } : { home: 0, away: 0 };
}

export function oldbGoals(m) {
  let prev = { home: 0, away: 0 };
  return m.goals.map((g) => {
    const team = g.home > prev.home ? 'home' : 'away';
    prev = { home: g.home, away: g.away };
    return { minute: g.minute, scorer: g.scorer, team, home_score: g.home, away_score: g.away, is_penalty: g.penalty, is_own_goal: g.ownGoal };
  });
}

export function mapOldbMatch(m, league, now = Date.now()) {
  const status = oldbStatus(m, now);
  const score = oldbScore(m, status);
  return {
    fields: {
      scheduled_at: toUtcIso(m.matchDateTimeUTC),
      status,
      league: league.name,
      home_score: score.home,
      away_score: score.away,
      ...(m.location?.stadium ? { venue: m.location.stadium } : {}),
    },
    ext: {
      key: extKey('oldb', m.matchID), source: 'oldb', id: m.matchID, league: league.key,
      round: m.group?.groupOrderID ?? null, goals: oldbGoals(m), viewers: m.viewers ?? null,
    },
  };
}

export function mapOldbTeam(team) {
  return {
    fields: { name: team.teamName, logo_url: team.teamIconUrl || null },
    ext: { oldb: team.teamId, shortName: team.shortName || null, country: 'Germany' },
  };
}

const TSDB_FINISHED = new Set(['FT', 'AET', 'PEN', 'AP', 'AOT', 'MATCH FINISHED', 'FINISHED']);
const TSDB_LIVE = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'IN PLAY']);

export function tsdbKickoff(e) {
  return toUtcIso(e.strTimestamp ?? (e.dateEvent ? `${e.dateEvent}T${e.strTime ?? '00:00:00'}` : null));
}

export function tsdbStatus(e, now = Date.now()) {
  const status = (e.strStatus ?? '').toUpperCase();
  if (TSDB_FINISHED.has(status)) return 'finished';
  if (TSDB_LIVE.has(status)) return 'live';
  const kickoff = Date.parse(tsdbKickoff(e) ?? '');
  if (!Number.isFinite(kickoff) || now < kickoff || e.strPostponed === 'yes') return 'upcoming';
  return now - kickoff > MAX_MATCH_MS ? 'finished' : 'live';
}

export function mapTsdbEvent(e, league, now = Date.now()) {
  const status = tsdbStatus(e, now);
  const hasScore = e.intHomeScore !== null && e.intAwayScore !== null;
  return {
    fields: {
      scheduled_at: tsdbKickoff(e),
      status,
      league: league.name,
      home_score: hasScore ? e.intHomeScore : status === 'upcoming' ? null : 0,
      away_score: hasScore ? e.intAwayScore : status === 'upcoming' ? null : 0,
      venue: e.strVenue ?? null,
      poster_url: e.strPoster ?? null,
      ...(e.strOfficial ? { referee: e.strOfficial } : {}),
    },
    ext: {
      key: extKey('tsdb', e.idEvent), source: 'tsdb', id: e.idEvent, league: league.key, round: e.intRound ?? null,
      video: e.strVideo ?? null, thumb: e.strThumb ?? null, venueId: e.idVenue ?? null, spectators: e.intSpectators ?? null,
    },
  };
}

export function mapTsdbEventTeam(e, side) {
  const home = side === 'home';
  return {
    fields: { name: home ? e.strHomeTeam : e.strAwayTeam, logo_url: (home ? e.strHomeTeamBadge : e.strAwayTeamBadge) ?? null },
    ext: { tsdb: home ? e.idHomeTeam : e.idAwayTeam },
  };
}

export function mapTsdbTeam(t) {
  return {
    fields: { logo_url: t.strBadge ?? null },
    ext: {
      tsdb: t.idTeam, code: t.strTeamShort ?? null, fanart: t.strFanart1 ?? null, colour: t.strColour1 ?? null,
      venue: t.strStadium ?? null, venueId: t.idVenue ?? null, capacity: t.intStadiumCapacity ?? null, country: t.strCountry ?? null,
    },
  };
}

export function shortName(team) {
  const code = team._ext?.code;
  if (code && code.length <= 4) return code.toUpperCase();
  const skip = /^(fc|cf|sc|sv|vfl|vfb|tsg|afc|ac|as|fk|sk|rb|1\.|bsc|dsc|spvgg|fsv|ssc|ud|cd|real)$/i;
  const words = String(team._ext?.shortName ?? team.name ?? '').split(/\s+/).filter((w) => w && !skip.test(w) && !/^\d+$/.test(w));
  const word = words[0] ?? team.name ?? '?';
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '?';
}

export function liveClock(scheduledAt, now = Date.now()) {
  const elapsed = Math.floor((now - Date.parse(scheduledAt)) / MINUTE);
  if (!Number.isFinite(elapsed) || elapsed < 0) return { minute: null, period: null };
  if (elapsed <= 45) return { minute: Math.max(1, elapsed), period: '1H' };
  if (elapsed < 60) return { minute: 45, period: 'HT' };
  return { minute: Math.min(90, elapsed - 15), period: '2H' };
}
