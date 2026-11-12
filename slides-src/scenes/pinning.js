// The pinning probe: 20 tasks on 2 carriers, each sleeps 100 ms inside its own synchronized block.
// Each run is a strip chart. The left cell of a row holds the threads that are there now,
// the rest of the row is the record of what that carrier (or the heap) did over time.

const TASKS = 20;
const CARRIERS = 2;
const ROUNDS = TASKS / CARRIERS;
const SLEEP_MS = 100;
const AXIS_MS = 1100;
const TICK_MS = 100;
const BEFORE = -1;

const TOK = 18;
const PITCH = 24;
const PER_ROW = 10;

const LABEL_W = 236;
const HEAD_W = PER_ROW * PITCH + 20;
const QUEUE_H = 70;
const RAIL_H = 26;
const LANE_H = 54;
const LANE_GAP = 6;
const AXIS_H = 42;
const PLATE_GAP = 16;
const LANE_NAMES = ['CARRIER 1', 'CARRIER 2', 'HEAP · PARKED'];
const HEAP = CARRIERS;
const LANES_TOP = QUEUE_H + RAIL_H;
const AXIS_Y = LANES_TOP + LANE_NAMES.length * (LANE_H + LANE_GAP) - LANE_GAP;
const RUN_H = AXIS_Y + AXIS_H;

const QUEUE = 'queue';
const CARRIER = 'carrier';
const PARKED = 'parked';
const DONE = { place: 'done' };

// JDK 21: a thread that sleeps while it holds a monitor cannot unmount, so it keeps its
// carrier for the whole sleep and the tasks go through two at a time.
function pinnedModel(totalMs) {
  const round = totalMs / ROUNDS;
  const mount = round - SLEEP_MS;
  const tasks = [];
  const bars = [];
  for (let i = 0; i < TASKS; i++) {
    const lane = i % CARRIERS;
    const from = Math.floor(i / CARRIERS) * round;
    tasks.push([{ until: from, place: QUEUE }, { until: from + round, place: CARRIER, lane }]);
    bars.push({ lane, from, to: from + mount, state: 'is-run' });
    bars.push({ lane, from: from + mount, to: from + round, state: 'is-lock', label: i + 1 });
  }
  return { tasks, bars, pins: true };
}

// JDK 25: the sleeping thread unmounts and parks with its monitor, so a carrier holds each
// task only for the instant it takes to reach the sleep, and all of them sleep at once.
function freeModel(totalMs) {
  const startUp = totalMs - SLEEP_MS;
  const hop = startUp / ROUNDS;
  const tasks = [];
  for (let i = 0; i < TASKS; i++) {
    const lane = i % CARRIERS;
    const mount = Math.floor(i / CARRIERS) * hop;
    tasks.push([
      { until: mount, place: QUEUE },
      { until: mount + hop, place: CARRIER, lane },
      { until: totalMs, place: PARKED },
    ]);
  }
  const bars = [{ lane: HEAP, from: startUp, to: totalMs, state: 'is-wait' }];
  for (let lane = 0; lane < CARRIERS; lane++) bars.push({ lane, from: 0, to: startUp, state: 'is-run' });
  return { tasks, bars, pins: false };
}

const RUNS = [
  {
    name: 'JDK 21',
    totalMs: 1037,
    model: pinnedModel,
    verdict: 'alarm',
    leadInMs: 800,
    fadeMs: 0,
    remarks: [
      { lane: HEAP, atMs: 15, parts: ['NOTHING PARKED · CARRIERS ', { red: 'PINNED' }, ' · 2 AT A TIME, 10 ROUNDS'] },
    ],
  },
  {
    name: 'JDK 25',
    credit: ['JEP 491', 'since JDK 24'],
    totalMs: 108,
    model: freeModel,
    verdict: 'good',
    leadInMs: 700,
    fadeMs: 300,
    remarks: [
      { lane: 0, atMs: 140, parts: ['FREE'] },
      { lane: 1, atMs: 140, parts: ['FREE'] },
      { lane: HEAP, atMs: 140, parts: ['ALL 20 PARKED AT ONCE, MONITORS STILL HELD'] },
    ],
  },
];

function laneY(k) {
  return LANES_TOP + k * (LANE_H + LANE_GAP);
}

function measure(width) {
  const headX = LABEL_W;
  const x0 = headX + HEAD_W;
  const scale = (width - x0 - 56) / AXIS_MS;
  return { width, headX, x0, scale, x: ms => x0 + ms * scale };
}

function phaseAt(task, t, totalMs) {
  if (t >= totalMs) return DONE;
  return task.find(phase => t < phase.until) || DONE;
}

