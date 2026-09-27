import { mountFooter } from '../components/Footer/Footer.js';
import { mountNavbar } from '../components/Navbar/Navbar.js';
import { initStaleNotice } from '../components/Notice/Notice.js';
import { toast } from '../components/Toast/Toast.js';
import { hydrate } from './core/template.js';
import { initTheme } from './core/theme.js';
import { startDataSource } from './data/index.js';
import { initI18n, onLanguageChange, t } from './i18n/i18n.js';
import { currentUser, requireAdmin, requireAuth, takeFlash } from './services/auth.js';

function setMeta(page) {
  const title = t(`meta.${page}.title`);
  const description = t(`meta.${page}.description`);
  document.title = title;
  const tags = { 'meta[name="description"]': description, 'meta[property="og:title"]': title, 'meta[property="og:description"]': description };
  for (const [selector, value] of Object.entries(tags)) document.querySelector(selector)?.setAttribute('content', value);
}

// Start-up shared by every page. `access`: 'public', 'user' (signed in) or 'admin'. Resolves with the user or null.
export async function boot({ page, access = 'public' }) {
  initTheme();
  await initI18n();
  startDataSource();
  initStaleNotice();
  const user = access === 'admin' ? await requireAdmin() : access === 'user' ? await requireAuth() : await currentUser();

  hydrate(document.body);
  mountNavbar(document.getElementById('site-header'), user);
  mountFooter(document.getElementById('site-footer'), user);
  setMeta(page);
  onLanguageChange(() => setMeta(page));

  const message = takeFlash();
  if (message) toast(message.key, { type: message.type, params: message.params });
  return user;
}
