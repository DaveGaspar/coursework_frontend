#!/usr/bin/env node
// Checks translations and hard-coded text. Run: node tools/check-i18n.mjs
import { readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from './check-lines.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSLATIONS = resolve(ROOT, 'assets/i18n/translations.json');
const PLURAL_FORMS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
// The brand name is never translated.
const ALLOWED_TEXT = new Set(['Sports Live', 'SPORTS', 'LIVE', 'SPORTSLIVE', 'EN', 'ՀՅ']);
const USER_FACING_ATTRS = ['aria-label', 'alt', 'placeholder', 'title', 'aria-description'];

// Plural objects (only CLDR category children) count as one key.
export function flatten(obj, prefix = '') {
  const out = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      const children = Object.keys(value);
      if (children.length && children.every((c) => PLURAL_FORMS.has(c))) {
        out.set(path, 'plural');
        for (const c of children) out.set(`${path}.${c}`, 'leaf');
      } else {
        for (const [k, v] of flatten(value, path)) out.set(k, v);
      }
    } else {
      out.set(path, 'leaf');
    }
  }
  return out;
}

function namespaces(keys) {
  const set = new Set();
  for (const key of keys) {
    const parts = key.split('.');
    for (let i = 1; i < parts.length; i += 1) set.add(parts.slice(0, i).join('.'));
  }
  return set;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

async function main() {
  const problems = [];
  const dict = JSON.parse(await readFile(TRANSLATIONS, 'utf8'));
  const en = flatten(dict.en ?? {});
  const hy = flatten(dict.hy ?? {});

  for (const key of en.keys()) if (!hy.has(key)) problems.push(`hy is missing "${key}"`);
  for (const key of hy.keys()) if (!en.has(key)) problems.push(`en is missing "${key}" (present in hy)`);
  for (const [key, kind] of en) {
    if (kind === 'leaf' && hy.get(key) === 'leaf') {
      const e = key.split('.').reduce((o, k) => o[k], dict.en);
      const a = key.split('.').reduce((o, k) => o[k], dict.hy);
      if (typeof e !== 'string' || typeof a !== 'string') problems.push(`"${key}" must be a string in both languages`);
      else if (!a.trim()) problems.push(`hy "${key}" is empty`);
      else {
        const pe = [...e.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
        const pa = [...a.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
        if (pe !== pa) problems.push(`"${key}" placeholders differ: en {${pe}} vs hy {${pa}}`);
      }
    }
  }

  const known = new Set(en.keys());
  const spaces = namespaces(known);
  const topLevel = Object.keys(dict.en ?? {});
  const keyish = new RegExp(`^(${topLevel.join('|')})\\.[A-Za-z0-9_.]+$`);

  const files = (await walk(ROOT))
    .map((file) => ({ file, rel: relative(ROOT, file).split(sep).join('/') }))
    .filter(({ rel }) => ['.html', '.js'].includes(extname(rel)) && !rel.startsWith('tools/') && !rel.startsWith('docs/'));

  let refs = 0;
  for (const { file, rel } of files) {
    const text = await readFile(file, 'utf8');
    const check = (key, index, how) => {
      refs += 1;
      if (!known.has(key)) problems.push(`${rel}:${lineOf(text, index)} ${how} references missing key "${key}"`);
    };

    for (const m of text.matchAll(/data-i18n="([^"]+)"/g)) check(m[1], m.index, 'data-i18n');
    for (const m of text.matchAll(/data-i18n-attr="([^"]+)"/g)) {
      for (const pair of m[1].split(';')) {
        const key = pair.split(':')[1]?.trim();
        if (key) check(key, m.index, 'data-i18n-attr');
      }
    }

    if (extname(rel) === '.js') {
      for (const m of text.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)) check(m[2], m.index, 't()');
      for (const m of text.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)) {
        refs += 1;
        const prefix = m[1].replace(/\.$/, '');
        if (prefix && !spaces.has(prefix) && !known.has(prefix)) problems.push(`${rel}:${lineOf(text, m.index)} template t() uses unknown namespace "${prefix}"`);
      }
      for (const m of text.matchAll(/(['"])([A-Za-z][A-Za-z0-9_.]+)\1/g)) {
        if (keyish.test(m[2]) && !known.has(m[2]) && !spaces.has(m[2]) && !/\.(js|css|html|json|svg|png)$/.test(m[2])) {
          problems.push(`${rel}:${lineOf(text, m.index)} string "${m[2]}" looks like a missing translation key`);
        }
      }
    }

    if (extname(rel) === '.html') {
      const body = text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
      for (const m of body.matchAll(/>([^<>]+)</g)) {
        const txt = m[1].replace(/&[a-z#0-9]+;/gi, ' ').trim();
        if (txt && /\p{L}/u.test(txt) && !ALLOWED_TEXT.has(txt)) problems.push(`${rel}: hard-coded text "${txt.slice(0, 60)}"`);
      }
      for (const attr of USER_FACING_ATTRS) {
        for (const m of body.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, 'g'))) {
          if (m[1].trim() && /\p{L}/u.test(m[1]) && !ALLOWED_TEXT.has(m[1])) problems.push(`${rel}: hard-coded ${attr}="${m[1].slice(0, 60)}"`);
        }
      }
    }
  }

  console.log(`Translation keys: en ${en.size}, hy ${hy.size}. References checked: ${refs}.`);
  if (problems.length) {
    console.error(`\n✗ ${problems.length} i18n problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ i18n is consistent: identical key sets, no missing keys, no hard-coded HTML text.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
