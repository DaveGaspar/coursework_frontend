import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';
import { isAdmin } from '../../scripts/services/auth.js';
import { createThemeSwitch } from '../ThemeSwitch/ThemeSwitch.js';

const use = await loadTemplates(new URL('./Footer.html', import.meta.url));

function accountLinks(user) {
  if (!user) return [['signin', 'nav.signIn'], ['signup', 'nav.signUp']];
  const links = [['account', 'nav.myAccount']];
  if (isAdmin(user)) links.push(['adminTeams', 'nav.admin']);
  return links;
}

// Renders the footer into the page's <footer id="site-footer">.
export function mountFooter(footer, user) {
  const node = use('footer');
  const ref = refs(node);
  for (const [route, key] of accountLinks(user)) {
    const li = use('footer-link');
    const a = li.querySelector('a');
    a.dataset.route = route;
    a.dataset.i18n = key;
    ref.account.append(hydrate(li));
  }
  ref.rights.dataset.i18nParams = JSON.stringify({ year: String(new Date().getFullYear()) });
  ref.theme.append(createThemeSwitch());
  footer.replaceChildren(hydrate(node));
}
