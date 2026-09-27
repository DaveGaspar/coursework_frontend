import { CURRENCY } from './config.js';
import { getLocale } from '../i18n/i18n.js';

const formatters = new Map();

function formatter(kind, options) {
  const locale = getLocale();
  const key = `${kind}|${locale}|${JSON.stringify(options)}`;
  if (!formatters.has(key)) {
    formatters.set(key, kind === 'date' ? new Intl.DateTimeFormat(locale, options) : new Intl.NumberFormat(locale, options));
  }
  return formatters.get(key);
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function formatNumber(value, options = {}) {
  return formatter('number', options).format(Number(value) || 0);
}

export function formatCurrency(amount, { whole = false } = {}) {
  const digits = whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return formatter('number', { style: 'currency', currency: CURRENCY, currencyDisplay: 'narrowSymbol', ...digits }).format(Number(amount) || 0);
}

export function formatCompactCurrency(amount) {
  return formatter('number', { style: 'currency', currency: CURRENCY, currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1 }).format(Number(amount) || 0);
}

export function formatCompactNumber(value) {
  return formatter('number', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}

export function formatPercent(ratio, digits = 0) {
  return formatter('number', { style: 'percent', maximumFractionDigits: digits }).format(Number(ratio) || 0);
}

const DATE_PRESETS = {
  full: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },   // Sat, 28 Mar 2026
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'short' },                                     // 28 Mar
  weekday: { weekday: 'short', day: 'numeric', month: 'short' },                 // Sat 28 Mar
  weekdayShort: { weekday: 'short' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
};

export function formatDate(value, preset = 'full') {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : formatter('date', DATE_PRESETS[preset]).format(date);
}

export function formatTime(value) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : formatter('date', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : formatter('date', { ...DATE_PRESETS.full, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function toDateInputValue(value) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeInputValue(value) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${toDateInputValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatList(items) {
  try {
    return new Intl.ListFormat(getLocale(), { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

export function countdownParts(target, now = Date.now()) {
  const total = Math.max(0, toDate(target).getTime() - now);
  const seconds = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export function isSameDay(a, b) {
  return toDateInputValue(a) === toDateInputValue(b);
}
