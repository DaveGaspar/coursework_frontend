// One localStorage key per table. Fields starting with "_" (external ids, admin edits) never leave the data layer.
import { emit } from '../../../core/events.js';
import { keysWithPrefix, readJSON, removeKey, writeJSON } from '../../../core/storage.js';

const PREFIX = 'sl:db:';
const META_KEY = `${PREFIX}_meta`;
const SCHEMA_VERSION = 3;

export const TABLES = ['users', 'teams', 'players', 'matches', 'tickets', 'payment_cards'];

const tables = new Map();
let meta = null;
const dirty = new Set();
let flushQueued = false;

function defaultMeta() {
  return { version: SCHEMA_VERSION, seq: {}, tombstones: [], synced: {}, seededAt: null };
}

function loadMeta() {
  if (!meta) {
    meta = readJSON(META_KEY, null);
    if (!meta || meta.version !== SCHEMA_VERSION) {
      for (const key of keysWithPrefix(PREFIX)) removeKey(key);
      tables.clear();
      meta = defaultMeta();
      writeJSON(META_KEY, meta);
    }
  }
  return meta;
}

function load(name) {
  loadMeta();
  if (!tables.has(name)) tables.set(name, readJSON(PREFIX + name, []));
  return tables.get(name);
}

function flush() {
  flushQueued = false;
  const changed = [...dirty];
  dirty.clear();
  for (const name of changed) {
    if (name === '_meta') writeJSON(META_KEY, meta);
    else writeJSON(PREFIX + name, tables.get(name));
  }
  const tableNames = changed.filter((n) => n !== '_meta');
  if (tableNames.length) emit('data:updated', { tables: tableNames, source: 'local' });
}

function touch(name) {
  dirty.add(name);
  if (!flushQueued) {
    flushQueued = true;
    queueMicrotask(flush);
  }
}

const copy = (row) => (row ? { ...row } : null);

function nextId(name, rows) {
  const m = loadMeta();
  const maxId = rows.reduce((max, r) => Math.max(max, r.id), 0);
  const id = Math.max(m.seq[name] ?? 0, maxId) + 1;
  m.seq[name] = id;
  touch('_meta');
  return id;
}

export const db = {
  all(name) {
    return load(name).map(copy);
  },
  get(name, id) {
    return copy(load(name).find((r) => r.id === Number(id)));
  },
  find(name, predicate) {
    return copy(load(name).find(predicate));
  },
  filter(name, predicate) {
    return load(name).filter(predicate).map(copy);
  },
  insert(name, row) {
    const rows = load(name);
    const record = { ...row, id: nextId(name, rows), created_at: row.created_at ?? new Date().toISOString() };
    rows.push(record);
    touch(name);
    return copy(record);
  },
  update(name, id, patch) {
    const row = load(name).find((r) => r.id === Number(id));
    if (!row) return null;
    Object.assign(row, patch, { id: row.id });
    touch(name);
    return copy(row);
  },
  remove(name, id) {
    const rows = load(name);
    const index = rows.findIndex((r) => r.id === Number(id));
    if (index === -1) return null;
    const [removed] = rows.splice(index, 1);
    touch(name);
    return removed;
  },
  removeWhere(name, predicate) {
    const rows = load(name);
    const removed = rows.filter(predicate);
    if (removed.length) {
      tables.set(name, rows.filter((r) => !predicate(r)));
      touch(name);
    }
    return removed;
  },
  meta() {
    return loadMeta();
  },
  saveMeta() {
    touch('_meta');
  },
  addTombstone(extKey) {
    if (!extKey) return;
    const m = loadMeta();
    if (!m.tombstones.includes(extKey)) m.tombstones.push(extKey);
    touch('_meta');
  },
  isTombstoned(extKey) {
    return Boolean(extKey) && loadMeta().tombstones.includes(extKey);
  },
  flushNow() {
    if (dirty.size) flush();
  },
  reset() {
    for (const key of keysWithPrefix(PREFIX)) removeKey(key);
    tables.clear();
    meta = null;
    loadMeta();
    emit('data:updated', { tables: TABLES, source: 'local' });
  },
};

// Keep tabs in sync: another tab wrote a table → drop our copy and notify.
globalThis.addEventListener?.('storage', (event) => {
  if (!event.key?.startsWith(PREFIX)) return;
  if (event.key === META_KEY) {
    meta = null;
    return;
  }
  const name = event.key.slice(PREFIX.length);
  if (TABLES.includes(name)) {
    tables.delete(name);
    emit('data:updated', { tables: [name], source: 'remote' });
  }
});
globalThis.addEventListener?.('pagehide', () => db.flushNow());
