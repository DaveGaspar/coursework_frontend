import { DEFAULT_LANGUAGE, IS_DEV, LANGUAGES, LOCALES } from '../core/config.js';
import { readJSON, writeJSON } from '../core/storage.js';

const STORAGE_KEY = 'sl:lang';
const SOURCE = new URL('../../assets/i18n/translations.json', import.meta.url);

let dictionaries = null;
let language = DEFAULT_LANGUAGE;
let loading = null;
const pluralRules = new Map();
const numberFormats = new Map();
const warned = new Set();

export function detectLanguage() {
  const saved = readJSON(STORAGE_KEY, null);
  if (LANGUAGES.includes(saved)) return saved;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.some((l) => /^hy\b/i.test(l ?? '')) ? 'hy' : DEFAULT_LANGUAGE;
}

export async function initI18n() {
  if (!loading) {
    loading = fetch(SOURCE, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`translations.json: HTTP ${res.status}`);
      return res.json();
    });
  }
  dictionaries = await loading;
  language = detectLanguage();
  document.documentElement.lang = language;
  applyTranslations(document);
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function warn(message) {
  if (IS_DEV && !warned.has(message)) {
    warned.add(message);
    console.warn(`[i18n] ${message}`);
  }
}

function formatParam(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value ?? '');
  const locale = getLocale();
  if (!numberFormats.has(locale)) numberFormats.set(locale, new Intl.NumberFormat(locale));
  return numberFormats.get(locale).format(value);
}

export function t(key, params = {}) {
  let value = lookup(dictionaries?.[language], key);
  if (value === undefined) {
    value = lookup(dictionaries?.[DEFAULT_LANGUAGE], key);
    warn(value === undefined ? `Missing key "${key}"` : `Missing "${language}" translation for "${key}"`);
    if (value === undefined) return key;
  }
  if (value && typeof value === 'object') {
    const count = Number(params.count ?? 0);
    if (!pluralRules.has(language)) pluralRules.set(language, new Intl.PluralRules(getLocale()));
    const form = pluralRules.get(language).select(count);
    value = value[form] ?? value.other;
  }
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? formatParam(params[name]) : match));
}

export function hasKey(key) {
  return lookup(dictionaries?.[DEFAULT_LANGUAGE], key) !== undefined;
}

export function applyTranslations(root = document) {
  if (!dictionaries) return;
  const scope = root instanceof Element ? [root, ...root.querySelectorAll('[data-i18n],[data-i18n-attr]')] : [...root.querySelectorAll('[data-i18n],[data-i18n-attr]')];
  for (const el of scope) {
    if (el.dataset.i18n) {
      let params = {};
      if (el.dataset.i18nParams) {
        try { params = JSON.parse(el.dataset.i18nParams); } catch { /* ignore */ }
      }
      el.textContent = t(el.dataset.i18n, params);
    }
    if (el.dataset.i18nAttr) {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      }
    }
  }
}

export function getLanguage() {
  return language;
}

export function getLocale() {
  return LOCALES[language] ?? LOCALES[DEFAULT_LANGUAGE];
}

export function setLanguage(lang) {
  if (!LANGUAGES.includes(lang) || lang === language) return;
  language = lang;
  writeJSON(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations(document);
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
}

export function onLanguageChange(callback) {
  const listener = (event) => callback(event.detail.language);
  document.addEventListener('languagechange', listener);
  return () => document.removeEventListener('languagechange', listener);
}
