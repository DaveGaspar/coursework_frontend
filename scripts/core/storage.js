// localStorage can be full or disabled; these helpers never throw.
const evictors = [];

export function registerEvictor(fn) {
  evictors.push(fn);
}

function area(kind) {
  try {
    return kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readJSON(key, fallback, kind = 'local') {
  try {
    const raw = area(kind)?.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, kind = 'local') {
  const store = area(kind);
  if (!store) return false;
  const raw = JSON.stringify(value);
  try {
    store.setItem(key, raw);
    return true;
  } catch {
    if (kind === 'local' && evictors.some((fn) => fn())) {
      try {
        store.setItem(key, raw);
        return true;
      } catch { /* still full */ }
    }
    return false;
  }
}

export function removeKey(key, kind = 'local') {
  try { area(kind)?.removeItem(key); } catch { /* ignore */ }
}

export function keysWithPrefix(prefix, kind = 'local') {
  const store = area(kind);
  if (!store) return [];
  const keys = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
  } catch { /* ignore */ }
  return keys;
}
