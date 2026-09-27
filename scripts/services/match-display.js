import { formatDate, formatTime } from '../core/format.js';
import { routeTo } from '../core/url.js';
import { t } from '../i18n/i18n.js';

export function matchTitle(match) {
  return t('common.matchTitle', { home: match.home_team.name, away: match.away_team.name });
}

export function shortTitle(match) {
  return t('common.matchTitle', { home: match.home_team.short_name, away: match.away_team.short_name });
}

// "Sat 10 Oct · 12:30"
export function kickoffLabel(match, preset = 'weekday') {
  return t('common.dateTime', { date: formatDate(match.scheduled_at, preset), time: formatTime(match.scheduled_at) });
}

// "67′" while live, "Half-time" at the break.
export function liveLabel(match) {
  if (match.live_period === 'HT') return t('common.halfTime');
  return match.live_minute ? t('common.minute', { minute: match.live_minute }) : t('status.live');
}

// Just the clock, for places that already show a Live badge. Empty when the minute is unknown.
export function liveClock(match) {
  return match.live_minute || match.live_period === 'HT' ? liveLabel(match) : '';
}

export function scoreLabel(match) {
  return t('common.score', { home: match.home_score ?? 0, away: match.away_score ?? 0 });
}

// What to show under a match: the clock while live, the score when finished, otherwise the kick-off.
export function statusLine(match) {
  if (match.status === 'live') return t('common.liveLine', { score: scoreLabel(match), clock: liveLabel(match) });
  if (match.status === 'finished') return t('common.finalScore', { score: scoreLabel(match) });
  return kickoffLabel(match);
}

export function liveUrl(match) {
  return routeTo('live', { match: match.id });
}

export function checkoutUrl(match) {
  return routeTo('checkout', { match: match.id });
}

// TheSportsDB serves smaller renditions: tiny (~50px), small (~250px), medium (~500px).
export function sizedImage(url, size = 'medium') {
  return url && /thesportsdb\.com\/images\//.test(url) ? `${url}/${size}` : url;
}
