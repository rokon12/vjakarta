// Measures a plain page (not the deck) at one screen size: text size, tap targets, clipped labels, sideways scroll.
//   node tools/page_probe.mjs <page.html> <width> <height>
import { resolve } from 'node:path';
import { browser, sleep } from './cdp.mjs';

const [file, ...size] = process.argv.slice(2);
const [width, height] = size.map(Number);
if (!file || size.length !== 2 || !(width > 0 && height > 0)) {
  console.error('usage: node tools/page_probe.mjs <page.html> <width> <height>');
  process.exit(2);
}
const page = await browser(0, { width, height, mobile: true, touch: true });
await page.send('Page.navigate', { url: 'file://' + resolve(file) });
for (let i = 0; i < 100 && await page.evaluate('document.readyState') !== 'complete'; i++) await sleep(50);
await page.evaluate('document.fonts.ready.then(() => true)');

const result = await page.evaluate(`(() => {
  const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ').join('.') : '');
  const text = el => el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40);

  const smallText = [...document.body.querySelectorAll('*')]
    .filter(el => shown(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(el => ({ el: name(el), text: text(el), px: parseFloat(getComputedStyle(el).fontSize) }))
    .filter(t => t.px < 16);

  const smallTaps = [...document.querySelectorAll('a, button, input, select, textarea, summary')]
    .filter(shown)
    .map(el => {
      const target = el.closest('label') || el;
      const box = target.getBoundingClientRect();
      return { el: name(target), text: text(target), w: Math.round(box.width), h: Math.round(box.height) };
    })
    .filter(t => t.w < 44 || t.h < 44);

  const clipped = [...document.querySelectorAll('.hb')]
    .filter(el => el.textContent.trim())
    .map(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const ink = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { text: text(el), need: [Math.round(ink.width), Math.round(ink.height)], have: [Math.round(box.width), Math.round(box.height)],
        out: ink.left < box.left - 0.5 || ink.right > box.right + 0.5 || ink.top < box.top - 0.5 || ink.bottom > box.bottom + 0.5 };
    })
    .filter(label => label.out)
    .map(({ out, ...label }) => label);

  return { innerWidth, scrollWidth: document.documentElement.scrollWidth, smallText, smallTaps, clipped };
})()`);

page.close();
if (page.errors.length) result.errors = page.errors;
console.log(JSON.stringify(result));
