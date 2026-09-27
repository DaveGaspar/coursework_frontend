import { CHAT_WS_URL, DATA_SOURCE } from '../core/config.js';

// Both clients: connectChat(matchId, onMessage) returns { send(message), disconnect() }. Messages are never stored.

// Reaches other tabs of this browser only. BroadcastChannel doesn't echo to the sender, so send() delivers locally too.
function broadcastChat(matchId, onMessage) {
  const channel = new BroadcastChannel(`sl:chat:${matchId}`);
  channel.addEventListener('message', (event) => onMessage(event.data));
  return {
    send(message) {
      channel.postMessage(message);
      onMessage(message);
    },
    disconnect: () => channel.close(),
  };
}

// For the backend: the server adds the user from the session and echoes each message to everyone, sender included.
function websocketChat(matchId, onMessage) {
  const url = new URL(CHAT_WS_URL, location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('match', matchId);
  let socket;
  let attempt = 0;
  let closed = false;
  const open = () => {
    socket = new WebSocket(url);
    socket.addEventListener('open', () => { attempt = 0; });
    socket.addEventListener('message', (event) => {
      try { onMessage(JSON.parse(event.data)); } catch { /* ignore malformed frames */ }
    });
    socket.addEventListener('close', () => {
      if (!closed) setTimeout(open, Math.min(30000, 1000 * 2 ** attempt++));
    });
  };
  open();
  return {
    send({ text }) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'message', match_id: matchId, text }));
    },
    disconnect() {
      closed = true;
      socket.close();
    },
  };
}

export const connectChat = DATA_SOURCE === 'backend' ? websocketChat : broadcastChat;
