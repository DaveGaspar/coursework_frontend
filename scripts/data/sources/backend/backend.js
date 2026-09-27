import { BACKEND_BASE_URL } from '../../../core/config.js';
import { AuthError } from '../../../core/errors.js';
import { request, withQuery } from '../../../core/http.js';

function api(method, path, { body, query } = {}) {
  return request(withQuery(`${BACKEND_BASE_URL}${path}`, query), {
    method,
    body,
    credentials: 'include',
    retries: method === 'GET' ? 1 : 0,
  });
}

const auth = {
  async signIn({ login, password }) {
    return (await api('POST', '/auth/signin', { body: { login, password } })).user;
  },
  async signUp({ username, email, password }) {
    return (await api('POST', '/auth/signup', { body: { username, email, password } })).user;
  },
  async signOut() {
    await api('POST', '/auth/signout');
  },
  async me() {
    try {
      return (await api('GET', '/auth/me')).user ?? null;
    } catch (err) {
      if (err instanceof AuthError) return null;
      throw err;
    }
  },
};

const matches = {
  list({ status, ...rest } = {}) {
    return api('GET', '/matches', { query: { status: status ? [].concat(status).join(',') : undefined, ...rest } });
  },
  get(id, { fresh = false } = {}) {
    return api('GET', `/matches/${encodeURIComponent(id)}`, { query: { fresh: fresh ? 1 : undefined } });
  },
  leagues() {
    return api('GET', '/leagues');
  },
  create(data) {
    return api('POST', '/matches', { body: data });
  },
  update(id, data) {
    return api('PUT', `/matches/${encodeURIComponent(id)}`, { body: data });
  },
  remove(id) {
    return api('DELETE', `/matches/${encodeURIComponent(id)}`);
  },
  refresh() {
    return api('POST', '/matches/refresh');
  },
  async pollLive() {},
};

const teams = {
  list({ withPlayers = false } = {}) {
    return api('GET', '/teams', { query: { with: withPlayers ? 'players' : undefined } });
  },
  get(id, { withPlayers = false } = {}) {
    return api('GET', `/teams/${encodeURIComponent(id)}`, { query: { with: withPlayers ? 'players' : undefined } });
  },
  create(data) {
    return api('POST', '/teams', { body: data });
  },
  update(id, data) {
    return api('PUT', `/teams/${encodeURIComponent(id)}`, { body: data });
  },
  remove(id) {
    return api('DELETE', `/teams/${encodeURIComponent(id)}`);
  },
};

const players = {
  create(data) {
    return api('POST', '/players', { body: data });
  },
  update(id, data) {
    return api('PUT', `/players/${encodeURIComponent(id)}`, { body: data });
  },
  async remove(id) {
    await api('DELETE', `/players/${encodeURIComponent(id)}`);
  },
};

const tickets = {
  buy(order) {
    return api('POST', '/tickets', { body: order });
  },
  mine() {
    return api('GET', '/me/tickets');
  },
};

const cards = {
  mine() {
    return api('GET', '/me/cards');
  },
  add(card) {
    return api('POST', '/me/cards', { body: card });
  },
  async setDefault(id) {
    await api('PUT', `/me/cards/${encodeURIComponent(id)}/default`);
  },
  async remove(id) {
    await api('DELETE', `/me/cards/${encodeURIComponent(id)}`);
  },
};

const reports = {
  summary(filters = {}) {
    return api('GET', '/reports/summary', { query: filters });
  },
  byMatch(filters = {}) {
    return api('GET', '/reports/matches', { query: filters });
  },
};

export const backend = { auth, matches, teams, players, tickets, cards, reports };
