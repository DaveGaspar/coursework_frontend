import { HTTP_TIMEOUT_MS } from './config.js';
import { AppError, AuthError, NetworkError, NotFoundError, RateLimitError, ValidationError } from './errors.js';

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function toError(res) {
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  const info = body?.error ?? {};
  const options = { status: res.status, code: info.code, fields: info.fields };
  const message = info.message || `HTTP ${res.status}`;
  if (res.status === 404) return new NotFoundError(message, { ...options, code: info.code ?? 'not_found' });
  if (res.status === 429) return new RateLimitError(message, { ...options, code: 'rate_limited' });
  if (res.status === 401 || res.status === 403) return new AuthError(message, { ...options, code: info.code ?? (res.status === 403 ? 'forbidden' : 'unauthorized') });
  if (res.status === 400 || res.status === 409 || res.status === 422) return new ValidationError(message, { ...options, code: info.code ?? 'validation' });
  return new AppError(message, { ...options, code: info.code ?? 'server' });
}

export async function request(url, options = {}) {
  const { method = 'GET', body, headers = {}, credentials, timeout = HTTP_TIMEOUT_MS, retries = 1, signal } = options;
  const init = { method, headers: { Accept: 'application/json', ...headers }, credentials };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeout);
    const onAbort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) {
        const error = await toError(res);
        if (attempt < retries && RETRYABLE.has(res.status) && method === 'GET') {
          const retryAfter = Number(res.headers.get('Retry-After')) * 1000;
          await sleep(Math.min(retryAfter || 600 * 2 ** attempt, 5000));
          continue;
        }
        throw error;
      }
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new AppError('Invalid JSON response', { code: 'server', status: res.status, cause });
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (signal?.aborted) throw err;
      if (attempt < retries && method === 'GET') {
        await sleep(600 * 2 ** attempt);
        continue;
      }
      const timedOut = err?.name === 'TimeoutError' || controller.signal.reason?.name === 'TimeoutError';
      throw new NetworkError(timedOut ? 'Request timed out' : 'Network request failed', { code: timedOut ? 'timeout' : 'network', cause: err });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

export function getJSON(url, options = {}) {
  return request(url, { ...options, method: 'GET' });
}

export function withQuery(base, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}
