import { h, hashString, initials } from '../../scripts/core/dom.js';
import { applyTranslations } from '../../scripts/i18n/i18n.js';
import { sizedImage } from '../../scripts/services/match-display.js';

const PIXELS = { sm: 24, md: 40, lg: 64, xl: 96 };
const TINTS = 6;
const sized = (url, size) => sizedImage(url, size === 'xl' ? 'small' : 'tiny');

function monogram(team, size, decorative) {
  const tint = hashString(team?.name ?? '') % TINTS;
  const node = h('span', {
    class: ['team-logo', size !== 'md' && `team-logo--${size}`, 'team-logo--mono', `team-logo--tint-${tint}`],
    role: decorative ? null : 'img',
    'aria-hidden': decorative ? 'true' : null,
    'data-i18n-attr': decorative ? null : 'aria-label:a11y.teamLogo',
    'data-i18n-params': JSON.stringify({ team: team?.name ?? '' }),
  }, initials(team?.name));
  applyTranslations(node);
  return node;
}

// Team badge. When the image is missing or fails, a monogram with the team's initials is shown instead.
// Use `decorative` when the team name is already written next to the logo.
export function createTeamLogo(team, { size = 'md', decorative = false, lazy = true } = {}) {
  if (!team?.logo_url) return monogram(team, size, decorative);
  const img = h('img', {
    class: ['team-logo', size !== 'md' && `team-logo--${size}`],
    src: sized(team.logo_url, size),
    width: PIXELS[size],
    height: PIXELS[size],
    alt: '',
    loading: lazy ? 'lazy' : null,
    decoding: 'async',
    'data-i18n-attr': decorative ? null : 'alt:a11y.teamLogo',
    'data-i18n-params': decorative ? null : JSON.stringify({ team: team.name }),
  });
  img.addEventListener('error', () => img.replaceWith(monogram(team, size, decorative)), { once: true });
  applyTranslations(img);
  return img;
}
