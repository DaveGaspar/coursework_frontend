import { AuthError, ValidationError } from '../../core/errors.js';
import { validateEmail, validatePassword, validateUsername } from '../../core/validators.js';
import { db } from '../sources/local/local-db.js';
import { hashPassword, verifyPassword } from '../sources/local/password.js';
import { ensureUsers } from '../sources/local/seed.js';
import { endSession, latency, publicUser, sessionUserId, startSession } from './helpers.js';

const lower = (s) => String(s ?? '').trim().toLowerCase();

export const authRepo = {
  async signIn({ login, password }) {
    await ensureUsers();
    const key = lower(login);
    const user = db.find('users', (u) => lower(u.username) === key || lower(u.email) === key);
    const ok = user ? await verifyPassword(String(password ?? ''), user.password_hash) : false;
    await latency(300);
    if (!ok) throw new AuthError('Wrong username or password', { code: 'invalid_credentials' });
    startSession(user.id);
    return publicUser(user);
  },

  async signUp({ username, email, password }) {
    await ensureUsers();
    const fields = {};
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (usernameError) fields.username = usernameError;
    if (emailError) fields.email = emailError;
    if (passwordError) fields.password = passwordError;
    if (!fields.username && db.find('users', (u) => lower(u.username) === lower(username))) fields.username = 'validation.usernameTaken';
    if (!fields.email && db.find('users', (u) => lower(u.email) === lower(email))) fields.email = 'validation.emailTaken';
    if (Object.keys(fields).length) {
      const code = fields.username === 'validation.usernameTaken' ? 'username_taken' : fields.email === 'validation.emailTaken' ? 'email_taken' : 'validation';
      throw new ValidationError('Invalid sign-up', { code, fields });
    }
    const user = db.insert('users', {
      username: String(username).trim(),
      email: String(email).trim().toLowerCase(),
      password_hash: await hashPassword(String(password)),
      role: 'viewer',
    });
    await latency(300);
    startSession(user.id);
    return publicUser(user);
  },

  async signOut() {
    endSession();
  },

  async me() {
    const id = sessionUserId();
    if (!id) return null;
    await ensureUsers();
    const user = db.get('users', id);
    if (!user) {
      endSession();
      return null;
    }
    return publicUser(user);
  },
};
