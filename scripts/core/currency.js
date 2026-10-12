import { getLanguage } from '../i18n/i18n.js';
import { readJSON, writeJSON } from './storage.js';

const STORAGE_KEY = 'sl:amd';

// true = prices in Armenian dram, false = US dollars. The visitor's own choice, independent of the language.
let amd = readJSON(STORAGE_KEY, false) === true;

export function showsDram() {
  return amd;
}

export function setDram(value) {
  if (value === amd) return;
  amd = value;
  writeJSON(STORAGE_KEY, amd);
  // Pages already redraw their text and prices on this event.
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { language: getLanguage() } }));
}
