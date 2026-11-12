#!/usr/bin/env node
// Screenshot every step of every slide in its finished state.
//   node tools/shoot_all.mjs <deck.html> <out-dir>      writes <out-dir>/NN-<slide-id>.<step>.png
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [deck, outDir] = process.argv.slice(2);
if (!deck || !outDir) {
  console.error('usage: node tools/shoot_all.mjs <deck.html> <out-dir>');
  process.exit(64);
}
const url = 'file://' + resolve(deck);
mkdirSync(outDir, { recursive: true });

function chrome(args) {
  const profile = mkdtempSync(join(tmpdir(), 'deck-shot-'));
  return new Promise(done => {
    execFile(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--window-size=1920,1080', `--user-data-dir=${profile}`, ...args],
      { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
        rmSync(profile, { recursive: true, force: true });
        done(stdout || '');
      });
  });
}

const dom = await chrome(['--dump-dom', url + '?list']);
const match = dom.match(/<pre id="deck-report"[^>]*>([\s\S]*?)<\/pre>/);
if (!match) {
  console.error('the deck did not report its slides');
  process.exit(1);
}
const slides = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
const jobs = [];
slides.forEach((slide, i) => {
  for (let step = 0; step <= slide.steps; step++) {
    const name = `${String(i + 1).padStart(2, '0')}-${slide.id}.${step}.png`;
    jobs.push({ name, target: `${slide.id}.${step}` });
  }
});

let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    await chrome(['--virtual-time-budget=1200', `--screenshot=${resolve(outDir, job.name)}`, `${url}?still#${job.target}`]);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`${jobs.length} screenshots of ${slides.length} slides in ${resolve(outDir)}`);
