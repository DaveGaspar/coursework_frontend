import { API, TTL } from '../../../core/config.js';
import { cached } from '../../../core/cache.js';
import { getJSON } from '../../../core/http.js';

function pickMatch(m) {
  const results = (m.matchResults ?? []).map((r) => ({ typeId: r.resultTypeID, order: r.resultOrderID, home: r.pointsTeam1, away: r.pointsTeam2 }));
  const team = (t) => ({ teamId: t?.teamId, teamName: t?.teamName, shortName: t?.shortName, teamIconUrl: t?.teamIconUrl || null });
  return {
    matchID: m.matchID,
    matchDateTimeUTC: m.matchDateTimeUTC,
    leagueShortcut: m.leagueShortcut,
    leagueSeason: m.leagueSeason,
    group: m.group ? { groupOrderID: m.group.groupOrderID, groupName: m.group.groupName } : null,
    team1: team(m.team1),
    team2: team(m.team2),
    matchIsFinished: Boolean(m.matchIsFinished),
    results,
    goals: (m.goals ?? []).map((g) => ({
      minute: g.matchMinute ?? null, home: g.scoreTeam1, away: g.scoreTeam2, scorer: g.goalGetterName || null,
      penalty: Boolean(g.isPenalty), ownGoal: Boolean(g.isOwnGoal), overtime: Boolean(g.isOvertime),
    })),
    location: m.location ? { stadium: m.location.locationStadium || null, city: m.location.locationCity || null } : null,
    viewers: m.numberOfViewers ?? null,
    lastUpdate: m.lastUpdateDateTime ?? null,
  };
}

export function matchday(shortcut, season, group, { force = false, live = false } = {}) {
  const url = `${API.openLigaDb}/getmatchdata/${encodeURIComponent(shortcut)}/${encodeURIComponent(season)}/${group}`;
  return cached(`oldb:${shortcut}:${season}:${group}`, live ? TTL.live : TTL.fixtures,
    async () => ((await getJSON(url)) ?? []).filter((m) => m.leagueShortcut === shortcut).map(pickMatch), { force });
}

export function currentMatchday(shortcut, { force = false } = {}) {
  const url = `${API.openLigaDb}/getcurrentgroup/${encodeURIComponent(shortcut)}`;
  return cached(`oldb:${shortcut}:current`, TTL.fixtures, async () => (await getJSON(url))?.groupOrderID ?? null, { force });
}

export function match(matchId, { force = false } = {}) {
  const url = `${API.openLigaDb}/getmatchdata/${encodeURIComponent(matchId)}`;
  return cached(`oldb:match:${matchId}`, TTL.live, async () => {
    const m = await getJSON(url);
    return m && m.matchID ? pickMatch(m) : null;
  }, { force });
}
