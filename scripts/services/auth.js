import { emit } from '../core/events.js';
import { readJSON, removeKey, writeJSON } from '../core/storage.js';
import { ROUTES, currentLocation, routeTo } from '../core/url.js';
import { authRepo } from '../data/index.js';

const FLASH_KEY = 'sl:flash';
let current;

export async function currentUser() {
  if (current === undefined) current = await authRepo.me().catch(() => null);
  return current;
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export async function signIn(credentials) {
  current = await authRepo.signIn(credentials);
  emit('auth:changed', { user: current });
  return current;
}

export async function signUp(details) {
  current = await authRepo.signUp(details);
  emit('auth:changed', { user: current });
  return current;
}

export async function signOut() {
  await authRepo.signOut();
  current = null;
  emit('auth:changed', { user: null });
  flash('auth.signedOut', 'success');
  location.assign(ROUTES.home);
}

// A message shown as a toast on the next page (survives a redirect).
export function flash(key, type = 'info', params = {}) {
  writeJSON(FLASH_KEY, { key, type, params }, 'session');
}

export function takeFlash() {
  const message = readJSON(FLASH_KEY, null, 'session');
  if (message) removeKey(FLASH_KEY, 'session');
  return message;
}

const stop = () => new Promise(() => {});

// Guests go to sign-in and come back here afterwards.
export async function requireAuth() {
  const user = await currentUser();
  if (user) return user;
  flash('auth.signInRequired', 'info');
  location.replace(routeTo('signin', { next: currentLocation() }));
  return stop();
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (isAdmin(user)) return user;
  flash('errors.adminOnly', 'warning');
  location.replace(ROUTES.home);
  return stop();
}
