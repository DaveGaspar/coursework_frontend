import { CAROUSEL_INTERVAL_MS } from '../../scripts/core/config.js';
import { h, icon } from '../../scripts/core/dom.js';
import { formatDate } from '../../scripts/core/format.js';
import { hydrate, loadTemplates, refs } from '../../scripts/core/template.js';
import { t } from '../../scripts/i18n/i18n.js';
import { checkoutUrl, kickoffLabel, liveLabel, liveUrl, matchTitle, scoreLabel } from '../../scripts/services/match-display.js';

const use = await loadTemplates(new URL('./HeroCarousel.html', import.meta.url));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function metaItem(iconName, text) {
  return h('span', { class: 'hero__meta-item' }, icon(iconName, { size: 'sm' }), text);
}

function photoCredit(match) {
  if (!match.backdrop_url) return null;
  if (match.backdrop_url === match.venue_image_url && match.venue_image_credit) return match.venue_image_credit;
  if (/thesportsdb\.com/.test(match.backdrop_url)) return { label: 'TheSportsDB', url: 'https://www.thesportsdb.com' };
  return null;
}

function createSlide(match, index, total) {
  const slide = use('hero-slide');
  const ref = refs(slide);
  const live = match.status === 'live';
  slide.setAttribute('aria-label', t('home.hero.slide', { index: index + 1, total }));
  if (match.backdrop_url) {
    slide.prepend(h('img', {
      class: 'hero__bg', src: match.backdrop_url, alt: '', width: 1280, height: 560,
      loading: index ? 'lazy' : 'eager', fetchpriority: index ? null : 'high', decoding: 'async',
    }));
  }
  ref.eyebrow.textContent = live ? t('home.hero.liveNow') : t('home.hero.upcoming', { date: formatDate(match.scheduled_at, 'weekday') });
  ref.title.textContent = matchTitle(match);
  ref.meta.append(
    metaItem('trophy', match.league),
    match.venue && metaItem('map-pin', match.venue),
    live
      ? metaItem('timer', t('common.liveLine', { score: scoreLabel(match), clock: liveLabel(match) }))
      : metaItem('calendar', kickoffLabel(match)),
  );
  ref.actions.append(
    h('a', { class: 'btn btn--primary btn--lg', href: liveUrl(match) }, icon('circle-play'), t('home.hero.watchLive')),
    !live && match.tickets_left > 0
      && h('a', { class: 'btn btn--on-night btn--lg', href: checkoutUrl(match) }, icon('ticket'), t('home.hero.buyTickets')),
  );
  const credit = photoCredit(match);
  if (credit) {
    ref.creditLabel.textContent = t('home.hero.photo');
    ref.credit.append(' ', h('a', { href: credit.url }, credit.label));
    ref.credit.hidden = false;
  }
  return slide;
}

// Featured matches. Autoplays every 6 s unless the user prefers reduced motion; pauses on hover and focus.
export function createHeroCarousel(matches, { start = 0 } = {}) {
  const root = use('hero');
  const ref = refs(root);
  const total = matches.length;
  const slides = matches.map((match, index) => createSlide(match, index, total));
  ref.viewport.append(...slides);

  let current = 0;
  let playing = !reducedMotion.matches && total > 1;
  let held = false;
  let timer = null;

  const schedule = () => {
    clearTimeout(timer);
    // A carousel replaced by a re-render stops itself.
    if (playing && !held) timer = setTimeout(() => root.isConnected && show(current + 1), CAROUSEL_INTERVAL_MS);
  };
  const dots = matches.map((_, index) => {
    const li = use('hero-dot');
    const button = li.querySelector('button');
    button.dataset.i18nAttr = 'aria-label:home.hero.goTo';
    button.dataset.i18nParams = JSON.stringify({ index: index + 1, total });
    button.addEventListener('click', () => show(index));
    ref.dots.append(hydrate(li));
    return button;
  });
  function show(index) {
    current = (index + total) % total;
    root.dataset.index = String(current);
    slides.forEach((slide, n) => slide.classList.toggle('is-active', n === current));
    dots.forEach((dot, n) => dot.setAttribute('aria-current', String(n === current)));
    schedule();
  }
  const syncToggle = () => {
    ref.toggle.dataset.i18nAttr = `aria-label:${playing ? 'home.hero.pause' : 'home.hero.play'}`;
    ref.toggleIcon.dataset.icon = playing ? 'pause' : 'play';
    ref.viewport.setAttribute('aria-live', playing ? 'off' : 'polite');
    hydrate(ref.toggle);
  };

  ref.toggle.addEventListener('click', () => {
    playing = !playing;
    syncToggle();
    schedule();
  });
  const hold = (value) => () => {
    held = value;
    schedule();
  };
  root.addEventListener('mouseenter', hold(true));
  root.addEventListener('mouseleave', hold(false));
  root.addEventListener('focusin', hold(true));
  root.addEventListener('focusout', hold(false));
  // Swipe left or right on touch screens.
  let swipeX = null;
  ref.viewport.addEventListener('pointerdown', (event) => { swipeX = event.pointerType === 'mouse' ? null : event.clientX; });
  ref.viewport.addEventListener('pointercancel', () => { swipeX = null; });
  ref.viewport.addEventListener('pointerup', (event) => {
    const dx = swipeX === null ? 0 : event.clientX - swipeX;
    swipeX = null;
    if (total > 1 && Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });
  if (total < 2) ref.toggle.parentElement.hidden = true;

  syncToggle();
  show(Math.min(start, total - 1));
  return root;
}
