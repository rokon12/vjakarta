#!/usr/bin/env node
// Run the deck's built-in checks in headless Chrome.
//   node tools/check.mjs <deck.html> selftest    every slide and step, forwards and backwards, must run without errors
//   node tools/check.mjs <deck.html> fitcheck    nothing outside the stage, no small or clipped text
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [file, kind = 'selftest'] = process.argv.slice(2);
if (!file || !['selftest', 'fitcheck'].includes(kind)) {
  console.error('usage: node tools/check.mjs <deck.html> selftest|fitcheck');
  process.exit(64);
}
const profile = mkdtempSync(join(tmpdir(), 'deck-check-'));
let dom = '';
try {
  dom = execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--disable-gpu', '--window-size=1920,1080', `--user-data-dir=${profile}`,
    '--dump-dom', `file://${resolve(file)}?${kind}`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
} finally {
  rmSync(profile, { recursive: true, force: true });
}
const match = dom.match(/<pre id="deck-report"[^>]*>([\s\S]*?)<\/pre>/);
if (!match) {
  console.log(`${kind.toUpperCase()} FAIL no report in the page (did the deck script crash before Deck.start finished?)`);
  process.exit(1);
}
const text = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
console.log(text);
process.exit(/ OK /.test(text.split('\n')[0]) ? 0 : 1);
