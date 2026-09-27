// Local web server for Sports Live. Needs only Node.js (no npm install).
//   node server.js              → http://localhost:3000
//   node server.js --open       → also opens the browser
//   node server.js --port 4000  → another port
//   node server.js --host 0.0.0.0 → reachable from other devices on the network
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const PORT = Number(option('--port') ?? process.env.PORT ?? 3000);
const HOST = option('--host') ?? '127.0.0.1';
const OPEN = args.includes('--open');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function findFile(urlPath) {
  const path = decodeURIComponent(urlPath);
  // Never serve hidden files such as .git.
  if (path.split('/').some((part) => part.startsWith('.'))) return null;
  const file = resolve(ROOT, `.${path.endsWith('/') ? `${path}index.html` : path}`);
  if (!file.startsWith(ROOT) && `${file}${sep}` !== ROOT) return null;
  try {
    const info = await stat(file);
    if (info.isDirectory()) return findFile(`${path}/`);
    return info.isFile() ? file : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let file = null;
  try {
    file = await findFile(new URL(req.url, 'http://localhost').pathname);
  } catch {
    file = null;
  }
  const status = file ? 200 : 404;
  file ??= join(ROOT, '404.html');
  try {
    const body = await readFile(file);
    res.writeHead(status, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

function openBrowser(url) {
  const command = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {});
}

// If the port is taken, try the next few.
function listen(port, triesLeft = 10) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      listen(port + 1, triesLeft - 1);
    } else {
      console.error(err.message);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    const url = `http://localhost:${port}/`;
    console.log(`Sports Live is running at ${url}`);
    console.log('Press Ctrl+C to stop.');
    if (OPEN) openBrowser(url);
  });
}

listen(PORT);
