// TTL cache in localStorage. When the network fails, stale data is served and 'data:stale' is emitted.
import { emit } from './events.js';
import { keysWithPrefix, readJSON, registerEvictor, removeKey, writeJSON } from './storage.js';

const PREFIX = 'sl:cache:';
const memory = new Map();
const inflight = new Map();

export function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  const entry = readJSON(PREFIX + key, null);
  if (entry) memory.set(key, entry);
  return entry;
}

export function writeCache(key, value, ttl) {
  const entry = { value, expires: Date.now() + ttl, savedAt: Date.now() };
  memory.set(key, entry);
  writeJSON(PREFIX + key, entry);
}

export async function cached(key, ttl, loader, { force = false } = {}) {
  const entry = readCache(key);
  if (!force && entry && entry.expires > Date.now()) return entry.value;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const value = await loader();
      writeCache(key, value, ttl);
      return value;
    } catch (err) {
      if (entry) {
        emit('data:stale', { key, savedAt: entry.savedAt });
        return entry.value;
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

export function clearCache(prefix = '') {
  for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key);
  for (const key of keysWithPrefix(PREFIX + prefix)) removeKey(key);
}

registerEvictor(() => {
  const entries = keysWithPrefix(PREFIX)
    .map((key) => ({ key, savedAt: readJSON(key, { savedAt: 0 })?.savedAt ?? 0 }))
    .sort((a, b) => a.savedAt - b.savedAt);
  if (!entries.length) return false;
  for (const { key } of entries.slice(0, Math.ceil(entries.length / 2))) {
    removeKey(key);
    memory.delete(key.slice(PREFIX.length));
  }
  return true;
});
