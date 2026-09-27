import { ROUTES, getParam, routeTo, safeNext } from '../../scripts/core/url.js';
import { isAdmin } from '../../scripts/services/auth.js';

// Where to go after signing in: the page that sent the user here, otherwise their home area.
export function destination(user) {
  const next = getParam('next');
  if (next) return safeNext(next, ROUTES.home);
  return isAdmin(user) ? ROUTES.adminTeams : ROUTES.account;
}

// Keeps ?next= when switching between sign-in and sign-up.
export function keepNext(link) {
  const next = getParam('next');
  if (next) link.href = routeTo(link.dataset.route, { next });
}
