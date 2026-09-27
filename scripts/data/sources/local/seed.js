// First run: demo accounts, their saved cards, and a background import of the leagues.
import { emit, on } from '../../../core/events.js';
import { db } from './local-db.js';
import { hashPassword } from './password.js';
import { syncAll } from './sync.js';

const DEMO_USERS = [
  { username: 'admin_john', email: 'john@sportslive.test', password: 'Admin#2026', role: 'admin' },
  { username: 'admin_sara', email: 'sara@sportslive.test', password: 'Admin#2026', role: 'admin' },
  { username: 'viewer_mike', email: 'mike@sportslive.test', password: 'Viewer#2026', role: 'viewer' },
  { username: 'viewer_anna', email: 'anna@sportslive.test', password: 'Viewer#2026', role: 'viewer' },
];

const DEMO_CARDS = [
  { username: 'viewer_mike', cardholder_name: 'Mike Davis', card_last_four: '4444', expiry_date: '11/28', brand: 'mastercard', is_default: true },
  { username: 'viewer_anna', cardholder_name: 'Anna Hakobyan', card_last_four: '4242', expiry_date: '09/29', brand: 'visa', is_default: true },
];

let usersReady = null;
let started = false;
let firstImport = null;

async function seedUsers() {
  if (db.all('users').length) return;
  for (const user of DEMO_USERS) {
    db.insert('users', {
      username: user.username,
      email: user.email,
      password_hash: await hashPassword(user.password),
      role: user.role,
    });
  }
  for (const card of DEMO_CARDS) {
    const owner = db.find('users', (u) => u.username === card.username);
    if (owner) {
      const { username, ...row } = card;
      db.insert('payment_cards', { ...row, user_id: owner.id });
    }
  }
  const meta = db.meta();
  meta.seededAt = new Date().toISOString();
  db.saveMeta();
}

export function ensureUsers() {
  if (!usersReady) usersReady = seedUsers();
  return usersReady;
}

export function startHybrid() {
  if (started) return;
  started = true;
  ensureUsers().catch((err) => console.error('Seeding accounts failed', err));
  let resolveFirst;
  firstImport = new Promise((resolve) => { resolveFirst = resolve; });
  const stop = on('sync:progress', ({ count }) => {
    if (count > 0) {
      resolveFirst();
      stop();
    }
  });
  syncAll()
    .catch((err) => console.error('League import failed', err))
    .finally(() => {
      resolveFirst();
      stop();
      emit('sync:done');
    });
}

export async function whenMatchesAvailable() {
  startHybrid();
  if (db.all('matches').length) return;
  await firstImport;
}
