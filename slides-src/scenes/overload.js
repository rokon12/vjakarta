const { svg, el, clamp } = Deck;

const SLOTS = 8;
const ARRIVAL_MS = 5;
const SLOW_FROM = 2000;
const SLOW_TO = 5000;
const END = 9000;
const FAST_QUERY = 23.5;
const SLOW_QUERY = 84.8;
const DEADLINE = 500;
const LIMIT = 32;
const MEASURED_REJECTED = 291;

const PITCH = 24;
const ROWS = 13;
const COLUMNS = 26;

// The service itself: arrivals every 5 ms, eight connections, an optional admission limit.
class Service {
  constructor(limit, scripted) {
    this.limit = limit;
    this.scripted = scripted;
    this.t = 0;
    this.queue = [];
    this.slots = new Array(SLOTS).fill(null);
    this.rejected = 0;
    this.recent = [];
    this.trace = [];
  }

  query(at) {
    return this.scripted && at >= SLOW_FROM && at < SLOW_TO ? SLOW_QUERY : FAST_QUERY;
  }

  get busy() {
    return this.slots.filter(Boolean).length;
  }

  get inFlight() {
    return this.queue.length + this.busy;
  }

  get slow() {
    return this.scripted && this.t > SLOW_FROM + 1 && this.t <= SLOW_TO + 1;
  }

  get slowest() {
    return this.recent.reduce((max, r) => Math.max(max, r.took), 0);
  }

  tick() {
    const t = this.t;
    for (let i = 0; i < SLOTS; i++) {
      let slot = this.slots[i];
      while (slot && slot.until <= t) {
        this.recent.push({ at: slot.until, took: slot.until - slot.arrived });
        slot = this.queue.length
          ? { arrived: this.queue.shift(), from: slot.until, until: slot.until + this.query(slot.until) }
          : null;
      }
      this.slots[i] = slot;
    }
    if (t % ARRIVAL_MS === 0) this.arrive(t);
    if (t % 50 === 0 && t <= END) this.trace.push(this.inFlight);
    while (this.recent.length && this.recent[0].at < t - 1000) this.recent.shift();
    this.t = t + 1;
  }

  arrive(t) {
    if (this.limit && this.inFlight >= this.limit) {
      this.rejected++;
      return;
    }
    const free = this.slots.indexOf(null);
    if (free >= 0) this.slots[free] = { arrived: t, from: t, until: t + this.query(t) };
    else this.queue.push(t);
  }

  runTo(ms) {
    while (this.t <= ms) this.tick();
    return this;
  }
}

