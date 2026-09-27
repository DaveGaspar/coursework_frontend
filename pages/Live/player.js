import { createStatusBadge } from '../../components/Badge/Badge.js';
import { h, icon } from '../../scripts/core/dom.js';
import { countdownParts, formatNumber } from '../../scripts/core/format.js';
import { applyTranslations, t } from '../../scripts/i18n/i18n.js';
import { checkoutUrl, kickoffLabel, liveClock, matchTitle, scoreLabel } from '../../scripts/services/match-display.js';

const UNITS = ['days', 'hours', 'minutes', 'seconds'];
let current = { key: null, stop: null };

// Only https URLs are embedded. YouTube watch links become privacy-friendly embeds.
function embedUrl(url) {
  if (!/^https:\/\//i.test(url ?? '')) return null;
  const id = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
}

function frame(src, titleKey, match) {
  return h('iframe', {
    class: 'player__frame',
    src,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    'data-i18n-attr': `title:${titleKey}`,
    'data-i18n-params': JSON.stringify({ match: matchTitle(match) }),
  });
}

function backdrop(match) {
  const src = match.venue_image_url ?? match.backdrop_url;
  if (!src) return [];
  const credit = src === match.venue_image_url ? match.venue_image_credit : null;
  return [
    h('img', { class: 'player__bg', src, alt: '', decoding: 'async' }),
    credit && h('p', { class: 'credit player__credit' },
      h('span', { 'data-i18n': 'home.why.photo' }), ' ',
      credit.url ? h('a', { href: credit.url }, credit.label) : credit.label),
  ];
}

function goalItem(goal) {
  const note = goal.is_own_goal ? 'live.ownGoal' : goal.is_penalty ? 'live.penalty' : null;
  return h('li', null,
    icon('goal', { size: 'sm' }),
    h('span', { class: 'num' }, t('common.minute', { minute: goal.minute })),
    h('span', null, goal.scorer ?? t('live.goal'), note && ` ${t(note)}`),
    h('span', { class: 'num' }, t('common.score', { home: goal.home_score, away: goal.away_score })));
}

function matchCenter(match) {
  return [
    h('p', { class: 'eyebrow player__eyebrow cluster' }, createStatusBadge('live'), liveClock(match)),
    h('p', { class: 'player__score' }, scoreLabel(match)),
    match.goals.length
      ? h('ol', { class: 'goals', 'aria-label': t('live.goals') }, match.goals.map(goalItem).reverse())
      : h('p', { class: 'player__eyebrow', 'data-i18n': 'live.noGoals' }),
  ];
}

// Ticks every second; onKickoff runs once when it reaches zero.
function countdown(match, onKickoff) {
  const cells = UNITS.map((unit) => ({ unit, value: h('span', { class: 'countdown__value' }), label: h('span', { class: 'countdown__unit' }) }));
  const list = h('ol', { class: 'countdown', role: 'timer' }, cells.map((c) => h('li', null, c.value, c.label)));
  let timer = null;
  const tick = () => {
    const parts = countdownParts(match.scheduled_at);
    for (const c of cells) {
      c.value.textContent = formatNumber(parts[c.unit], { minimumIntegerDigits: 2 });
      c.label.textContent = t(`live.countdown.${c.unit}`, { count: parts[c.unit] });
    }
    if (timer && parts.total === 0) {
      clearInterval(timer);
      onKickoff();
    }
  };
  tick();
  if (countdownParts(match.scheduled_at).total > 0) timer = setInterval(tick, 1000);
  return { node: list, stop: () => clearInterval(timer) };
}

function upcoming(match, onKickoff) {
  const clock = countdown(match, onKickoff);
  current.stop = clock.stop;
  return [
    h('p', { class: 'eyebrow player__eyebrow' }, t('live.kickoff', { when: kickoffLabel(match, 'full') })),
    clock.node,
    match.tickets_left > 0 && h('a', { class: 'btn btn--primary', href: checkoutUrl(match) },
      icon('ticket'), h('span', { 'data-i18n': 'nav.buyTickets' })),
  ];
}

function fullTime(match) {
  return [
    h('p', { class: 'eyebrow player__eyebrow', 'data-i18n': 'live.fullTime' }),
    h('p', { class: 'player__score' }, scoreLabel(match)),
    h('p', { class: 'player__eyebrow', 'data-i18n': 'live.noHighlights' }),
  ];
}

// Stream when an admin set one, otherwise: live match center, countdown, or highlights / full time.
export function renderPlayer(container, match, { onKickoff }) {
  const stream = embedUrl(match.stream_url);
  const video = stream ?? (match.status === 'finished' ? embedUrl(match.highlights_url) : null);
  if (video && current.key === video) return; // keep the video playing across refreshes
  current.stop?.();
  current = { key: video, stop: null };

  if (video) {
    container.replaceChildren(frame(video, stream ? 'live.player.stream' : 'live.player.highlights', match));
  } else {
    const content = match.status === 'live' ? matchCenter(match)
      : match.status === 'upcoming' ? upcoming(match, onKickoff)
        : fullTime(match);
    const [image, credit] = backdrop(match);
    container.replaceChildren(...[image, h('div', { class: 'player__content' }, content), credit].filter(Boolean));
  }
  applyTranslations(container);
}
