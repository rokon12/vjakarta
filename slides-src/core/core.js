(() => {
  'use strict';

  const W = 1920;
  const H = 1080;
  const params = new URLSearchParams(location.search);
  const registry = {};
  const errors = [];
  const slides = [];
  let stage, viewport;
  let cur = -1;
  let step = 0;
  let jobs = [];
  let ticking = false;

  const Deck = window.Deck = {
    width: W,
    height: H,
    scale: 1,
    motion: !(params.has('still') || params.has('selftest') || params.has('fitcheck')),
    errors,
    scene(name, mount) { registry[name] = mount; },
  };

  // ---- helpers shared with scenes ----

  Deck.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  Deck.lerp = (a, b, t) => a + (b - a) * t;
  Deck.fmt = n => Math.round(n).toLocaleString('en-US');

  Deck.ease = {
    linear: t => t,
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  };

  Deck.rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function fill(node, attrs, kids) {
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'style' && typeof value === 'object') {
        for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v);
      } else node.setAttribute(key, value);
    }
    for (const kid of [].concat(kids == null ? [] : kids)) {
      if (kid != null) node.append(kid);
    }
    return node;
  }

  Deck.el = (tag, attrs, kids) => fill(document.createElement(tag), attrs, kids);
  Deck.svg = (tag, attrs, kids) =>
    fill(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, kids);

  // ---- one animation clock for every scene ----

  function report(err, where) {
    const message = (where ? where + ': ' : '') + (err && err.message ? err.message : String(err));
    errors.push(message);
    document.documentElement.setAttribute('data-errors', errors.length);
    console.error('[deck]', message, err);
  }

  function tick(now) {
    ticking = false;
    for (const job of jobs.slice()) {
      if (job.dead) continue;
      try {
        if (job.run(now) === false) job.dead = true;
      } catch (err) {
        job.dead = true;
        report(err, 'animation');
      }
    }
    jobs = jobs.filter(job => !job.dead);
    if (jobs.length) schedule();
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(tick);
  }

  function addJob(owner, run) {
    const job = { owner, run, dead: false, cancel() { job.dead = true; } };
    jobs.push(job);
    schedule();
    return job;
  }

  const idle = { cancel() {} };

  class Context {
    constructor(root) {
      this.root = root;
    }

    get motion() {
      return Deck.motion;
    }

    tween(ms, fn, opts = {}) {
      const ease = opts.ease || Deck.ease.out;
      const delay = opts.delay || 0;
      if (!Deck.motion || ms <= 0) {
        fn(1);
        if (opts.done) opts.done();
        return idle;
      }
      let start = null;
      return addJob(this, now => {
        if (start === null) start = now + delay;
        const p = (now - start) / ms;
        if (p < 0) return true;
        if (p >= 1) {
          fn(1);
          if (opts.done) opts.done();
          return false;
        }
        fn(ease(p));
        return true;
      });
    }

    loop(fn) {
      if (!Deck.motion) return idle;
      let last = null;
      let first = null;
      return addJob(this, now => {
        if (last === null) last = first = now;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        return fn(dt, (now - first) / 1000) !== false;
      });
    }

    after(ms, fn) {
      if (!Deck.motion || ms <= 0) {
        fn();
        return idle;
      }
      let start = null;
      return addJob(this, now => {
        if (start === null) start = now;
        if (now - start < ms) return true;
        fn();
        return false;
      });
    }

    cancel() {
      for (const job of jobs) if (job.owner === this) job.dead = true;
    }
  }

  // ---- slides, steps and scenes ----

  function readSlides() {
    for (const el of stage.querySelectorAll(':scope > section.slide')) {
      const frags = [...el.querySelectorAll('[data-step]')].map(node => ({
        el: node,
        from: parseInt(node.dataset.step, 10) || 0,
        until: node.dataset.until ? parseInt(node.dataset.until, 10) : Infinity,
      }));
      const last = frags.reduce(
        (max, f) => Math.max(max, f.from, isFinite(f.until) ? f.until : 0), 0);
      slides.push({
        el,
        id: el.id || 'slide-' + (slides.length + 1),
        title: el.dataset.title || el.id || '',
        section: el.dataset.section || '',
        sectionKey: el.dataset.sectionKey || '',
        layout: el.dataset.layout || '',
        min: el.dataset.min ? Number(el.dataset.min) : slides.length ? slides[slides.length - 1].min : 0,
        steps: el.dataset.steps ? parseInt(el.dataset.steps, 10) : last,
        frags,
        scenes: [],
      });
    }
  }

  function mountScenes() {
    for (const slide of slides) {
      for (const root of slide.el.querySelectorAll('[data-scene]')) {
        const name = root.dataset.scene;
        const mount = registry[name];
        if (!mount) {
          report(new Error('no scene named ' + name), slide.id);
          continue;
        }
        const ctx = new Context(root);
        try {
          const args = JSON.parse(root.dataset.args || '{}');
          slide.scenes.push({ name, ctx, inst: mount(root, args, ctx) || {} });
        } catch (err) {
          report(err, 'mount ' + name);
        }
      }
    }
  }

  function callScenes(slide, method, ...args) {
    for (const scene of slide.scenes) {
      if (typeof scene.inst[method] !== 'function') continue;
      try {
        scene.inst[method](...args);
      } catch (err) {
        report(err, scene.name + '.' + method);
      }
    }
  }

  function applySteps(slide, s) {
    slide.el.setAttribute('data-at-step', s);
    for (const frag of slide.frags) {
      const on = s >= frag.from && s < frag.until;
      frag.el.classList.toggle('is-on', on);
      frag.el.classList.toggle('is-new', on && frag.from === s);
      frag.el.classList.toggle('is-gone', s >= frag.until);
    }
  }

  function show(i, s, opts = {}) {
    i = Deck.clamp(i, 0, slides.length - 1);
    const slide = slides[i];
    s = Deck.clamp(s, 0, slide.steps);
    const prevSlide = cur;
    const prevStep = step;
    const same = i === prevSlide;
    if (same && s === prevStep && !opts.force) return;
    cur = i;
    step = s;

    if (!same) {
      if (prevSlide >= 0) {
        const old = slides[prevSlide];
        for (const scene of old.scenes) scene.ctx.cancel();
        callScenes(old, 'leave');
      }
      slides.forEach((other, k) => {
        other.el.classList.toggle('is-active', k === i);
        other.el.classList.toggle('is-past', k < i);
        other.el.classList.toggle('is-future', k > i);
        other.el.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });
      callScenes(slide, 'enter');
    }

    applySteps(slide, s);
    const animate = Deck.motion && opts.animate !== false;
    callScenes(slide, 'setStep', s, animate, same ? prevStep : -1);
    updateChrome();
    if (!opts.silent) writeHash();
  }

  function next() {
    startClock();
    if (step < slides[cur].steps) show(cur, step + 1);
    else if (cur < slides.length - 1) show(cur + 1, 0);
  }

  function prev() {
    if (step > 0) show(cur, step - 1, { animate: false });
    else if (cur > 0) show(cur - 1, slides[cur - 1].steps, { animate: false });
  }

  function replay() {
    const slide = slides[cur];
    for (const scene of slide.scenes) scene.ctx.cancel();
    callScenes(slide, 'setStep', step, Deck.motion, step > 0 ? step - 1 : -1);
  }

  Deck.next = next;
  Deck.prev = prev;
  Deck.go = (target, s = 0) => {
    const i = typeof target === 'number' ? target : slides.findIndex(sl => sl.id === target);
    if (i >= 0) show(i, s, { animate: false });
  };
  Deck.where = () => ({ index: cur, id: slides[cur].id, step, steps: slides[cur].steps });

  // ---- address bar ----

  function writeHash() {
    const hash = '#' + slides[cur].id + (step ? '.' + step : '');
    if (location.hash === hash) return;
    try {
      history.replaceState(null, '', hash);
    } catch (err) {
      location.hash = hash;
    }
  }

  function readHash() {
    let name = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!name) return null;
    let s = 0;
    const withStep = name.match(/^(.*)\.(\d+)$/);
    if (withStep) {
      name = withStep[1];
      s = parseInt(withStep[2], 10);
    }
    const i = /^\d+$/.test(name)
      ? parseInt(name, 10) - 1
      : slides.findIndex(slide => slide.id === name);
    return i >= 0 && i < slides.length ? { i, s } : null;
  }

  // ---- stage scaling and persistent chrome ----

  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    Deck.scale = scale;
    const x = (vw - W * scale) / 2;
    const y = (vh - H * scale) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function setText(selector, text) {
    for (const el of document.querySelectorAll(selector)) el.textContent = text;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function updateChrome() {
    const slide = slides[cur];
    const root = document.documentElement;
    root.setAttribute('data-slide', slide.id);
    root.setAttribute('data-layout', slide.layout);
    root.setAttribute('data-section-key', slide.sectionKey);
    root.style.setProperty('--progress', slides.length > 1 ? cur / (slides.length - 1) : 0);
    root.style.setProperty('--at', cur);
    root.style.setProperty('--min', slide.min);
    setText('[data-chrome="section"]', slide.section);
    setText('[data-chrome="title"]', slide.title);
    setText('[data-chrome="index"]', pad(cur + 1));
    setText('[data-chrome="total"]', pad(slides.length));
    markOverview();
    drawNotes();
  }

  // ---- clock ----

  let clockStart = 0;
  let clockTimer = 0;

  function loadClock() {
    try {
      clockStart = Number(sessionStorage.getItem('deck-clock')) || 0;
      if (sessionStorage.getItem('deck-clock-on') === '1') {
        document.documentElement.setAttribute('data-clock', 'on');
      }
    } catch (err) {}
    clockTimer = setInterval(drawClock, 500);
    drawClock();
  }

  function startClock() {
    if (clockStart) return;
    clockStart = Date.now();
    try { sessionStorage.setItem('deck-clock', clockStart); } catch (err) {}
  }

  function resetClock() {
    clockStart = 0;
    try { sessionStorage.removeItem('deck-clock'); } catch (err) {}
    drawClock();
  }

  function toggleClock() {
    const root = document.documentElement;
    const on = root.getAttribute('data-clock') !== 'on';
    root.setAttribute('data-clock', on ? 'on' : 'off');
    try { sessionStorage.setItem('deck-clock-on', on ? '1' : '0'); } catch (err) {}
  }

  function drawClock() {
    const seconds = clockStart ? Math.floor((Date.now() - clockStart) / 1000) : 0;
    setText('[data-chrome="clock"]', pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60));
    document.documentElement.style.setProperty('--clock-min', (seconds / 60).toFixed(2));
    if (notesWindow && !notesWindow.closed) {
      notesWindow.document.getElementById('clock').textContent = pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60);
    }
  }

  // ---- overlays: slide list, help, blackout, toast ----

  let overview, help, toastEl, black;
  let picked = 0;
  let toastTimer = 0;
  let digits = '';
  let digitTimer = 0;

  const KEYS = [
    ['→  ↓  space  PgDn  click', 'next step'],
    ['←  ↑  PgUp  shift-click', 'back'],
    ['number, then Enter', 'jump to a slide'],
    ['O', 'slide list'],
    ['F  or the corner button', 'full screen'],
    ['B  or  .', 'black screen'],
    ['R', 'replay this animation'],
    ['S', 'speaker notes in a second window'],
    ['T', 'show or hide the talk clock (shift-T resets it)'],
    ['M', 'motion on or off'],
    ['?', 'this help'],
  ];

  function buildOverlays() {
    overview = Deck.el('div', { id: 'deck-overview', hidden: '' });
    const list = Deck.el('ol');
    slides.forEach((slide, i) => {
      const item = Deck.el('li', { 'data-i': i }, [
        Deck.el('span', { class: 'n', text: pad(i + 1) }),
        Deck.el('span', { class: 's', text: slide.section }),
        Deck.el('span', { class: 't', text: slide.title }),
      ]);
      item.addEventListener('click', () => {
        toggleOverview(false);
        show(i, 0, { animate: false });
      });
      list.append(item);
    });
    overview.append(list);

    help = Deck.el('div', { id: 'deck-help', hidden: '' }, [
      Deck.el('dl', {}, KEYS.filter(([key]) => key !== 'S' || hasNotes()).flatMap(([key, what]) => [
        Deck.el('dt', { text: key }),
        Deck.el('dd', { text: what }),
      ])),
    ]);

    black = Deck.el('div', { id: 'deck-black', hidden: '' });
    toastEl = Deck.el('div', { id: 'deck-toast', hidden: '' });
    document.body.append(overview, help, black, toastEl);
  }

  function markOverview() {
    if (!overview) return;
    for (const item of overview.querySelectorAll('li')) {
      item.classList.toggle('is-current', Number(item.dataset.i) === cur);
      item.classList.toggle('is-picked', Number(item.dataset.i) === picked);
    }
  }

  function toggleOverview(open) {
    overview.hidden = !open;
    if (!open) return;
    picked = cur;
    markOverview();
    const item = overview.querySelector('li.is-picked');
    if (item) item.scrollIntoView({ block: 'center' });
  }

  function overviewKey(key) {
    if (key === 'Escape' || key === 'o') return toggleOverview(false);
    if (key === 'Enter' || key === ' ') {
      toggleOverview(false);
      return show(picked, 0, { animate: false });
    }
    const move = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[key];
    if (!move) return;
    picked = Deck.clamp(picked + move, 0, slides.length - 1);
    markOverview();
    overview.querySelector('li.is-picked').scrollIntoView({ block: 'nearest' });
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1400);
  }

  function toggleFullscreen() {
    const root = document.documentElement;
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const blocked = () => toast('full screen is blocked here · try ctrl-cmd-F');
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (request) Promise.resolve(request.call(root)).catch(blocked);
      else blocked();
    }
  }

  function watchFullscreen() {
    const sync = () => document.documentElement.classList.toggle('is-full',
      Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    document.getElementById('deck-fs').addEventListener('click', toggleFullscreen);
  }

  // ---- speaker notes, in a second window you keep on the laptop screen ----

  let notes = {};
  let notesWindow = null;
  const hasNotes = () => Object.keys(notes).length > 0;

  const NOTES_PAGE = `<!doctype html><title>Speaker notes</title><style>
    body { margin: 0; padding: 24px 28px; background: #0e1b2c; color: #fbfdfd; font: 500 26px/1.36 "Avenir Next", "Helvetica Neue", sans-serif; }
    header { display: flex; justify-content: space-between; font: 700 22px/1 "JetBrains Mono", Menlo, monospace; color: #ffc400; }
    h1 { margin: 16px 0 6px; font-size: 34px; }
    #goal { margin: 0 0 18px; color: #5fc6cf; font-weight: 700; }
    section { margin: 0 0 10px; padding: 10px 14px; border-left: 6px solid transparent; opacity: 0.45; }
    section.now { opacity: 1; border-color: #ffc400; background: #16263a; }
    p { margin: 0 0 8px; }
    .run { font: 700 24px/1.3 "JetBrains Mono", Menlo, monospace; color: #ffc400; }
    .tip, .more { font-size: 21px; color: #b9c6d4; }
    footer { margin-top: 22px; font-size: 22px; opacity: 0.7; }
  </style><header><span id="where"></span><span id="clock"></span></header><h1 id="title"></h1><p id="goal"></p><div id="lines"></div><footer id="next"></footer>`;

  function openNotes() {
    if (!hasNotes()) return toast('this copy has no speaker notes');
    notesWindow = window.open('', 'deck-notes', 'width=920,height=740');
    if (!notesWindow) return toast('allow pop-ups to see the notes');
    notesWindow.document.open();
    notesWindow.document.write(NOTES_PAGE);
    notesWindow.document.close();
    drawNotes();
    drawClock();
  }

  function drawNotes() {
    if (!notesWindow || notesWindow.closed) return;
    const doc = notesWindow.document;
    const slide = slides[cur];
    const entry = notes[slide.id] || { goal: '', clicks: [] };
    const current = Math.min(step, entry.clicks.length - 1);
    const line = (cls, text) => {
      const p = doc.createElement('p');
      p.className = cls;
      p.textContent = text;
      return p;
    };
    doc.getElementById('where').textContent = `slide ${cur + 1} of ${slides.length} · click ${step} of ${slide.steps}`;
    doc.getElementById('title').textContent = slide.title;
    doc.getElementById('goal').textContent = entry.goal;
    doc.getElementById('lines').replaceChildren(...entry.clicks.map((click, i) => {
      const block = doc.createElement('section');
      if (i === current) block.className = 'now';
      block.append(line('say', click.say));
      if (click.run) block.append(line('run', '▶ terminal: ' + click.run));
      if (click.tip) block.append(line('tip', click.tip));
      if (click.more) block.append(line('more', 'Background: ' + click.more));
      return block;
    }));
    const now = doc.querySelector('section.now');
    if (now) now.scrollIntoView({ block: 'nearest' });
    const next = slides[cur + 1];
    doc.getElementById('next').textContent = next ? 'Next slide: ' + next.title : 'Last slide';
  }

  // ---- input ----

  function typeDigit(d) {
    digits += d;
    toast('go to ' + digits + '  ⏎');
    clearTimeout(digitTimer);
    digitTimer = setTimeout(() => { digits = ''; }, 2500);
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
    const key = e.key;

    if (!black.hidden) {
      black.hidden = true;
      return e.preventDefault();
    }
    if (!help.hidden) {
      help.hidden = true;
      return e.preventDefault();
    }
    if (!overview.hidden) {
      overviewKey(key);
      return e.preventDefault();
    }

    let handled = true;
    switch (key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'n':
        next();
        break;
      case ' ':
        if (e.shiftKey) prev(); else next();
        break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': case 'p':
        prev();
        break;
      case 'Enter':
        if (digits) {
          show(parseInt(digits, 10) - 1, 0, { animate: false });
          digits = '';
          toastEl.hidden = true;
        } else next();
        break;
      case 'Home': show(0, 0, { animate: false }); break;
      case 'End': show(slides.length - 1, 0, { animate: false }); break;
      case 'f': toggleFullscreen(); break;
      case 'o': toggleOverview(true); break;
      case 'b': case '.': black.hidden = false; break;
      case 'r': replay(); break;
      case 's': openNotes(); break;
      case 't': toggleClock(); break;
      case 'T': resetClock(); break;
      case 'm':
        Deck.motion = !Deck.motion;
        document.documentElement.classList.toggle('no-motion', !Deck.motion);
        toast(Deck.motion ? 'motion on' : 'motion off');
        break;
      case '?': case 'h': help.hidden = false; break;
      case 'Escape': digits = ''; break;
      default:
        if (/^[0-9]$/.test(key)) typeDigit(key);
        else if (key.length === 1) {
          handled = slides[cur].scenes.some(scene =>
            typeof scene.inst.key === 'function' && scene.inst.key(key.toLowerCase()) === true);
        } else handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onClick(e) {
    if (e.target.closest('[data-interactive], a, button, input, select, #deck-overview')) return;
    if (!black.hidden) { black.hidden = true; return; }
    if (!help.hidden) { help.hidden = true; return; }
    if (e.shiftKey) prev(); else next();
  }

  function hideIdleCursor() {
    const root = document.documentElement;
    let timer = 0;
    let seen = null;
    const rest = () => {
      root.classList.add('is-idle');
      root.classList.remove('is-pointing');
    };
    const wake = () => {
      root.classList.remove('is-idle');
      clearTimeout(timer);
      timer = setTimeout(rest, 2500);
    };
    // Chrome re-sends mousemove when the page changes under a resting pointer; only real movement counts.
    window.addEventListener('mousemove', e => {
      const at = e.screenX + ',' + e.screenY;
      const moved = seen !== null && at !== seen;
      seen = at;
      if (!moved) return;
      root.classList.add('is-pointing');
      wake();
    });
    wake();
  }

  function onSwipe() {
    let x = 0, y = 0;
    viewport.addEventListener('touchstart', e => {
      x = e.changedTouches[0].clientX;
      y = e.changedTouches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - x;
      const dy = e.changedTouches[0].clientY - y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) next(); else prev();
    }, { passive: true });
  }

  // ---- checks run from the command line: ?selftest and ?fitcheck ----

  function writeReport(kind, lines) {
    document.body.append(Deck.el('pre', { id: 'deck-report', 'data-kind': kind, hidden: '', text: lines.join('\n') }));
    document.title = lines[0];
  }

  function everyState(visit) {
    let states = 0;
    for (let i = 0; i < slides.length; i++) {
      for (let s = 0; s <= slides[i].steps; s++) {
        show(i, s, { animate: false, silent: true, force: true });
        states++;
        if (visit) visit(slides[i], s);
      }
    }
    return states;
  }

  function selftest() {
    const states = everyState();
    for (let i = slides.length - 1; i >= 0; i--) {
      for (let s = slides[i].steps; s >= 0; s--) show(i, s, { animate: false, silent: true, force: true });
    }
    const scenes = slides.reduce((n, slide) => n + slide.scenes.length, 0);
    writeReport('selftest', [
      `${errors.length ? 'SELFTEST FAIL' : 'SELFTEST OK'} slides=${slides.length} states=${states} scenes=${scenes} errors=${errors.length}`,
      ...errors,
    ]);
  }

  function shown(node, root) {
    for (let n = node; n && n !== root.parentNode; n = n.parentNode) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return true;
  }

  function describe(node) {
    const cls = node.getAttribute('class');
    const text = (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (cls ? '.' + cls.trim().split(/\s+/).join('.') : '') + (text ? ' "' + text + '"' : '');
  }

  function inkBox(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect();
  }

  function ownText(node) {
    return [...node.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  }

  function fitcheck() {
    const found = new Map();
    const note = (kind, slide, s, node, extra) => {
      const key = kind + slide.id + describe(node);
      if (!found.has(key)) found.set(key, `${kind.padEnd(5)} ${slide.id}.${s}  ${describe(node)}${extra ? '  ' + extra : ''}`);
    };
    everyState((slide, s) => {
      const frame = stage.getBoundingClientRect();
      const scale = Deck.scale;
      for (const node of slide.el.querySelectorAll('*')) {
        const inSvg = node instanceof SVGElement && node.tagName.toLowerCase() !== 'svg';
        if (node.closest('[data-bleed]')) continue;
        const text = inSvg ? node.tagName.toLowerCase() === 'text' : ownText(node);
        if (inSvg && !text) continue;
        if (!shown(node, slide.el)) continue;
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const ink = text && !inSvg ? inkBox(node) : r;
        const box = [
          (Math.min(r.left, ink.left) - frame.left) / scale, (Math.min(r.top, ink.top) - frame.top) / scale,
          (Math.max(r.right, ink.right) - frame.left) / scale, (Math.max(r.bottom, ink.bottom) - frame.top) / scale,
        ].map(Math.round);
        if (box[0] < -1 || box[1] < -1 || box[2] > W + 1 || box[3] > H + 1) {
          note('OUT', slide, s, node, `[${box.join(',')}]`);
        }
        if (!text) continue;
        const cs = getComputedStyle(node);
        const zoom = inSvg ? r.height / Math.max(1, node.getBBox().height) / scale : 1;
        const size = parseFloat(cs.fontSize) * zoom;
        if (size < 26 && !node.closest('[data-fine]')) note('SMALL', slide, s, node, Math.round(size) + 'px');
        if (inSvg || !node.clientWidth) continue;
        const wide = node.scrollWidth > node.clientWidth + 2;
        const tall = node.scrollHeight > node.clientHeight + 2;
        if (cs.overflow !== 'visible' && (wide || tall)) note('CLIP', slide, s, node);
        else if (wide) note('SPILL', slide, s, node);
      }
    });
    const list = [...found.values()];
    writeReport('fitcheck', [
      `${list.length || errors.length ? 'FITCHECK FAIL' : 'FITCHECK OK'} slides=${slides.length} problems=${list.length} errors=${errors.length}`,
      ...list,
      ...errors,
    ]);
  }

  // ---- start ----

  Deck.start = () => {
    viewport = document.getElementById('viewport');
    stage = document.getElementById('stage');
    window.addEventListener('error', e => report(e.error || e.message, 'page'));
    document.documentElement.classList.toggle('no-motion', !Deck.motion || params.has('frames'));

    readSlides();
    try {
      notes = JSON.parse(document.getElementById('deck-notes').textContent);
    } catch (err) {}
    fit();
    mountScenes();
    buildOverlays();
    loadClock();

    const target = readHash() || { i: 0, s: 0 };
    if (params.has('play') && target.s > 0) {
      show(target.i, target.s - 1, { animate: false, silent: true });
      show(target.i, target.s, { silent: true });
    } else {
      show(target.i, target.s, { animate: params.has('play'), silent: true });
    }

    window.addEventListener('resize', fit);
    window.addEventListener('hashchange', () => {
      const t = readHash();
      if (t) show(t.i, t.s, { animate: false, silent: true });
    });
    document.addEventListener('keydown', onKey);
    viewport.addEventListener('click', onClick);
    onSwipe();
    hideIdleCursor();
    watchFullscreen();

    if (params.has('selftest')) selftest();
    if (params.has('fitcheck')) fitcheck();
    if (params.has('list')) {
      writeReport('list', [JSON.stringify(slides.map(s => ({ id: s.id, steps: s.steps, title: s.title })))]);
    }
    document.documentElement.classList.add('is-ready');
  };
})();