function gridSeat(geo, top, height, n) {
  const inset = (PITCH - TOK) / 2;
  return {
    x: geo.headX + (HEAD_W - PER_ROW * PITCH) / 2 + (n % PER_ROW) * PITCH + inset,
    y: top + (height - 2 * PITCH) / 2 + Math.floor(n / PER_ROW) * PITCH + inset,
  };
}

function seatFor(geo, phase, index, queued) {
  if (phase.place === QUEUE) return gridSeat(geo, 0, QUEUE_H, queued);
  if (phase.place === PARKED) return gridSeat(geo, laneY(HEAP), LANE_H, index);
  return { x: geo.headX + 13, y: laneY(phase.lane) + (LANE_H - TOK) / 2 };
}

function rowLabel(name, top, height) {
  return Deck.svg('text', { class: 'lbl sm', x: 0, y: top + height / 2 + 13, text: name });
}

function box(x, y, width, height) {
  return Deck.svg('rect', { class: 'box', x, y, width, height });
}

function drawRows(svg, geo) {
  svg.append(rowLabel('RUNNABLE', 0, QUEUE_H), box(geo.headX, 2, HEAD_W, QUEUE_H - 4));
  LANE_NAMES.forEach((name, k) => {
    svg.append(rowLabel(name, laneY(k), LANE_H), box(geo.headX, laneY(k), geo.width - geo.headX - 2, LANE_H));
  });
}

function drawTimeAxis(svg, geo) {
  for (let ms = 0; ms <= AXIS_MS; ms += TICK_MS) {
    const x = geo.x(ms);
    if (ms > 0) {
      LANE_NAMES.forEach((name, k) => svg.append(Deck.svg('line', {
        class: 'plot-grid', x1: x, x2: x, y1: laneY(k) + 2, y2: laneY(k) + LANE_H - 2,
      })));
    }
    svg.append(
      Deck.svg('line', { class: 'plot-tick', x1: x, x2: x, y1: AXIS_Y, y2: AXIS_Y + 12 }),
      Deck.svg('text', {
        class: 'plot-num', x, y: AXIS_Y + 38, 'text-anchor': 'middle',
        text: ms < AXIS_MS ? Deck.fmt(ms) : 'ms',
      }));
  }
}

function drawOrigin(svg, geo) {
  svg.append(Deck.svg('line', { class: 'plot-axis', x1: geo.x0, x2: geo.x0, y1: LANES_TOP, y2: AXIS_Y }));
}

function addBar(svg, geo, bar) {
  const y = laneY(bar.lane) + 7;
  const height = LANE_H - 14;
  const rect = Deck.svg('rect', { class: 'bar ' + bar.state, x: geo.x(bar.from), y, width: 0, height });
  const label = bar.label && Deck.svg('text', {
    class: 'plot-num', x: geo.x((bar.from + bar.to) / 2), y: y + height / 2 + 11,
    'text-anchor': 'middle', text: bar.label,
  });
  svg.append(rect);
  if (label) svg.append(label);
  return { bar, rect, label };
}

function growBar(view, geo, now) {
  const reached = Math.min(now, view.bar.to);
  view.rect.toggleAttribute('hidden', reached <= view.bar.from);
  view.rect.setAttribute('width', Math.max(0, (reached - view.bar.from) * geo.scale));
  if (view.label) view.label.toggleAttribute('hidden', now < view.bar.to);
}

function addToken(svg) {
  return svg.appendChild(Deck.svg('rect', { class: 'tok', width: TOK, height: TOK }));
}

function addPinnedWords(svg, geo) {
  const words = [];
  for (let lane = 0; lane < CARRIERS; lane++) {
    words.push(svg.appendChild(Deck.svg('text', {
      class: 'lbl sm pinning-red', x: geo.headX + 13 + TOK + 14, y: laneY(lane) + LANE_H / 2 + 13, text: 'PINNED',
    })));
  }
  return words;
}

function addAllDone(svg, geo) {
  return svg.appendChild(Deck.svg('text', {
    class: 'sub', x: geo.headX + HEAD_W / 2, y: QUEUE_H / 2 + 11, 'text-anchor': 'middle', text: `all ${TASKS} done`,
  }));
}

function addRemark(svg, geo, remark) {
  const spans = remark.parts.map(part => (typeof part === 'string'
    ? Deck.svg('tspan', { text: part })
    : Deck.svg('tspan', { class: 'pinning-red', text: part.red })));
  return svg.appendChild(Deck.svg('text', {
    class: 'lbl sm', x: geo.x(remark.atMs), y: laneY(remark.lane) + LANE_H / 2 + 13,
  }, spans));
}

function addPen(svg) {
  return svg.appendChild(Deck.svg('g', {}, [
    Deck.svg('line', { class: 'plot-pen-arm', x1: 0, x2: 0, y1: LANES_TOP - 2, y2: AXIS_Y }),
    Deck.svg('rect', { class: 'plot-pen-car', x: -17, y: LANES_TOP - 19, width: 34, height: 18 }),
    Deck.svg('circle', { class: 'plot-pen-tip', r: 10, cy: AXIS_Y }),
  ]));
}