Deck.scene('overload', (root, args, ctx) => {
  const mode = args.mode || 'replay';
  const limit = mode === 'bounded' ? LIMIT : 0;
  const W = root.clientWidth;
  const stepEnds = mode === 'healthy' ? [2000, 2000] : mode === 'bounded' ? [2000, 5000, 9000] : [2000, 5000, 9000, 9000];

  const gate = 960;
  const floor = 378;
  const chart = { x: 90, y: 480, w: 910, h: 120 };
  const sx = ms => chart.x + (ms / END) * chart.w;
  const sy = n => chart.y + chart.h - Math.min(n, 400) * (chart.h / 400);

  const stage = svg('svg', { viewBox: `0 0 ${W} ${root.clientHeight}`, width: W, height: root.clientHeight, style: { overflow: 'visible' } });
  const add = (tag, attrs, parent = stage) => parent.appendChild(svg(tag, attrs));
  root.append(stage);

  // traffic
  add('text', { class: 'lbl sm', x: 0, y: 30, text: 'TRAFFIC' });
  add('line', { class: 'rule', x1: 0, y1: 40, x2: 230, y2: 40 });
  add('text', { class: 'val', x: -4, y: 160, style: { 'font-size': '124px' }, text: '200' });
  add('text', { class: 'sub', x: 0, y: 204, text: 'requests / second' });
  add('line', { class: 'wire', x1: 0, y1: floor + 2, x2: gate, y2: floor + 2 });
  const stream = Array.from({ length: 6 }, () => add('rect', { class: 'tok is-run', y: floor - 22, width: 18, height: 18 }));

  // the door of the bounded service
  if (limit) {
    add('line', { class: 'wire', x1: 262, y1: 56, x2: 262, y2: floor, 'stroke-width': 8 });
    add('text', { class: 'lbl sm', x: 0, y: 262, text: 'DOOR' });
    add('text', { class: 'sub', x: 0, y: 298, text: 'at most 32 in flight' });
  }
  const bounces = Array.from({ length: 6 }, () => add('rect', { class: 'tok is-off', width: 18, height: 18, visibility: 'hidden' }));

  // the pile of parked requests, oldest nearest the pool
  const count = add('text', { class: 'val', x: 540, y: 36, 'text-anchor': 'middle', style: { 'font-size': '60px' } });
  const countNumber = add('tspan', {}, count);
  add('tspan', { text: ' IN FLIGHT', class: 'lbl' }, count);
  add('rect', { class: 'tok is-wait', x: 742, y: 10, width: 18, height: 18 });
  add('text', { class: 'lbl sm', x: 770, y: 30, text: 'PARKED' });
  add('rect', { class: 'tok is-late', x: 880, y: 10, width: 18, height: 18 });
  add('text', { class: 'lbl sm', x: 908, y: 30, text: 'LATE' });
  const pile = [];
  for (let i = 0; i < ROWS * COLUMNS; i++) {
    const column = Math.floor(i / ROWS);
    const row = i % ROWS;
    pile.push(add('rect', {
      class: 'tok is-wait', width: 18, height: 18, visibility: 'hidden',
      x: gate - (column + 1) * PITCH + 3, y: floor - (row + 1) * PITCH + 3,
    }));
  }

  // pool
  add('text', { class: 'lbl sm', x: 990, y: 30, text: 'POOL · 8 CONNECTIONS' });
  add('line', { class: 'rule', x1: 990, y1: 40, x2: 1262, y2: 40 });
  const bars = [];
  for (let i = 0; i < SLOTS; i++) {
    const y = 58 + i * 40;
    add('text', { class: 'plot-num', x: 990, y: y + 27, text: String(i + 1) });
    add('rect', { class: 'box', x: 1022, y, width: 240, height: 34 });
    bars.push(add('rect', { class: 'bar is-run', x: 1028, y: y + 6, width: 0, height: 22 }));
  }
  add('line', { class: 'wire', x1: 1262, y1: 216, x2: 1298, y2: 216, 'marker-end': 'url(#arrow)' });

  // database
  add('text', { class: 'lbl sm', x: 1304, y: 30, text: 'DATABASE' });
  add('line', { class: 'rule', x1: 1304, y1: 40, x2: W, y2: 40 });
  add('rect', { class: 'box is-heavy', x: 1304, y: 58, width: W - 1307, height: 320 });
  const queryText = add('text', { class: 'val', x: 1304 + (W - 1304) / 2, y: 250, 'text-anchor': 'middle', style: { 'font-size': '170px' } });
  const queryNumber = add('tspan', {}, queryText);
  add('tspan', { text: ' ms', style: { 'font-size': '76px' } }, queryText);
  const queryNote = add('text', { class: 'sub', x: 1304 + (W - 1304) / 2, y: 326, 'text-anchor': 'middle', style: { 'font-size': '36px' } });

  // strip chart of in-flight requests over the nine seconds
  add('rect', { class: 'plot-ground', x: chart.x, y: chart.y, width: chart.w, height: chart.h });
  const band = add('rect', { class: 'plot-band', x: sx(SLOW_FROM), y: chart.y, width: sx(SLOW_TO) - sx(SLOW_FROM), height: chart.h });
  for (let s = 0; s <= 9; s++) {
    if (s > 0) add('line', { class: 'plot-grid', x1: sx(s * 1000), y1: chart.y, x2: sx(s * 1000), y2: chart.y + chart.h });
    add('line', { class: 'plot-tick', x1: sx(s * 1000), y1: chart.y + chart.h, x2: sx(s * 1000), y2: chart.y + chart.h + 10 });
    add('text', { class: 'plot-num', x: sx(s * 1000), y: chart.y + chart.h + 38, 'text-anchor': 'middle', text: String(s) });
  }
  add('text', { class: 'plot-num', x: chart.x + chart.w + 24, y: chart.y + chart.h + 38, text: 's' });
  for (const n of [0, 200, 400]) {
    add('line', { class: 'plot-tick', x1: chart.x - 10, y1: sy(n), x2: chart.x, y2: sy(n) });
    add('text', { class: 'plot-num', x: chart.x - 16, y: sy(n) + 10, 'text-anchor': 'end', text: String(n) });
  }
  add('path', { class: 'plot-axis', d: `M${chart.x} ${chart.y} V${chart.y + chart.h} H${chart.x + chart.w + 8}` });
  const trace = add('path', { class: 'plot-trace red' });
  const pen = add('g');
  const penArm = add('line', { class: 'plot-pen-arm', x1: 0, x2: 0, y1: chart.y }, pen);
  add('rect', { class: 'plot-pen-car', x: -17, y: chart.y - 9, width: 34, height: 18 }, pen);
  const penTip = add('circle', { class: 'plot-pen-tip', r: 9 }, pen);

  function bracket(from, to, y, label) {
    const g = add('g', { visibility: 'hidden' });
    add('line', { class: 'rule', x1: sx(from) + 2, y1: y, x2: sx(to) - 2, y2: y, 'marker-start': 'url(#arrow)', 'marker-end': 'url(#arrow)' }, g);
    add('line', { class: 'rule', x1: sx(from), y1: y - 12, x2: sx(from), y2: y + 12 }, g);
    add('line', { class: 'rule', x1: sx(to), y1: y - 12, x2: sx(to), y2: y + 12 }, g);
    add('text', { class: 'lbl sm', x: sx(to) + 16, y: y + 12, text: label }, g);
    return g;
  }
  const dbSpan = bracket(SLOW_FROM, SLOW_TO, 410, 'DATABASE SLOW · 3 s');
  const serviceSpan = bracket(2500, 7500, 450, 'SERVICE · 5 s');

  // readouts
  function readout(label, unit) {
    const win = el('span', { class: 'win' });
    const row = el('div', { class: 'ro' }, [el('span', { class: 'lb', text: label }), win, el('span', { class: 'un', text: unit })]);
    return { row, win, shown: '' };
  }
  const flight = readout('In flight', '');
  const slowestOut = readout('Slowest answer', 's');
  const rejectedOut = readout('Rejected', '');
  root.append(el('div', { class: 'readouts', style: { left: '1110px', top: '408px', width: '600px' } },
    [flight.row, slowestOut.row, rejectedOut.row]));

  function show(out, text, alarm) {
    out.row.classList.toggle('alarm', alarm);
    if (out.shown === text) return;
    out.shown = text;
    out.win.replaceChildren(...[...text].map(ch => el('i', { class: ch === '.' ? 'dot' : null, text: ch })));
  }

  // drawing
  let waitingShown = -1;
  let lateShown = -1;

  function drawService(service) {
    const waiting = Math.min(service.queue.length, pile.length);
    const late = service.queue.filter(arrived => service.t - arrived > DEADLINE).length;
    if (waiting !== waitingShown || late !== lateShown) {
      pile.forEach((token, i) => {
        token.setAttribute('visibility', i < waiting ? 'visible' : 'hidden');
        token.setAttribute('class', i < late ? 'tok is-late' : 'tok is-wait');
      });
      waitingShown = waiting;
      lateShown = late;
    }
    service.slots.forEach((slot, i) => {
      const done = slot ? clamp((service.t - slot.from) / (slot.until - slot.from), 0, 1) : 0;
      bars[i].setAttribute('width', (228 * done).toFixed(1));
      bars[i].setAttribute('class', slot && service.t - slot.arrived > DEADLINE ? 'bar is-leak' : 'bar is-run');
    });
    stream.forEach((token, i) => token.setAttribute('x', (((service.t / 900 + i / 6) % 1) * 240).toFixed(1)));

    const inFlight = service.inFlight;
    countNumber.textContent = inFlight;
    countNumber.style.fill = inFlight > LIMIT ? 'var(--red)' : 'var(--ink)';
    show(flight, String(inFlight), inFlight > LIMIT);
    show(slowestOut, (service.slowest / 1000).toFixed(1), service.slowest > DEADLINE);
    show(rejectedOut, String(Math.min(service.rejected, MEASURED_REJECTED)), false);

    queryNumber.textContent = service.slow ? 80 : 20;
    queryText.style.fill = service.slow ? 'var(--red)' : 'var(--ink)';
    queryNote.textContent = service.slow ? 'normally 20 ms' : 'a query';
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

  function drawBounces(ages) {
    bounces.forEach((token, i) => {
      const age = ages[i];
      token.setAttribute('visibility', age == null ? 'hidden' : 'visible');
      if (age == null) return;
      token.setAttribute('x', (236 - age * 420).toFixed(1));
      token.setAttribute('y', (floor - 22 + age * 260).toFixed(1));
      token.setAttribute('opacity', (1 - age / 0.4).toFixed(2));
    });
  }

  // playback
  let experiment;

  function at(ms) {
    return new Service(limit, true).runTo(ms);
  }

  function hold() {
    const ambient = new Service(limit, false).runTo(1000);
    ambient.rejected = experiment.rejected;
    ctx.loop(dt => {
      ambient.runTo(ambient.t + dt * 1000);
      drawService(ambient);
    });
  }

  function play(until, then) {
    const ages = [];
    ctx.loop(dt => {
      const before = experiment.rejected;
      experiment.runTo(Math.min(until, experiment.t + dt * 1000));
      for (let i = 0; i < ages.length; i++) if (ages[i] != null && (ages[i] += dt) > 0.4) ages[i] = null;
      if (experiment.rejected > before) ages[(experiment.rejected % bounces.length)] = 0;
      drawService(experiment);
      drawTrace(experiment);
      drawBounces(ages);
      if (experiment.t < until) return true;
      drawBounces([]);
      if (then) then();
      return false;
    });
  }

  return {
    setStep(step, animate, from) {
      ctx.cancel();
      const end = stepEnds[step];
      const start = step > 0 ? stepEnds[step - 1] : end;
      const frozen = end === SLOW_TO;
      band.setAttribute('visibility', step > 0 && mode !== 'healthy' ? 'visible' : 'hidden');
      dbSpan.setAttribute('visibility', step > 0 && mode !== 'healthy' ? 'visible' : 'hidden');
      serviceSpan.setAttribute('visibility', mode === 'replay' && step === 3 ? 'visible' : 'hidden');
      drawBounces([]);

      if (animate && end > start && from === step - 1) {
        experiment = at(start);
        play(end, frozen ? null : hold);
        return;
      }
      experiment = at(end);
      drawService(experiment);
      drawTrace(experiment);
      if (!frozen) hold();
    },
  };
});
