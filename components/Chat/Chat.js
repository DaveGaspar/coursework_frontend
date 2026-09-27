import { announce } from '../../scripts/core/dom.js';
import { debounce } from '../../scripts/core/events.js';
import { formatTime } from '../../scripts/core/format.js';
import { loadTemplates, refs } from '../../scripts/core/template.js';
import { currentLocation, routeTo } from '../../scripts/core/url.js';
import { t } from '../../scripts/i18n/i18n.js';
import { connectChat } from '../../scripts/services/chat.js';
import { createAvatar } from '../Avatar/Avatar.js';

const use = await loadTemplates(new URL('./Chat.html', import.meta.url));
const MAX_LENGTH = 280;
const MAX_ROWS = 200;

// Live chat for one match. Returns { system(text) } for goal messages posted by the page.
export function mountChat(container, { matchId, user }) {
  const node = use('chat');
  const ref = refs(node);
  const list = ref.list;
  container.replaceChildren(node);

  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  const toBottom = () => {
    list.scrollTop = list.scrollHeight;
    ref.newPill.hidden = true;
  };

  // Screen readers get one summary per burst instead of every message.
  let pending = [];
  const flush = debounce(() => {
    announce(pending.length === 1 ? pending[0] : t('live.chat.newCount', { count: pending.length }));
    pending = [];
  }, 1500);
  const queueAnnounce = (text) => {
    pending.push(text);
    flush();
  };

  const add = (row, { stick = nearBottom() } = {}) => {
    ref.empty.remove();
    list.append(row);
    while (list.children.length > MAX_ROWS) list.firstElementChild.remove();
    if (stick) toBottom();
    else ref.newPill.hidden = false;
  };

  const receive = (message) => {
    if (message?.type !== 'message' || typeof message.user !== 'string' || typeof message.text !== 'string') return;
    const text = message.text.slice(0, MAX_LENGTH);
    const mine = message.user === user?.username;
    const row = use('chat-message');
    const r = refs(row);
    r.avatar.replaceWith(createAvatar(message.user, 'sm'));
    r.name.textContent = message.user;
    r.time.dateTime = message.sent_at;
    r.time.textContent = formatTime(message.sent_at);
    r.text.textContent = text;
    add(row, mine ? { stick: true } : undefined);
    if (!mine) queueAnnounce(t('live.chat.from', { name: message.user, text }));
  };

  const client = connectChat(matchId, receive);
  addEventListener('pagehide', () => client.disconnect());

  if (user) {
    ref.composer.hidden = false;
    const input = ref.composer.elements.namedItem('text');
    ref.composer.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      client.send({ type: 'message', match_id: matchId, user: user.username, text, sent_at: new Date().toISOString() });
      input.value = '';
    });
  } else {
    ref.signin.hidden = false;
    ref.signinLink.href = routeTo('signin', { next: currentLocation() });
  }
  ref.newPill.addEventListener('click', toBottom);
  list.addEventListener('scroll', () => {
    if (nearBottom()) ref.newPill.hidden = true;
  });

  return {
    system(text) {
      const row = use('chat-system');
      row.textContent = text;
      add(row);
      queueAnnounce(text);
    },
  };
}
