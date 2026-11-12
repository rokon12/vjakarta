#!/usr/bin/env node
// Drive the deck in real time. Every state is reached the way the speaker reaches it, by pressing
// the right arrow on the state before it; after the motion has had time to finish, the text on
// screen is compared with the ?still frame of the same state.
//   node tools/live_run.mjs <deck.html> <out-dir> [wait-ms] [workers]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [deck, outDir, waitArg, workersArg] = process.argv.slice(2);
if (!deck || !outDir) {
  console.error('usage: node tools/live_run.mjs <deck.html> <out-dir> [wait-ms] [workers]');
  process.exit(64);
}
const WAIT = Number(waitArg || 7000);
const WORKERS = Number(workersArg || 8);
const url = 'file://' + resolve(deck);
mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(done => setTimeout(done, ms));

const VISIBLE = `(() => {
  const slide = document.querySelector('.slide.is-active');
  if (!slide) return null;
  const text = [];
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue.replace(/\\s+/g, ' ').trim();
    const el = node.parentElement;
    if (!value || !el) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    text.push(value);
  }
  return { hash: location.hash, text };
})()`;

const FPS = `new Promise(done => {
  let frames = 0;
  const from = performance.now();
  const frame = () => { frames++; performance.now() - from < 1000 ? requestAnimationFrame(frame) : done(frames); };
  requestAnimationFrame(frame);
})`;

async function browser(port) {
  const profile = mkdtempSync(join(tmpdir(), 'deck-live-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1920,1080', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('Chrome did not start on port ' + port);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(done => socket.addEventListener('open', done, { once: true }));
  const pending = new Map();
  const errors = [];
  let id = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      pending.get(message.id)?.(message.result || message.error);
      pending.delete(message.id);
    } else if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description || details.text);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
    }
  });
  const send = (method, params = {}) => new Promise(done => {
    pending.set(++id, done);
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  return {
    send,
    evaluate,
    errors,
    async open(address) {
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: address });
      for (let i = 0; i < 120; i++) {
        if (await evaluate("document.documentElement.classList.contains('is-ready')")) return;
        await sleep(50);
      }
      throw new Error('the deck never became ready at ' + address);
    },
    async press(key, code) {
      const event = { key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...event });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
    },
    async shoot(file) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
    },
    close() {
      socket.close();
      chrome.once('exit', () => {
        try {
          rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        } catch {}
      });
      chrome.kill();
    },
  };
}

const first = await browser(9400);
await first.open(url + '?list');
const slides = JSON.parse(await first.evaluate("document.getElementById('deck-report').textContent"));
first.close();

const states = [];
slides.forEach((slide, i) => {
  for (let step = 0; step <= slide.steps; step++) {
    states.push({ name: `${String(i + 1).padStart(2, '0')}-${slide.id}.${step}`, target: `${slide.id}.${step}` });
  }
});

const results = new Array(states.length);
let next = 0;

async function worker(n) {
  const b = await browser(9401 + n);
  await b.open(url);
  const fps = await b.evaluate(FPS);
  while (next < states.length) {
    const k = next++;
    const state = states[k];
    const seen = b.errors.length;
    const result = { name: state.name, fps };
    try {
      if (k === 0) {
        await b.open(url + '#' + state.target);
      } else {
        await b.open(url + '#' + states[k - 1].target);
        await sleep(700);
        await b.press('ArrowRight', 39);
        if (process.env.SAMPLE && state.target === process.env.SAMPLE) {
          result.samples = [];
          for (const at of [1000, 2000]) {
            await sleep(1000);
            result.samples.push({ at, text: (await b.evaluate(VISIBLE)).text.join(' | ').slice(0, 400) });
          }
        }
      }
      await sleep(WAIT);
      const live = await b.evaluate(VISIBLE);
      await b.shoot(join(outDir, state.name + '.png'));
      await b.open(url + '?still#' + state.target);
      await sleep(150);
      const still = await b.evaluate(VISIBLE);
      result.arrived = [state.target, state.target.replace(/\.0$/, '')].includes(live.hash.slice(1));
      result.hash = live.hash;
      const a = live.text;
      const s = still.text;
      result.same = a.length === s.length && a.every((value, i) => value === s[i]);
      if (!result.same) {
        result.onlyLive = a.filter(value => !s.includes(value)).slice(0, 12);
        result.onlyStill = s.filter(value => !a.includes(value)).slice(0, 12);
        result.counts = [a.length, s.length];
      }
    } catch (error) {
      result.failed = String(error.message || error);
    }
    result.errors = b.errors.slice(seen);
    results[k] = result;
  }
  b.close();
}

await Promise.all(Array.from({ length: WORKERS }, (_, n) => worker(n)));
writeFileSync(join(outDir, 'report.json'), JSON.stringify(results, null, 1));

const bad = results.filter(r => r.failed || !r.arrived || !r.same || r.errors.length);
console.log(`${results.length} states driven live, ${results.length - bad.length} match their still frame, ${bad.length} differ`);
console.log('frames per second seen by the workers:', [...new Set(results.map(r => r.fps))].join(', '));
for (const r of results) if (r.samples) console.log('SAMPLES', r.name, JSON.stringify(r.samples));
for (const r of bad) {
  console.log(`\n${r.name}${r.failed ? '  FAILED ' + r.failed : ''}${r.arrived === false ? '  ended at ' + r.hash : ''}`);
  if (r.errors.length) console.log('  errors:', r.errors.join(' ; '));
  if (r.same === false) {
    console.log('  only live :', JSON.stringify(r.onlyLive), 'tokens', r.counts[0]);
    console.log('  only still:', JSON.stringify(r.onlyStill), 'tokens', r.counts[1]);
  }
}
