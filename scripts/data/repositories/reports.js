import { db } from '../sources/local/local-db.js';
import { whenMatchesAvailable } from '../sources/local/seed.js';
import { requireAdmin, teamsById, teamSummary } from './helpers.js';

const n = (v) => Number(v) || 0;

function finished(league) {
  return db.all('matches').filter((m) => m.status === 'finished' && (!league || m.league === league));
}

function revenueTotal(m) {
  return n(m.revenue_tickets) + n(m.revenue_merchandise) + n(m.revenue_sponsorship) + n(m.revenue_concessions);
}

export const reportsRepo = {
  async summary({ league } = {}) {
    requireAdmin();
    await whenMatchesAvailable();
    const rows = finished(league);
    const withAttendance = rows.filter((m) => m.attendance != null);
    const stream = (key) => rows.reduce((sum, m) => sum + n(m[key]), 0);
    const revenue = {
      tickets: stream('revenue_tickets'),
      sponsorship: stream('revenue_sponsorship'),
      merchandise: stream('revenue_merchandise'),
      concessions: stream('revenue_concessions'),
    };
    return {
      total_matches: rows.length,
      avg_attendance: withAttendance.length ? Math.round(withAttendance.reduce((s, m) => s + n(m.attendance), 0) / withAttendance.length) : 0,
      total_revenue: revenue.tickets + revenue.sponsorship + revenue.merchandise + revenue.concessions,
      total_goals: rows.reduce((s, m) => s + n(m.home_score) + n(m.away_score), 0),
      revenue_by_stream: revenue,
    };
  },

  async byMatch({ league } = {}) {
    requireAdmin();
    await whenMatchesAvailable();
    const teams = teamsById();
    return finished(league)
      .sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at))
      .map((m) => ({
        id: m.id,
        home_team: teamSummary(teams.get(m.home_team_id)),
        away_team: teamSummary(teams.get(m.away_team_id)),
        league: m.league,
        venue: m.venue,
        scheduled_at: m.scheduled_at,
        home_score: m.home_score,
        away_score: m.away_score,
        attendance: n(m.attendance),
        total_fouls: n(m.total_fouls),
        yellow_cards: n(m.yellow_cards),
        red_cards: n(m.red_cards),
        revenue_tickets: n(m.revenue_tickets),
        revenue_merchandise: n(m.revenue_merchandise),
        revenue_sponsorship: n(m.revenue_sponsorship),
        revenue_concessions: n(m.revenue_concessions),
        revenue_total: revenueTotal(m),
      }));
  },
};
