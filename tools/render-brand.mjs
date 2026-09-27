#!/usr/bin/env node
// Renders the PNG icons and Open Graph image from tools/brand/*.html with headless Chrome.
// Set CHROME_PATH if Chrome is not found. Run: node tools/render-brand.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const JOBS = [
  { src: 'og-image.html', out: 'og-image.png', width: 1200, height: 630, scale: 1 },
  { src: 'app-icon.html', out: 'icon-512.png', width: 512, height: 512, scale: 1 },
  { src: 'app-icon.html', out: 'icon-192.png', width: 512, height: 512, scale: 192 / 512 },
  { src: 'app-icon.html', out: 'apple-touch-icon.png', width: 512, height: 512, scale: 180 / 512 },
];

function main() {
  const chrome = CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.');
  const profile = join(tmpdir(), 'sports-live-render');
  mkdirSync(profile, { recursive: true });
  for (const job of JOBS) {
    const out = resolve(ROOT, 'assets/img', job.out);
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--user-data-dir=${profile}`, `--force-device-scale-factor=${job.scale}`,
      `--window-size=${job.width},${job.height}`, `--screenshot=${out}`,
      pathToFileURL(resolve(ROOT, 'tools/brand', job.src)).href,
    ], { stdio: 'ignore' });
    console.log(`Rendered ${job.out}`);
  }
  rmSync(profile, { recursive: true, force: true });
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
