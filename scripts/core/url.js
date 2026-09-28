// Project root, so the site also works when served from a subfolder.
const ROOT = new URL('../../', import.meta.url);
export const BASE_PATH = ROOT.pathname;

export function assetUrl(path) {
  return new URL(path, ROOT).pathname;
}

const PAGES = {
  home: 'index.html',
  live: 'pages/Live/Live.html',
  tickets: 'pages/Tickets/Tickets.html',
  checkout: 'pages/Checkout/Checkout.html',
  signin: 'pages/Auth/SignIn.html',
  signup: 'pages/Auth/SignUp.html',
  account: 'pages/Account/Account.html',
  adminTeams: 'pages/Admin/Teams.html',
  adminMatches: 'pages/Admin/Matches.html',
  adminReports: 'pages/Admin/Reports.html',
};
export const ROUTES = Object.fromEntries(Object.entries(PAGES).map(([name, file]) => [name, BASE_PATH + file]));

export function routeTo(name, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${ROUTES[name]}?${qs}` : ROUTES[name];
}

export function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

export function replaceParams(params) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function normalizePath(path) {
  let p = path.replace(/\/{2,}/g, '/');
  if (p.endsWith('/')) p += 'index.html';
  else if (!/\.[a-z]+$/i.test(p)) p += '.html';
  return p;
}

export function isCurrent(href) {
  return normalizePath(new URL(href, location.origin).pathname) === normalizePath(location.pathname);
}

export function currentLocation() {
  return `${location.pathname}${location.search}`;
}

export function safeNext(next, fallback = ROUTES.home) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  try {
    const url = new URL(next, location.origin);
    // Same site only: on GitHub Pages other projects share this origin under other folders.
    const inSite = url.origin === location.origin && url.pathname.startsWith(BASE_PATH);
    return inSite ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
