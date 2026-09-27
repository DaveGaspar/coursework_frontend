import { readJSON, writeJSON } from './storage.js';

const KEY = 'sl:theme';
const THEMES = ['system', 'light', 'dark'];
const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

function apply(preference) {
  const root = document.documentElement;
  if (preference === 'light' || preference === 'dark') root.dataset.theme = preference;
  else delete root.dataset.theme;
}

function notify() {
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: getEffectiveTheme() } }));
}

export function getThemePreference() {
  const saved = readJSON(KEY, 'system');
  return THEMES.includes(saved) ? saved : 'system';
}

export function getEffectiveTheme() {
  const pref = getThemePreference();
  if (pref !== 'system') return pref;
  return media?.matches ? 'dark' : 'light';
}

export function setThemePreference(preference) {
  if (!THEMES.includes(preference)) return;
  writeJSON(KEY, preference);
  apply(preference);
  notify();
}

export function initTheme() {
  apply(getThemePreference());
  media?.addEventListener('change', () => {
    if (getThemePreference() === 'system') notify();
  });
}

export function onThemeChange(callback) {
  const listener = (event) => callback(event.detail.theme);
  document.addEventListener('themechange', listener);
  return () => document.removeEventListener('themechange', listener);
}

export const THEME_OPTIONS = THEMES;
