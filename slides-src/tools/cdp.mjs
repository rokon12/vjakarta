// Headless Chrome driven over the DevTools protocol, shared by live_run.mjs and style_probe.mjs.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(done => setTimeout(done, ms));
// a deck is ready when the engine says so; any other page when it has loaded
const READY = "document.readyState === 'complete' && (!document.getElementById('stage') || document.documentElement.classList.contains('is-ready'))";

// port 0 lets Chrome pick a free port and tell us through DevToolsActivePort
export async function browser(port = 0, { width = 1920, height = 1080, mobile = false, touch = false } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'deck-live-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${width},${height}`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try {
      const at = port || Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      target = (await (await fetch(`http://127.0.0.1:${at}/json/list`)).json()).find(t => t.type === 'page');
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
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
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
        if (await evaluate(READY)) return;
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

export async function openDeck(url, options = {}) {
  const deck = await browser(0, options);
  await deck.open(url);
  return deck;
}
