import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';
import { THEME_OPTIONS, getThemePreference, onThemeChange, setThemePreference } from '../../scripts/core/theme.js';
import { BASE_PATH, ROUTES, isCurrent } from '../../scripts/core/url.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';
import { isAdmin, signOut } from '../../scripts/services/auth.js';
import { createAvatar } from '../Avatar/Avatar.js';
import { createLanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher.js';

const use = await loadTemplates(new URL('./Navbar.html', import.meta.url));
const THEME_ICONS = { system: 'monitor', light: 'sun', dark: 'moon' };

function navItems(user) {
  const items = [
    { route: 'live', key: 'nav.watchLive', icon: 'radio' },
    { route: 'tickets', key: 'nav.buyTickets', icon: 'ticket' },
  ];
  if (isAdmin(user)) items.push({ route: 'adminTeams', key: 'nav.admin', icon: 'shield', section: 'pages/Admin/' });
  return items;
}

function isActive(item) {
  return item.section ? location.pathname.startsWith(BASE_PATH + item.section) : isCurrent(ROUTES[item.route]);
}

function link(templateId, item) {
  const li = use(templateId);
  const a = li.querySelector('a');
  a.dataset.route = item.route;
  const label = a.querySelector('span') ?? a;
  label.dataset.i18n = item.key;
  a.querySelector('svg')?.setAttribute('data-icon', item.icon);
  if (isActive(item)) a.setAttribute('aria-current', 'page');
  return hydrate(li);
}

function createUserMenu(user) {
  const node = use('user-menu');
  const ref = refs(node);
  ref.toggle.append(createAvatar(user.username));
  ref.name.textContent = user.username;
  ref.email.textContent = user.email;
  ref.adminItem.hidden = !isAdmin(user);

  const items = () => [...ref.menu.querySelectorAll('[role="menuitem"]')].filter((el) => !el.closest('[hidden]'));
  const outside = (event) => {
    if (!node.contains(event.target)) close(false);
  };
  const open = (focusFirst) => {
    ref.menu.hidden = false;
    ref.toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside);
    if (focusFirst) items()[0]?.focus();
  };
  const close = (returnFocus) => {
    if (ref.menu.hidden) return;
    ref.menu.hidden = true;
    ref.toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside);
    if (returnFocus) ref.toggle.focus();
  };

  ref.toggle.addEventListener('click', () => (ref.menu.hidden ? open(false) : close(false)));
  ref.toggle.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open(true);
    }
  });
  ref.menu.addEventListener('keydown', (event) => {
    const list = items();
    const index = list.indexOf(document.activeElement);
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      list[(moves[event.key] + list.length) % list.length]?.focus();
    } else if (event.key === 'Escape') {
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  });

  const syncTheme = () => {
    const preference = getThemePreference();
    ref.themeValue.dataset.i18n = `theme.${preference}`;
    ref.themeIcon.dataset.icon = THEME_ICONS[preference];
    hydrate(ref.theme);
  };
  ref.theme.addEventListener('click', () => {
    const next = THEME_OPTIONS[(THEME_OPTIONS.indexOf(getThemePreference()) + 1) % THEME_OPTIONS.length];
    setThemePreference(next);
  });
  onThemeChange(syncTheme);
  syncTheme();
  ref.signOut.addEventListener('click', () => signOut());
  return node;
}

function bindSheet(button, sheet) {
  const desktop = matchMedia('(min-width: 768px)');
  const setOpen = (open) => {
    sheet.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.dataset.i18nAttr = `aria-label:${open ? 'nav.closeMenu' : 'nav.openMenu'}`;
    button.querySelector('svg').dataset.icon = open ? 'x' : 'menu';
    hydrate(button);
    document.documentElement.classList.toggle('no-scroll', open);
  };
  button.addEventListener('click', () => setOpen(sheet.hidden));
  sheet.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      button.focus();
    }
  });
  desktop.addEventListener('change', () => {
    if (desktop.matches) setOpen(false);
  });
}

// Renders the sticky navbar (and the mobile sheet) into the page's <header id="site-header">.
export function mountNavbar(header, user) {
  const bar = use('navbar');
  const ref = refs(bar);
  for (const item of navItems(user)) ref.links.append(link('nav-link', item));
  ref.lang.append(createLanguageSwitcher());
  ref.account.replaceWith(user ? createUserMenu(user) : use('sign-in'));

  const sheet = use('nav-sheet');
  const sheetRef = refs(sheet);
  for (const item of [{ route: 'home', key: 'nav.home', icon: 'house' }, ...navItems(user)]) {
    sheetRef.links.append(link('sheet-link', item));
  }
  sheetRef.lang.append(createLanguageSwitcher());
  sheetRef.auth.hidden = Boolean(user);

  header.replaceChildren(bar, sheet);
  bindSheet(ref.menuButton, sheet);
  applyTranslations(header);
}
