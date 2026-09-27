import { h } from '../../scripts/core/dom.js';
import { loadTemplates, refs } from '../../scripts/core/template.js';
import { t } from '../../scripts/i18n/i18n.js';
import { kickoffLabel, liveLabel, liveUrl, matchTitle, shortTitle, sizedImage, statusLine } from '../../scripts/services/match-display.js';
import { createStatusBadge } from '../Badge/Badge.js';
import { createTeamLogo } from '../TeamLogo/TeamLogo.js';

const use = await loadTemplates(new URL('./MatchCard.html', import.meta.url));

function fallback(match) {
  const node = use('poster-fallback');
  const ref = refs(node);
  ref.home.replaceWith(createTeamLogo(match.home_team, { decorative: true }));
  ref.away.replaceWith(createTeamLogo(match.away_team, { decorative: true }));
  return node;
}

// Portrait poster linking to the match page. Without a poster image, both badges and "VS" are shown.
export function createMatchCard(match, { lazy = true } = {}) {
  const card = use('match-card');
  const ref = refs(card);
  card.href = liveUrl(match);
  card.setAttribute('aria-label', t('home.posterLabel', {
    title: matchTitle(match),
    status: t(`status.${match.status}`),
    when: statusLine(match),
  }));

  if (match.poster_url) {
    const img = h('img', {
      class: 'poster__img',
      src: sizedImage(match.poster_url, 'medium'),
      alt: '',
      width: 200,
      height: 280,
      loading: lazy ? 'lazy' : null,
      decoding: 'async',
    });
    img.addEventListener('error', () => img.replaceWith(fallback(match)), { once: true });
    card.prepend(img);
  } else {
    card.prepend(fallback(match));
  }
  card.append(createStatusBadge(match.status));
  ref.title.textContent = shortTitle(match);
  ref.meta.textContent = match.status === 'live' ? liveLabel(match) : kickoffLabel(match);
  return card;
}
