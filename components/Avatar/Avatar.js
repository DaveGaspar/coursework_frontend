import { h, initials } from '../../scripts/core/dom.js';

// Round badge with a user's initials. Decorative: the name is always shown or announced nearby.
export function createAvatar(name, size = 'md') {
  return h('span', { class: ['avatar', size !== 'md' && `avatar--${size}`], 'aria-hidden': 'true' }, initials(name));
}
