const { svg, el, clamp } = Deck;

const SALE_FROM = 10000;
const SALE_TO = 13000;
const END = 18000;
const BASE_RATE = 60;
const SALE_RATE = 700;
const CONNECTIONS = 20;
const PROVIDER = 20;
const HOLDS = 4;
const HOLD_MS = 11.76;
const PAY_MS = 55;
const RETRIES = 3;
const JITTER = 200;
const DOOR = 24;
const DEADLINE = 500;
const PER_TOKEN = 4;

const MEASURED = {
  flood: { inFlight: 829, retries: 4000, last: 939, refused: 4939 },
  door: { inFlight: 24, retries: 243, last: 926, refused: 293 },
};

const PITCH = 24;
const ROWS = 13;
const COLUMNS = 26;

// The service: reservations arrive, each holds 4 seats through 20 connections and pays once
// through a provider that takes 20 at a time and refuses the rest.
class Service {
  constructor(door, scripted) {
    this.door = door;
    this.scripted = scripted;
    this.t = 0;
    this.due = 0;
    this.active = [];
    this.waiting = [];
    this.pool = new Array(CONNECTIONS).fill(null);
    this.provider = new Array(PROVIDER).fill(null);
    this.retryAt = new Map();
    this.inFlight = 0;
    this.turnedAway = 0;
    this.refused = 0;
    this.retries = 0;
    this.failed = 0;
    this.trace = [];
    this.random = Deck.rng(7);
  }

  get sale() {
    return this.scripted && this.t >= SALE_FROM && this.t < SALE_TO;
  }

  get shownAsSale() {
    const last = this.t - 1;
    return this.scripted && last >= SALE_FROM && last <= SALE_TO;
  }

  rate() {
    return this.sale ? SALE_RATE : BASE_RATE;
  }

  tick() {
    const t = this.t;
    this.pool = this.pool.map(slot => {
      while (slot && slot.until <= t) {
        this.holdDone(slot.request);
        const next = this.waiting.shift();
        slot = next ? { request: next, from: slot.until, until: slot.until + HOLD_MS } : null;
      }
      return slot;
    });
    this.provider = this.provider.map(slot => {
      if (!slot || slot.until > t) return slot;
      slot.request.paid = true;
      this.settle(slot.request);
      return null;
    });
    for (const request of this.retryAt.get(t) || []) this.charge(request);
    this.retryAt.delete(t);
    this.due += this.rate() / 1000;
    while (this.due >= 1) {
      this.due -= 1;
      this.arrive();
    }
    if (t % 50 === 0 && t <= END) this.trace.push(this.inFlight);
    if (t % 500 === 0) this.active = this.active.filter(request => !request.done);
    this.t = t + 1;
  }

  arrive() {
    if (this.door && this.inFlight >= DOOR) {
      this.turnedAway++;
      return;
    }
    const request = { arrived: this.t, holdsLeft: HOLDS, paid: false, failed: false, tries: 0, done: false };
    this.inFlight++;
    this.active.push(request);
    for (let i = 0; i < HOLDS; i++) this.hold(request);
    this.charge(request);
  }

  hold(request) {
    const free = this.pool.indexOf(null);
    if (free >= 0) this.pool[free] = { request, from: this.t, until: this.t + HOLD_MS };
    else this.waiting.push(request);
  }

  holdDone(request) {
    request.holdsLeft--;
    this.settle(request);
  }

  charge(request) {
    const free = this.provider.indexOf(null);
    if (free >= 0) {
      this.provider[free] = { request, from: this.t, until: this.t + PAY_MS };
      return;
    }
    this.refused++;
    if (request.tries < RETRIES) {
      request.tries++;
      this.retries++;
      const at = this.t + 1 + Math.floor(this.random() * JITTER);
      if (!this.retryAt.has(at)) this.retryAt.set(at, []);
      this.retryAt.get(at).push(request);
      return;
    }
    request.failed = true;
    this.failed++;
    this.settle(request);
  }

  settle(request) {
    if (request.done || request.holdsLeft > 0 || !(request.paid || request.failed)) return;
    request.done = true;
    this.inFlight--;
  }

  get late() {
    return this.active.filter(request => !request.done && this.t - request.arrived > DEADLINE).length;
  }

  runTo(ms) {
    while (this.t <= ms) this.tick();
    return this;
  }
}

