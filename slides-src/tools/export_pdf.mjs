#!/usr/bin/env node
// Exports a built deck to PDF for Speaker Deck and the like: one 1920 x 1080 page per slide,
// in its final state, or one per click with --every-click. Animations become their last frame.
//   node slides-src/tools/export_pdf.mjs <deck.html> <out.pdf> [--every-click]
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDeck } from './cdp.mjs';

const args = process.argv.slice(2);
const everyClick = args.includes('--every-click');
const [file, out] = args.filter(a => !a.startsWith('--'));
if (!file || !out) {
  console.error('usage: node slides-src/tools/export_pdf.mjs <deck.html> <out.pdf> [--every-click]');
  process.exit(64);
}

const deck = await openDeck('file://' + resolve(file) + '?still');
const slides = await deck.evaluate(`[...document.querySelectorAll('section.slide[id]')].map(s => [s.id,
  Math.max(Number(s.dataset.steps || 0), ...[...s.querySelectorAll('[data-step]')].map(e => Number(e.dataset.step) || 0))])`);
const states = slides.flatMap(([id, steps]) =>
  everyClick ? Array.from({ length: steps + 1 }, (_, i) => `${id}.${i}`) : [`${id}.${steps}`]);

const shots = [];
for (const state of states) {
  await deck.evaluate(`new Promise(done => {
    if (location.hash !== '#${state}') location.hash = '${state}';
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60)));
  })`);
  shots.push((await deck.send('Page.captureScreenshot', { format: 'png' })).data);
}

const dir = mkdtempSync(join(tmpdir(), 'deck-pdf-'));
const pages = join(dir, 'pages.html');
writeFileSync(pages, '<!doctype html><style>@page { size: 1920px 1080px; margin: 0 } body { margin: 0 }'
  + ' img { display: block; width: 1920px; height: 1080px } img + img { break-before: page }</style>'
  + shots.map(data => `<img src="data:image/png;base64,${data}">`).join(''));
await deck.open('file://' + pages);
const pdf = await deck.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
writeFileSync(resolve(out), Buffer.from(pdf.data, 'base64'));
deck.close();
rmSync(dir, { recursive: true, force: true });

const mb = statSync(resolve(out)).size / 1048576;
console.log(`${out}  ${states.length} pages  ${mb.toFixed(1)} MB${mb > 150 ? '  (over Speaker Deck’s 150 MB for free accounts)' : ''}`);
process.exit(0);
