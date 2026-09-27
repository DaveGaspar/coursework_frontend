// 'hybrid' = public APIs + localStorage. Switch to 'backend' once the REST API exists.
export const DATA_SOURCE = 'hybrid';
export const BACKEND_BASE_URL = '/api';
export const CHAT_WS_URL = '/ws/chat';
export const CURRENCY = 'USD';

export const LANGUAGES = ['en', 'hy'];
export const DEFAULT_LANGUAGE = 'en';
export const LOCALES = { en: 'en-GB', hy: 'hy-AM' };

export const HTTP_TIMEOUT_MS = 8000;
export const LIVE_POLL_MS = 30000;
export const CAROUSEL_INTERVAL_MS = 6000;

export const TTL = {
  teams: 24 * 60 * 60 * 1000,
  players: 24 * 60 * 60 * 1000,
  venue: 7 * 24 * 60 * 60 * 1000,
  fixtures: 10 * 60 * 1000,
  live: 20 * 1000,
};

export const API = {
  theSportsDb: 'https://www.thesportsdb.com/api/v1/json/123',
  openLigaDb: 'https://api.openligadb.de',
  wikipedia: 'https://en.wikipedia.org/api/rest_v1',
};
// TheSportsDB (behind Cloudflare) blocks an IP for 60 s after ~30 requests in a minute. The budget is only
// shared between tabs of one browser profile, so 15 leaves room for a second window or browser on the same network.
export const TSDB_REQUESTS_PER_MINUTE = 15;

export function currentSeason(now = new Date()) {
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { startYear, openLigaDb: String(startYear), theSportsDb: `${startYear}-${startYear + 1}` };
}

export const LEAGUES = [
  { key: 'epl', name: 'Premier League', source: 'thesportsdb', leagueId: '4328', tier: 1, roundsPerSeason: 38 },
  { key: 'ucl', name: 'UEFA Champions League', source: 'thesportsdb', leagueId: '4480', tier: 0, roundsPerSeason: 8, leaguePhaseFromMonth: 8 },
  { key: 'bl1', name: 'Bundesliga', source: 'openligadb', shortcut: 'bl1', tier: 2, tsdbLeague: 'German Bundesliga' },
  { key: 'bl2', name: '2. Bundesliga', source: 'openligadb', shortcut: 'bl2', tier: 3, tsdbLeague: 'German 2. Bundesliga' },
];

// Rounds imported per league: the last 2 and the next 3.
export const IMPORT_WINDOW = { past: 2, next: 3 };

export const IS_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname ?? '')
  || (globalThis.location?.hostname ?? '').endsWith('.localhost');