Deck.scene('overload', (root, args, ctx) => {
  const mode = args.mode === 'door' ? 'door' : 'flood';
  const door = mode === 'door';
  const W = root.clientWidth;
  const stepEnds = door ? [9000, 13000, 17000] : [9000, 13000, 17000, 17000];
  const summaryStep = stepEnds.length - 1;

  const gate = 960;
  const floor = 378;
  const chart = { x: 90, y: 480, w: 910, h: 120 };
  const sx = ms => chart.x + (ms / END) * chart.w;
  const sy = n => chart.y + chart.h - Math.min(n, 900) * (chart.h / 900);

  const stage = svg('svg', { viewBox: `0 0 ${W} ${root.clientHeight}`, width: W, height: root.clientHeight, style: { overflow: 'visible' } });
  const add = (tag, attrs, parent = stage) => parent.appendChild(svg(tag, attrs));
  root.append(stage);

  // traffic
  add('text', { class: 'lbl sm', x: 0, y: 30, text: 'TRAFFIC' });
  add('line', { class: 'rule', x1: 0, y1: 40, x2: 230, y2: 40 });
  const rate = add('text', { class: 'val', x: -4, y: 160, style: { 'font-size': '124px' } });
  add('text', { class: 'sub', x: 0, y: 204, text: 'reservations / second' });
  add('line', { class: 'wire', x1: 0, y1: floor + 2, x2: gate, y2: floor + 2 });
  const stream = Array.from({ length: 6 }, () => add('rect', { class: 'tok is-run', y: floor - 22, width: 18, height: 18 }));

  if (door) {
    add('line', { class: 'wire', x1: 262, y1: 56, x2: 262, y2: floor, 'stroke-width': 8 });
    add('text', { class: 'lbl sm', x: 0, y: 262, text: 'DOOR' });
    add('text', { class: 'sub', x: 0, y: 298, text: `at most ${DOOR} in flight` });
  }
  const turned = Array.from({ length: 6 }, () => add('rect', { class: 'tok is-off', width: 18, height: 18, visibility: 'hidden' }));

  // the pile of reservations in flight, oldest nearest the pool
  const count = add('text', { class: 'val', x: 540, y: 36, 'text-anchor': 'middle', style: { 'font-size': '60px' } });
  const countNumber = add('tspan', {}, count);
  add('tspan', { text: ' IN FLIGHT', class: 'lbl' }, count);
  add('rect', { class: 'tok is-wait', x: 560, y: floor + 22, width: 18, height: 18 });
  add('text', { class: 'lbl sm', x: 588, y: floor + 42, text: `= ${PER_TOKEN} PARKED` });
  add('rect', { class: 'tok is-late', x: 780, y: floor + 22, width: 18, height: 18 });
  add('text', { class: 'lbl sm', x: 808, y: floor + 42, text: 'LATE' });
  const pile = [];
  for (let i = 0; i < ROWS * COLUMNS; i++) {
    const column = Math.floor(i / ROWS);
    const row = i % ROWS;
    pile.push(add('rect', {
      class: 'tok is-wait', width: 18, height: 18, visibility: 'hidden',
      x: gate - (column + 1) * PITCH + 3, y: floor - (row + 1) * PITCH + 3,
    }));
  }

  // pool: twenty connections in two columns
  add('text', { class: 'lbl sm', x: 990, y: 30, text: 'POOL · 20' });
  add('line', { class: 'rule', x1: 990, y1: 40, x2: 1262, y2: 40 });
  const bars = [];
  for (let i = 0; i < CONNECTIONS; i++) {
    const x = 990 + Math.floor(i / 10) * 140;
    const y = 58 + (i % 10) * 32;
    add('rect', { class: 'box', x, y, width: 128, height: 26 });
    bars.push(add('rect', { class: 'bar is-run', x: x + 4, y: y + 4, width: 0, height: 18 }));
  }

  // the payment provider: twenty at a time, the rest refused
  const px = 1304;
  const pw = W - px;
  add('text', { class: 'lbl sm', x: px, y: 30, text: 'PAYMENT PROVIDER · 20' });
  add('line', { class: 'rule', x1: px, y1: 40, x2: W, y2: 40 });
  add('rect', { class: 'box is-heavy', x: px, y: 58, width: pw, height: 320 });
  const cells = [];
  for (let i = 0; i < PROVIDER; i++) {
    const x = px + 30 + (i % 5) * ((pw - 60) / 5);
    const y = 84 + Math.floor(i / 5) * 54;
    add('rect', { class: 'box', x, y, width: (pw - 60) / 5 - 16, height: 40 });
    cells.push(add('rect', { class: 'bar is-run', x: x + 4, y: y + 4, width: (pw - 60) / 5 - 24, height: 32, visibility: 'hidden' }));
  }
  const refusedText = add('text', { class: 'sub', x: px + pw / 2, y: 340, 'text-anchor': 'middle', style: { 'font-size': '36px' } });
  const refusals = Array.from({ length: 6 }, () => add('rect', { class: 'tok is-off', width: 18, height: 18, visibility: 'hidden' }));

  // strip chart of reservations in flight over the eighteen seconds
  add('rect', { class: 'plot-ground', x: chart.x, y: chart.y, width: chart.w, height: chart.h });
  const band = add('rect', { class: 'plot-band', x: sx(SALE_FROM), y: chart.y, width: sx(SALE_TO) - sx(SALE_FROM), height: chart.h });
  for (let s = 0; s <= 18; s += 2) {
    if (s > 0) add('line', { class: 'plot-grid', x1: sx(s * 1000), y1: chart.y, x2: sx(s * 1000), y2: chart.y + chart.h });
    add('line', { class: 'plot-tick', x1: sx(s * 1000), y1: chart.y + chart.h, x2: sx(s * 1000), y2: chart.y + chart.h + 10 });
    add('text', { class: 'plot-num', x: sx(s * 1000), y: chart.y + chart.h + 38, 'text-anchor': 'middle', text: String(s) });
  }
  add('text', { class: 'plot-num', x: chart.x + chart.w + 24, y: chart.y + chart.h + 38, text: 's' });
  for (const n of [0, 400, 800]) {
    add('line', { class: 'plot-tick', x1: chart.x - 10, y1: sy(n), x2: chart.x, y2: sy(n) });
    add('text', { class: 'plot-num', x: chart.x - 16, y: sy(n) + 10, 'text-anchor': 'end', text: String(n) });
  }
  add('path', { class: 'plot-axis', d: `M${chart.x} ${chart.y} V${chart.y + chart.h} H${chart.x + chart.w + 8}` });
  const trace = add('path', { class: `plot-trace ${door ? 'blue' : 'red'}` });
  const pen = add('g');
  const penArm = add('line', { class: 'plot-pen-arm', x1: 0, x2: 0, y1: chart.y }, pen);
  add('rect', { class: 'plot-pen-car', x: -17, y: chart.y - 9, width: 34, height: 18 }, pen);
  const penTip = add('circle', { class: 'plot-pen-tip', r: 9 }, pen);
  const saleLabel = add('text', { class: 'lbl sm', x: sx(SALE_FROM), y: chart.y - 14, text: 'SALE · 700 A SECOND' });

  // readouts
  function readout(label) {
    const win = el('span', { class: 'win' });
    const row = el('div', { class: 'ro' }, [el('span', { class: 'lb', text: label }), win, el('span', { class: 'un', text: '' })]);
    return { row, win, shown: '' };
  }
  const flightOut = readout('In flight');
  const retriesOut = readout('Retries');
  const lastOut = readout(door ? 'Turned away' : 'Failed');
  root.append(el('div', { class: 'readouts', style: { left: '1110px', top: '408px', width: '600px' } },
    [flightOut.row, retriesOut.row, lastOut.row]));

  function show(out, value, tone) {
    out.row.classList.toggle('alarm', tone === 'alarm');
    out.row.classList.toggle('good', tone === 'good');
    const text = String(value);
    if (out.shown === text) return;
    out.shown = text;
    out.win.replaceChildren(...[...text].map(ch => el('i', { text: ch })));
  }

  // drawing
  let pileShown = -1;
  let lateShown = -1;

  function drawService(service) {
    const tokens = Math.min(Math.ceil(service.inFlight / PER_TOKEN), pile.length);
    const late = Math.min(Math.ceil(service.late / PER_TOKEN), tokens);
    if (tokens !== pileShown || late !== lateShown) {
      pile.forEach((token, i) => {
        token.setAttribute('visibility', i < tokens ? 'visible' : 'hidden');
        token.setAttribute('class', i < late ? 'tok is-late' : 'tok is-wait');
      });
      pileShown = tokens;
      lateShown = late;
    }
    service.pool.forEach((slot, i) => {
      const done = slot ? clamp((service.t - slot.from) / (slot.until - slot.from), 0, 1) : 0;
      bars[i].setAttribute('width', (120 * done).toFixed(1));
      bars[i].setAttribute('class', slot && service.t - slot.request.arrived > DEADLINE ? 'bar is-leak' : 'bar is-run');
    });
    service.provider.forEach((slot, i) => cells[i].setAttribute('visibility', slot ? 'visible' : 'hidden'));
    stream.forEach((token, i) => token.setAttribute('x', (((service.t / (service.shownAsSale ? 260 : 900) + i / 6) % 1) * 240).toFixed(1)));

    rate.textContent = service.shownAsSale ? SALE_RATE : BASE_RATE;
    rate.style.fill = service.shownAsSale ? 'var(--red)' : 'var(--ink)';
    countNumber.textContent = service.inFlight;
    countNumber.style.fill = service.inFlight > DOOR ? 'var(--red)' : 'var(--ink)';
    const refusing = service.provider.every(Boolean);
    refusedText.textContent = refusing ? 'refusing charges' : 'every charge accepted';
    refusedText.style.fill = refusing ? 'var(--red)' : 'var(--ink-2)';
    show(flightOut, service.inFlight, service.inFlight > DOOR ? 'alarm' : '');
    retriesOut.row.style.visibility = 'hidden';
    lastOut.row.style.visibility = 'hidden';
  }

  function drawSummary() {
    const measured = MEASURED[mode];
    refusedText.textContent = `refused ${Deck.fmt(measured.refused)} charges`;
    refusedText.style.fill = 'var(--red)';
    show(flightOut, measured.inFlight, door ? '' : 'alarm');
    show(retriesOut, measured.retries, 'alarm');
    show(lastOut, measured.last, door ? '' : 'alarm');
    retriesOut.row.style.visibility = 'visible';
    lastOut.row.style.visibility = 'visible';
  }

  function drawTrace(service) {
    const points = service.trace.map((n, i) => `${i ? 'L' : 'M'}${sx(i * 50).toFixed(1)} ${sy(n).toFixed(1)}`);
    trace.setAttribute('d', points.join(' '));
    const last = service.trace.length - 1;
    const y = sy(service.trace[last] || 0);
    pen.setAttribute('transform', `translate(${sx(last * 50)} 0)`);
    penArm.setAttribute('y2', y);
    penTip.setAttribute('cy', y);
  }

  function drawBounces(tokens, ages, fromX, toX, y) {
    tokens.forEach((token, i) => {
      const age = ages[i];
      token.setAttribute('visibility', age == null ? 'hidden' : 'visible');
      if (age == null) return;
      token.setAttribute('x', (fromX + (toX - fromX) * (age / 0.4)).toFixed(1));
      token.setAttribute('y', (y + age * 260).toFixed(1));
      token.setAttribute('opacity', (1 - age / 0.4).toFixed(2));
    });
  }

  // playback
  let experiment;

  function at(ms) {
    return new Service(door, true).runTo(ms);
  }

  function hold(summary) {
    const ambient = new Service(door, false).runTo(1000);
    for (const counter of ['turnedAway', 'refused', 'retries', 'failed']) ambient[counter] = experiment[counter];
    ctx.loop(dt => {
      ambient.runTo(ambient.t + dt * 1000);
      drawService(ambient);
      if (summary) drawSummary();
    });
  }

  function play(until, then) {
    const doorAges = [];
    const providerAges = [];
    ctx.loop(dt => {
      const turnedBefore = experiment.turnedAway;
      const refusedBefore = experiment.refused;
      experiment.runTo(Math.min(until, experiment.t + dt * 1000));
      for (const ages of [doorAges, providerAges]) {
        for (let i = 0; i < ages.length; i++) if (ages[i] != null && (ages[i] += dt) > 0.4) ages[i] = null;
      }
      if (experiment.turnedAway > turnedBefore) doorAges[experiment.turnedAway % turned.length] = 0;
      if (experiment.refused > refusedBefore) providerAges[experiment.refused % refusals.length] = 0;
      drawService(experiment);
      drawTrace(experiment);
      drawBounces(turned, doorAges, 236, 66, floor - 22);
      drawBounces(refusals, providerAges, px - 30, 1262, 260);
      if (experiment.t < until) return true;
      drawBounces(turned, [], 0, 0, 0);
      drawBounces(refusals, [], 0, 0, 0);
      if (then) then();
      return false;
    });
  }

  return {
    setStep(step, animate, from) {
      ctx.cancel();
      const end = stepEnds[step];
      const start = step > 0 ? stepEnds[step - 1] : end;
      const frozen = end === SALE_TO;
      const summary = step === summaryStep;
      band.setAttribute('visibility', step > 0 ? 'visible' : 'hidden');
      saleLabel.setAttribute('visibility', step > 0 ? 'visible' : 'hidden');
      drawBounces(turned, [], 0, 0, 0);
      drawBounces(refusals, [], 0, 0, 0);

      if (animate && end > start && from === step - 1) {
        experiment = at(start);
        play(end, frozen ? null : () => hold(summary));
        return;
      }
      experiment = at(end);
      drawService(experiment);
      drawTrace(experiment);
      if (summary) drawSummary();
      if (!frozen) hold(summary);
    },
  };
});
