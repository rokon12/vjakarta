#!/usr/bin/env node
// Reads computed styles, painted colors and text contrast from a built deck in headless Chrome.
// Prints one JSON document.
//   node tools/style_probe.mjs <deck.html> states
//   node tools/style_probe.mjs <deck.html> styles <spec.json>    [{ state, selector, pseudo, props }]
//   node tools/style_probe.mjs <deck.html> colors                every color painted in any state
//   node tools/style_probe.mjs <deck.html> contrast              text below 3:1 (24 px and up) or 4.5:1
//   node tools/style_probe.mjs <deck.html> fonts                 document.fonts after they settle
//   node tools/style_probe.mjs <deck.html> page                  sizes, the slide, the phone hint
//   node tools/style_probe.mjs <deck.html> swipe <state> left|right
// Any mode takes --device desktop|phone-upright|phone-sideways (default desktop).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDeck, sleep } from './cdp.mjs';

const DEVICES = {
  desktop: { width: 1920, height: 1080 },
  'phone-upright': { width: 390, height: 844, mobile: true, touch: true },
  'phone-sideways': { width: 844, height: 390, mobile: true, touch: true },
};
const args = process.argv.slice(2);
const at = args.indexOf('--device');
const device = at >= 0 ? args.splice(at, 2)[1] : 'desktop';
const [file, mode, arg, arg2] = args;
const MODES = ['states', 'styles', 'colors', 'contrast', 'fonts', 'page', 'swipe'];
if (!file || !MODES.includes(mode) || (['styles', 'swipe'].includes(mode) && !arg) || !DEVICES[device]) {
  console.error(`usage: node tools/style_probe.mjs <deck.html> ${MODES.join('|')} [arg] [--device ${Object.keys(DEVICES).join('|')}]`);
  process.exit(64);
}

const PAGE = String.raw`window.__probe = (() => {
  const parse = value => {
    const m = value && value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const shown = el => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const opacityOf = el => {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  };
  const roots = () => ['stage', 'chrome'].map(id => document.getElementById(id)).filter(Boolean);
  const where = el => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      parts.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].join('.') : ''));
      if (e.id) break;
    }
    return parts.join(' > ');
  };
  const SHAPES = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline']);

  function states() {
    return [...document.querySelectorAll('section.slide[id]')].flatMap(s => {
      const steps = Math.max(Number(s.dataset.steps || 0),
        ...[...s.querySelectorAll('[data-step]')].map(e => Number(e.dataset.step) || 0));
      return Array.from({ length: steps + 1 }, (_, i) => s.id + '.' + i);
    });
  }

  function go(state) {
    if (location.hash !== '#' + state) location.hash = state;
    return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 30))));
  }

  function styles(selector, pseudo, props) {
    const all = [...document.querySelectorAll(selector)];
    const el = all.find(shown) || all[0];
    if (!el) return null;
    const cs = getComputedStyle(el, pseudo || null);
    return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
  }

  function colors() {
    const found = new Map();
    const add = (value, el) => {
      for (const m of String(value).match(/rgba?\([^)]+\)/g) || []) {
        const c = parse(m);
        if (c && c.a > 0 && !found.has(m)) found.set(m, where(el));
      }
    };
    const followed = new Set();
    const scan = el => {
      const cs = getComputedStyle(el);
      const svg = el instanceof SVGElement;
      if (!svg && [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) add(cs.color, el);
      add(cs.backgroundColor, el);
      add(cs.backgroundImage, el);
      add(cs.boxShadow, el);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (parseFloat(cs.getPropertyValue('border-' + side + '-width')) > 0 && cs.getPropertyValue('border-' + side + '-style') !== 'none') {
          add(cs.getPropertyValue('border-' + side + '-color'), el);
        }
      }
      if (svg) {
        add(cs.fill, el);
        if (parseFloat(cs.strokeWidth) > 0) add(cs.stroke, el);
        for (const value of [cs.fill, cs.stroke, cs.markerStart, cs.markerMid, cs.markerEnd]) {
          const ref = String(value).match(/url\("?#([^")]+)"?\)/);
          if (!ref || followed.has(ref[1])) continue;
          followed.add(ref[1]);
          const target = document.getElementById(ref[1]);
          if (target) for (const inner of target.querySelectorAll('*')) scan(inner);
        }
      }
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content === 'none' || ps.content === 'normal') continue;
        add(ps.color, el);
        add(ps.backgroundColor, el);
        add(ps.backgroundImage, el);
      }
    };
    for (const root of roots()) for (const el of [root, ...root.querySelectorAll('*')]) if (shown(el)) scan(el);
    return [...found].map(([value, example]) => ({ value, example }));
  }

  const luminance = ({ r, g, b }) => {
    const ch = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });

  function backgroundAt(x, y, self) {
    const layers = [];
    for (const e of document.elementsFromPoint(x, y)) {
      if (e instanceof SVGElement) {
        if (!SHAPES.has(e.tagName.toLowerCase())) continue;
        const cs = getComputedStyle(e);
        const fill = parse(cs.fill);
        if (!fill) continue;
        fill.a *= Number(cs.fillOpacity) * opacityOf(e);
        if (fill.a > 0) layers.push(fill);
      } else {
        const fill = parse(getComputedStyle(e).backgroundColor);
        if (!fill) continue;
        fill.a *= opacityOf(e);
        if (fill.a > 0) layers.push(fill);
      }
      if (layers.length && layers[layers.length - 1].a >= 1) break;
    }
    let color = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) color = over(layer, color);
    return color;
  }

  function contrast() {
    const found = [];
    for (const root of roots()) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue.replace(/\s+/g, ' ').trim();
        const el = node.parentElement;
        if (!text || !el || !shown(el)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0);
        if (!rect || rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        const fg = parse(el instanceof SVGElement ? cs.fill : cs.color);
        if (!fg) continue;
        fg.a *= opacityOf(el);
        const bg = backgroundAt(rect.left + rect.width / 2, rect.top + rect.height / 2, el);
        const ink = over(fg, bg);
        const [hi, lo] = [luminance(ink), luminance(bg)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = parseFloat(cs.fontSize);
        if (ratio < (size >= 24 ? 3 : 4.5)) {
          const rgb = c => 'rgb(' + [c.r, c.g, c.b].map(Math.round).join(', ') + ')';
          found.push({ text: text.slice(0, 60), color: rgb(ink), background: rgb(bg), ratio: Math.round(ratio * 100) / 100, size, where: where(el) });
        }
      }
    }
    return found;
  }

  async function fonts() {
    await document.fonts.ready;
    return [...document.fonts].map(f => ({ family: f.family.replace(/^"|"$/g, ''), status: f.status }));
  }

  function page() {
    const box = el => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height };
    };
    const hint = getComputedStyle(document.body, '::after');
    const drawn = !['none', 'normal'].includes(hint.content);
    const top = parseFloat(hint.top);
    const height = parseFloat(hint.height);
    return {
      scrollWidth: document.scrollingElement.scrollWidth,
      innerWidth,
      innerHeight,
      stage: box(document.getElementById('stage')),
      background: getComputedStyle(document.body).backgroundColor,
      hint: {
        content: hint.content,
        display: drawn ? hint.display : 'none',
        color: hint.color,
        fontSize: hint.fontSize,
        rect: { top, height, bottom: top + height, left: parseFloat(hint.left), width: parseFloat(hint.width) },
      },
    };
  }

  return { states, go, styles, colors, contrast, fonts, page };
})();`;

