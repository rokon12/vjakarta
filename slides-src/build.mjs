#!/usr/bin/env node
// Assembles the deck into one self-contained HTML file.
//   node build.mjs                          -> dist/slides.html (every slide)
//   node build.mjs --only 12-,14- --out x   -> only slide files whose name contains one of the fragments
//   node build.mjs --scenes overload        -> only these scene files (default: all of them)
//   node build.mjs --theme blueprint        -> themes/blueprint.css instead of DEFAULT_THEME
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : null;
};

const DEFAULT_THEME = 'blueprint';

const out = resolve(opt('out') || join(here, 'dist', 'slides.html'));
const theme = opt('theme') || DEFAULT_THEME;
const only = opt('only') ? opt('only').split(',').filter(Boolean) : null;
const scenes = opt('scenes') ? opt('scenes').split(',').filter(Boolean) : null;

const read = path => readFileSync(join(here, path), 'utf8');
const list = (dir, ext) =>
  existsSync(join(here, dir)) ? readdirSync(join(here, dir)).filter(f => f.endsWith(ext)).sort() : [];
const sceneFiles = ext => list('scenes', ext).filter(f => !scenes || scenes.includes(f.slice(0, -ext.length)));

const fail = message => {
  console.error(message);
  process.exit(1);
};

const themes = list('themes', '.css').map(f => f.slice(0, -'.css'.length));
if (!themes.includes(theme)) fail(`unknown theme: ${theme} (have: ${themes.join(', ')})`);
const themeCss = read(`themes/${theme}.css`).replace(/url\("font:([^"]+)"\)/g, (_, file) => {
  const path = `assets/fonts/${file}`;
  if (!existsSync(join(here, path))) fail(`missing font: ${path}`);
  return `url("data:font/woff2;base64,${readFileSync(join(here, path)).toString('base64')}")`;
});

let slideFiles = list('slides', '.html');
if (only) slideFiles = slideFiles.filter(f => only.some(fragment => f.includes(fragment)));
if (!slideFiles.length) {
  console.error('no slide files matched');
  process.exit(1);
}

const slides = slideFiles.map(f => `<!-- ${f} -->\n${read('slides/' + f).trim()}`).join('\n\n');
const sceneCss = sceneFiles('.css').map(f => `<style>\n/* ${f} */\n${read('scenes/' + f).trim()}\n</style>`).join('\n');
const sceneJs = sceneFiles('.js')
  .map(f => `<script>\n// ${f}\n(() => {\n${read('scenes/' + f).trim()}\n})();\n</script>`)
  .join('\n');

const problems = [];
const ids = [...slides.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) problems.push(`duplicate slide id: ${id}`);
for (const id of ids) if (id.includes('.')) problems.push(`slide id must not contain a dot: ${id}`);
const sectionCount = (slides.match(/<section\b/g) || []).length;
if (ids.length !== sectionCount) problems.push(`${sectionCount - ids.length} slide(s) have no id`);
for (const name of new Set([...slides.matchAll(/data-scene="([^"]+)"/g)].map(m => m[1]))) {
  if (!sceneJs.includes(`Deck.scene('${name}'`) && !sceneJs.includes(`Deck.scene("${name}"`)) {
    problems.push(`scene "${name}" is used on a slide but never registered`);
  }
}
for (const f of [...sceneFiles('.js').map(f => 'scenes/' + f), 'core/core.js']) {
  if (/<\/script/i.test(read(f))) problems.push(`${f} contains a closing script tag`);
}

const parts = {
  '/*@core.css*/': [read('core/base.css'), read('core/theme.css'), themeCss].map(css => css.trim()).join('\n\n'),
  '<!--@scenes.css-->': sceneCss,
  '<!--@slides-->': slides,
  '<!--@chrome-->': read('core/chrome.html').trim(),
  '/*@notes*/': !argv.includes('--no-notes') && existsSync(join(here, 'core/notes.json'))
    ? read('core/notes.json').replace(/</g, '\\u003c') : '{}',
  '/*@core.js*/': read('core/core.js').trim(),
  '<!--@scenes-->': sceneJs,
};

let html = read('core/shell.html');
for (const [marker, text] of Object.entries(parts)) {
  if (!html.includes(marker)) problems.push(`shell is missing ${marker}`);
  html = html.replace(marker, () => text);
}

if (/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/[^'"\s)]*/g, ''))) {
  const hit = html.replace(/http:\/\/www\.w3\.org\/[^'"\s)]*/g, '').match(/https?:\/\/[^'"\s)<]*/g);
  problems.push(`external URL in the deck (it must work offline): ${[...new Set(hit)].slice(0, 5).join(', ')}`);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB  ${sectionCount} slides`);
for (const p of problems) console.log('PROBLEM: ' + p);
process.exit(problems.length ? 2 : 0);
