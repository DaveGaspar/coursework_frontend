// Rate-limited queue shared by all open tabs (timestamps in localStorage). Higher priority runs first.
import { readJSON, writeJSON } from '../../../core/storage.js';

const WINDOW_MS = 60_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRequestQueue({ perMinute, storageKey, spacingMs = 150 }) {
  const queue = [];
  const inflight = new Map();
  let seq = 0;
  let pumping = false;
  let wake = null;
  // Sleeps until the delay passes or new work arrives (a visible request must not wait behind a throttled one).
  const nap = (ms) => new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => { clearTimeout(timer); resolve(); };
  }).finally(() => { wake = null; });

  const pauseKey = `${storageKey}:pause`;
  const pausedFor = () => Math.max(0, Number(readJSON(pauseKey, 0)) - Date.now());

  const recent = () => {
    const now = Date.now();
    return readJSON(storageKey, []).filter((t) => typeof t === 'number' && now - t < WINDOW_MS);
  };
  const record = () => {
    const stamps = recent();
    stamps.push(Date.now());
    writeJSON(storageKey, stamps);
  };

  const budget = (priority) => (priority >= 10 ? perMinute : priority >= 5 ? Math.floor(perMinute * 0.8) : Math.floor(perMinute * 0.6));

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length) {
        const paused = pausedFor();
        if (paused) {
          await sleep(paused + 50);
          continue;
        }
        const stamps = recent();
        queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
        if (stamps.length >= budget(queue[0].priority)) {
          await nap(Math.max(250, stamps[0] + WINDOW_MS - Date.now() + 50));
          continue;
        }
        const job = queue.shift();
        record();
        job.task().then(job.resolve, job.reject);
        await sleep(spacingMs);
      }
    } finally {
      pumping = false;
    }
  }

  // Raises the priority of a request that is already waiting (e.g. it is now on screen).
  const promote = (key, priority) => {
    const queued = queue.find((job) => job.key === key);
    if (queued && priority > queued.priority) {
      queued.priority = priority;
      wake?.();
    }
  };

  return {
    promote,
    schedule(key, task, { priority = 0 } = {}) {
      if (inflight.has(key)) {
        promote(key, priority);
        return inflight.get(key);
      }
      const promise = new Promise((resolve, reject) => {
        queue.push({ key, task, priority, seq: seq++, resolve, reject });
      }).finally(() => inflight.delete(key));
      inflight.set(key, promise);
      wake?.();
      pump();
      return promise;
    },
    pending: () => queue.length,
    pause(ms) {
      writeJSON(pauseKey, Math.max(Number(readJSON(pauseKey, 0)), Date.now() + ms));
    },
  };
}