const deck = await openDeck('file://' + resolve(file) + '?still', DEVICES[device]);
await deck.evaluate(PAGE);
const call = (fn, ...args) => deck.evaluate(`__probe.${fn}(${args.map(a => JSON.stringify(a ?? null)).join(', ')})`);

let result;
if (mode === 'states') {
  result = await call('states');
} else if (mode === 'fonts') {
  result = { families: await call('fonts') };
} else if (mode === 'page') {
  result = await call('page');
} else if (mode === 'swipe') {
  await call('go', arg);
  const { w, h } = await deck.evaluate('({ w: innerWidth, h: innerHeight })');
  const [from, to] = arg2 === 'right' ? [0.25, 0.75] : [0.75, 0.25];
  await deck.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w * from, y: h / 2 }] });
  await deck.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w * to, y: h / 2 }] });
  await deck.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  result = { hash: await deck.evaluate('location.hash') };
} else if (mode === 'styles') {
  result = [];
  for (const item of JSON.parse(readFileSync(arg, 'utf8'))) {
    await call('go', item.state);
    result.push({ ...item, values: await call('styles', item.selector, item.pseudo, item.props) });
  }
} else {
  const seen = new Map();
  result = [];
  for (const state of await call('states')) {
    await call('go', state);
    for (const row of await call(mode)) {
      if (mode === 'contrast') {
        const key = row.text + '|' + row.color + '|' + row.background;
        if (!seen.has(key)) result.push(seen.set(key, { state, ...row }).get(key));
      } else if (seen.has(row.value)) {
        seen.get(row.value).states.push(state);
      } else {
        result.push(seen.set(row.value, { value: row.value, states: [state], example: row.example }).get(row.value));
      }
    }
  }
}
deck.close();
console.log(JSON.stringify(result, null, 1));
process.exit(0);