function addPlates(frame, geo, spec) {
  const plates = [['Run', spec.name]].concat(spec.credit ? [spec.credit] : []);
  frame.append(Deck.el('div', { class: 'pinning-plates', style: { left: geo.x0 + PLATE_GAP + 'px' } },
    plates.map(([label, value]) => Deck.el('div', { class: 'cond pinning-plate' }, [
      Deck.el('span', { text: label }),
      Deck.el('b', { text: value }),
    ]))));
}

function addClock(frame) {
  const win = Deck.el('span', { class: 'win' });
  const row = Deck.el('div', { class: 'ro' }, [
    Deck.el('span', { class: 'lb pinning-clock-label', text: 'Elapsed' }),
    win,
    Deck.el('span', { class: 'un pinning-clock-unit', text: 'ms' }),
  ]);
  frame.append(Deck.el('div', { class: 'readouts pinning-clock' }, row));
  return { row, win };
}

function showClock(clock, ms) {
  const text = Deck.fmt(ms);
  if (clock.win.dataset.shows === text) return;
  clock.win.dataset.shows = text;
  clock.win.replaceChildren(...[...text].map(ch => Deck.el('i', { class: ch === ',' ? 'dot pinning-clock-comma' : null, text: ch })));
}

function mountRun(root, spec, geo, top) {
  const model = spec.model(spec.totalMs);
  const svg = Deck.svg('svg', { width: geo.width, height: RUN_H });
  const frame = Deck.el('div', {
    class: 'pinning-run',
    style: { top: top + 'px', width: geo.width + 'px', height: RUN_H + 'px' },
  }, svg);
  root.append(frame);

  drawRows(svg, geo);
  drawTimeAxis(svg, geo);
  drawOrigin(svg, geo);
  const bars = model.bars.map(bar => addBar(svg, geo, bar));
  const tokens = model.tasks.map(() => addToken(svg));
  const pinnedWords = model.pins ? addPinnedWords(svg, geo) : [];
  const allDone = addAllDone(svg, geo);
  const remarks = spec.remarks.map(remark => addRemark(svg, geo, remark));
  const pen = addPen(svg);
  addPlates(frame, geo, spec);
  const clock = addClock(frame);

  function placeTokens(t) {
    const phases = model.tasks.map(task => phaseAt(task, t, spec.totalMs));
    const left = phases.filter(phase => phase.place !== QUEUE).length;
    phases.forEach((phase, i) => {
      const token = tokens[i];
      token.toggleAttribute('hidden', phase === DONE);
      if (phase === DONE) return;
      const seat = seatFor(geo, phase, i, i - left);
      token.setAttribute('x', seat.x);
      token.setAttribute('y', seat.y);
      token.setAttribute('class', 'tok ' + (phase.place === CARRIER ? 'is-run' : 'is-wait'));
    });
  }

  function render(t) {
    const now = Deck.clamp(t, 0, spec.totalMs);
    const finished = t >= spec.totalMs;
    placeTokens(t);
    for (const view of bars) growBar(view, geo, now);
    for (const word of pinnedWords) word.toggleAttribute('hidden', t < 0 || finished);
    for (const remark of remarks.concat(allDone)) remark.toggleAttribute('hidden', !finished);
    pen.setAttribute('transform', `translate(${geo.x(now)} 0)`);
    showClock(clock, Math.floor(now));
    clock.row.classList.toggle(spec.verdict, finished);
  }

  return {
    totalMs: spec.totalMs,
    leadInMs: spec.leadInMs,
    fadeMs: spec.fadeMs,
    render,
    show(on) { frame.hidden = !on; },
    fade(p) { frame.style.opacity = p; },
  };
}

Deck.scene('pinning', (root, args, ctx) => {
  const geo = measure(root.clientWidth);
  const tops = [0, root.clientHeight - RUN_H];
  const runs = RUNS.map((spec, k) => mountRun(root, spec, geo, tops[k]));

  function play(run) {
    run.render(BEFORE);
    ctx.tween(run.fadeMs, run.fade, { ease: Deck.ease.linear });
    ctx.after(run.leadInMs, () => ctx.loop((dt, seconds) => {
      const t = seconds * 1000;
      run.render(Math.min(t, run.totalMs));
      return t < run.totalMs;
    }));
  }

  return {
    // Run k arrives on step k and plays once, in real time; every later step shows it finished.
    setStep(step, animate) {
      ctx.cancel();
      runs.forEach((run, k) => {
        run.show(step >= k);
        run.fade(1);
        if (step < k) return;
        if (animate && ctx.motion && step === k) play(run);
        else run.render(run.totalMs);
      });
    },
  };
});
