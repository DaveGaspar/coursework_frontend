#!/usr/bin/env node
// Fails if a code file has more than 500 lines. Run: node tools/check-lines.mjs
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_LINES = 500;
const CODE_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.claude', '.lighthouse', '.vscode']);
// Shared building blocks may be longer.
const EXEMPT = [
  /^styles\/index\.css$/,
  /^components\//,
  /^assets\/i18n\/translations\.json$/,
];

export async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) files.push(...(await walk(resolve(dir, entry.name))));
    } else {
      files.push(resolve(dir, entry.name));
    }
  }
  return files;
}

export function countLines(text) {
  if (text === '') return 0;
  const lines = text.split(/\r\n|\r|\n/);
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

async function main() {
  const files = (await walk(ROOT))
    .map((file) => ({ file, rel: relative(ROOT, file).split(sep).join('/') }))
    .filter(({ rel }) => CODE_EXTENSIONS.has(extname(rel)));

  const report = [];
  const failures = [];
  for (const { file, rel } of files) {
    const lines = countLines(await readFile(file, 'utf8'));
    const exempt = EXEMPT.some((re) => re.test(rel));
    report.push({ rel, lines, exempt });
    if (!exempt && lines > MAX_LINES) failures.push({ rel, lines });
  }

  const largest = [...report].sort((a, b) => b.lines - a.lines).slice(0, 5);
  console.log(`Checked ${report.length} code files. Largest:`);
  for (const { rel, lines, exempt } of largest) console.log(`  ${String(lines).padStart(5)}  ${rel}${exempt ? '  (exempt)' : ''}`);

  if (failures.length) {
    console.error(`\n✗ ${failures.length} file(s) exceed ${MAX_LINES} lines:`);
    for (const { rel, lines } of failures) console.error(`  ${lines}  ${rel}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ No file exceeds ${MAX_LINES} lines.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
