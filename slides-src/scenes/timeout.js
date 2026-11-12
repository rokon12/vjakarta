// Deadlines: one timeline, two runs. The caller gives up at the deadline; what the payment
// does next is the whole story. Timestamps are the ones the Liberty app logged.

const { svg, el, fmt, clamp, lerp, ease } = Deck;

const AXIS_MS = 2000;
const DEADLINE_MS = 500;
const LEAD_MS = 700;      // lets the slide settle before the clock starts
const FADE_MS = 160;
const BEAT_MS = 420;      // spacing between log lines that share a millisecond
const EXTRA_MS = 1200;
const CAP_PX = 10;
const TICK_PX = 16;
const CAPS_MID = 0.36;    // baseline offset that centres capitals, as a share of font size
const RETRY_AT_MS = 700;  // "some time after the timeout"; never printed

const RUNS = {
  leak: {
    end: 1850,
    alarmFrom: 507,
    verdict: 'alarm',
    spans: [
      { lane: 'caller', from: 0, to: 507, state: 'is-wait' },
      { lane: 'task', from: 1, to: 507, state: 'is-run' },
      { lane: 'task', from: 507, to: 1850, state: 'is-leak', note: 'NOBODY IS WAITING FOR THIS' },
    ],
    events: [
      { at: 1, lane: 'task', row: 'b2', text: 'charging card', start: true },
      { at: 507, lane: 'caller', row: 'a1', text: 'timed out, customer told to try again' },
      { at: 1850, lane: 'task', row: 'b1', text: 'card charged', tone: 'alarm', flip: true },
    ],
    legend: [
      ['is-run', 'RUNNING'],
      ['is-wait', 'WAITING'],
      ['is-leak', 'NOBODY WAITS FOR IT'],
    ],
    extra: 'retry',
  },

  cancel: {
    end: 507,
    verdict: 'good',
    spans: [
      { lane: 'caller', from: 0, to: 506, state: 'is-wait' },
      { lane: 'task', from: 1, to: 507, state: 'is-run' },
    ],
    events: [
      { at: 1, lane: 'task', row: 'b2', text: 'charging card', start: true },
      { at: 506, lane: 'caller', row: 'a1', text: 'timed out, customer told to try again' },
      { at: 507, lane: 'task', row: 'b1', text: 'payment call cancelled', tone: 'good', beat: 2 },
    ],
    interrupt: { at: 507, beat: 1, text: 'part.cancel(true)' },
    stop: { at: 507, beat: 2 },
    ghost: { from: 507, to: 1850, text: 'LAST RUN KEPT WORKING UNTIL 1,850 ms' },
    provider: { from: 1, to: 1800 },
    legend: [
      ['is-run', 'RUNNING'],
      ['is-wait', 'WAITING'],
      ['is-ok', 'STOPPED CLEANLY'],
      ['is-leak', 'NOBODY WAITS FOR IT'],
    ],
    extra: 'provider',
  },
};

const LANE_NAMES = { caller: 'CALLER', task: 'PAYMENT TASK' };

let clipCount = 0;

// ---- geometry: designed on a 640 px tall box, stretched to whatever the host gives ----

function layout(width, height) {
  const k = height / 640;
  const left = 236;
  const right = width - 74;
  const lane = (y, h) => ({ y: y * k, h: h * k, mid: (y + h / 2) * k });
  return {
    left,
    right,
    top: 46 * k,
    axis: 510 * k,
    foot: 601 * k,
    x: ms => left + (right - left) * ms / AXIS_MS,
    rows: { a1: 91 * k, a2: 137 * k, b1: 367 * k, b2: 419 * k },
    lanes: { caller: lane(168, 60), task: lane(272, 60), extra: lane(452, 44) },
  };
}

function makeChart(root, geo) {
  const chart = { geo, defs: svg('defs') };
  for (const name of ['ground', 'bars', 'pen', 'labels', 'axis']) chart[name] = svg('g');
  root.append(svg('svg', { class: 'timeout-svg' },
    [chart.defs, chart.ground, chart.bars, chart.pen, chart.labels, chart.axis]));
  return chart;
}

function fade(node, p) {
  node.style.opacity = p;
}

function capsBaseline(mid, size) {
  return mid + size * CAPS_MID;
}

// ---- the plotted ground: paper, grid, axis, deadline ----

function drawGround({ ground, geo }) {
  ground.append(svg('rect', {
    class: 'plot-ground', x: geo.left, y: geo.top, width: geo.right - geo.left, height: geo.axis - geo.top,
  }));
  for (let ms = 100; ms <= AXIS_MS; ms += 100) {
    const x = geo.x(ms);
    ground.append(svg('line', {
      class: ms % 500 ? 'plot-grid minor' : 'plot-grid', x1: x, y1: geo.top, x2: x, y2: geo.axis,
    }));
  }
}

function drawAxis({ axis, geo }) {
  axis.append(
    svg('line', { class: 'plot-tick', x1: geo.left, y1: geo.top, x2: geo.right, y2: geo.top }),
    svg('path', { class: 'plot-axis', d: `M${geo.left} ${geo.top} V${geo.axis} H${geo.right + 10}` }));
  for (let ms = 0; ms <= AXIS_MS; ms += 100) {
    const x = geo.x(ms);
    const major = ms % 500 === 0;
    axis.append(svg('line', { class: 'plot-tick', x1: x, y1: geo.axis, x2: x, y2: geo.axis + (major ? 14 : 8) }));
    if (major) {
      axis.append(svg('text', { class: 'plot-num', x, y: geo.axis + 44, 'text-anchor': 'middle', text: fmt(ms) }));
    }
  }
  axis.append(svg('text', { class: 'plot-num', x: geo.right + 58, y: geo.axis + 44, text: 'ms' }));
}

function flag(layer, x, y, text) {
  const height = 40;
  const label = svg('text', { class: 'timeout-flag-text', x: x + 12, y: capsBaseline(y + height / 2, 34), text });
  layer.append(label);
  const plate = svg('rect', {
    class: 'timeout-flag', x, y, width: label.getComputedTextLength() + 20, height,
  });
  layer.insertBefore(plate, label);
}

function drawDeadline({ ground, geo }) {
  const x = geo.x(DEADLINE_MS);
  ground.append(svg('line', { class: 'plot-mark', x1: x, y1: geo.top, x2: x, y2: geo.axis }));
  flag(ground, x - 1.5, geo.top - 43, `DEADLINE ${DEADLINE_MS} ms`);
}

function laneName(layer, geo, lane, text) {
  const node = svg('text', { class: 'lbl sm', x: 0, y: capsBaseline(geo.lanes[lane].mid, 36), text });
  layer.append(node);
  return node;
}

function drawLegend({ axis, geo }, entries) {
  let x = 0;
  for (const [state, text] of entries) {
    const label = svg('text', { class: 'lbl sm', x: x + 56, y: capsBaseline(geo.foot, 36), text });
    axis.append(svg('rect', { class: 'bar ' + state, x, y: geo.foot - 13, width: 44, height: 26 }), label);
    x += 56 + label.getComputedTextLength() + 38;
  }
}

function drawGhost({ ground, geo }, ghost) {
  const lane = geo.lanes.task;
  const x = geo.x(ghost.from) + CAP_PX;
  const box = { x, y: lane.y, width: geo.x(ghost.to) - x, height: lane.h };
  ground.append(
    svg('rect', { class: 'bar is-leak timeout-ghost', ...box }),
    svg('rect', { class: 'timeout-ghost-edge', ...box }),
    svg('text', {
      class: 'lbl sm timeout-quiet', x: x + box.width / 2, y: capsBaseline(lane.mid, 36),
      'text-anchor': 'middle', text: ghost.text,
    }));
}

// ---- spans of time: bars that grow with the clock ----

function noteOnSpan({ bars, defs, geo }, span) {
  const lane = geo.lanes[span.lane];
  const mid = (geo.x(span.from) + geo.x(span.to)) / 2;
  const id = 'timeout-clip-' + (++clipCount);
  const pane = svg('rect', { x: geo.x(span.from), y: lane.y, width: 0, height: lane.h });
  defs.append(svg('clipPath', { id }, pane));
  const text = svg('text', {
    class: span.plate ? 'lbl sm' : 'lbl timeout-on-solid', x: mid,
    y: capsBaseline(lane.mid, span.plate ? 36 : 44), 'text-anchor': 'middle', text: span.note,
  });
  const group = svg('g', { 'clip-path': `url(#${id})` }, text);
  bars.append(group);
  if (span.plate) {
    const width = text.getComputedTextLength() + 36;
    group.prepend(svg('rect', {
      class: 'timeout-backing', x: mid - width / 2, y: lane.y + 7, width, height: lane.h - 14,
    }));
  }
  return pane;
}

function makeSpan(chart, span) {
  const { geo } = chart;
  const lane = geo.lanes[span.lane];
  const x = geo.x(span.from);
  const bar = svg('rect', { class: 'bar ' + span.state, x, y: lane.y, width: 0, height: lane.h });
  chart.bars.append(bar);
  const pane = span.note ? noteOnSpan(chart, span) : null;
  return t => {
    const width = Math.max(0, geo.x(Math.min(t, span.to)) - x);
    bar.setAttribute('width', width);
    if (pane) pane.setAttribute('width', width);
  };
}

// ---- log lines, printed as the demo printed them ----

function logLabel(parent, entry) {
  const tone = entry.tone || 'plain';
  const solid = tone !== 'plain';
  const big = tone === 'alarm';
  const size = big ? 40 : 32;
  const height = big ? 54 : 42;
  const pad = big ? 16 : 12;
  const type = 'timeout-log' + (big ? ' is-big' : '');
  const node = svg('g');
  parent.append(node);

  const baseline = size * CAPS_MID;
  const stamp = entry.at == null ? null
    : svg('text', { class: type + ' is-inverse', x: pad, y: baseline, text: fmt(entry.at) + ' ms' });
  const line = svg('text', { class: type + (solid ? ' is-inverse' : ''), y: baseline, text: entry.text });
  node.append(line);
  if (stamp) node.append(stamp);

  const stampWidth = stamp ? stamp.getComputedTextLength() + pad * 2 : 0;
  const lineX = solid && stamp ? stampWidth - pad + size * 0.6 : stampWidth + pad;
  const width = lineX + line.getComputedTextLength() + pad;
  line.setAttribute('x', lineX);

  const plate = (cls, w) => svg('rect', { class: cls, x: 0, y: -height / 2, width: w, height });
  node.prepend(
    plate(solid ? 'timeout-plate is-' + tone : 'timeout-backing', width),
    solid || !stamp ? null : plate('timeout-plate', stampWidth));

  let at = { x: 0, y: 0, pivot: 0 };
  const draw = scale => {
    node.setAttribute('transform',
      `translate(${at.x + at.pivot} ${at.y}) scale(${scale}) translate(${-at.pivot} 0)`);
  };
  return {
    node,
    width,
    place(x, y, pivot = 0) {
      at = { x, y, pivot };
      draw(1);
    },
    pop(p) {
      draw(big ? lerp(1.35, 1, ease.out(p)) : 1);
    },
  };
}

function makeEvent(chart, entry) {
  const { geo } = chart;
  const lane = geo.lanes[entry.lane];
  const edge = entry.lane === 'caller' ? lane.y : lane.y + lane.h;
  const row = geo.rows[entry.row];
  const x = entry.start ? geo.left + 12 : geo.x(entry.at);
  const reach = TICK_PX;
  const group = svg('g');
  chart.labels.append(group);

  const label = logLabel(group, entry);
  if (entry.flip) label.place(x - reach - label.width, row, label.width);
  else label.place(x + reach, row);
  group.prepend(
    svg('path', { class: 'timeout-stem', d: `M${x} ${edge} V${row} H${entry.flip ? x - reach : x + reach}` }),
    svg('circle', { class: 'timeout-dot', cx: x, cy: edge, r: 7 }));

  return {
    at: entry.at + (entry.beat || 0) * BEAT_MS,
    show(p) {
      fade(group, p);
      label.pop(p);
    },
  };
}

function makeInterrupt({ labels, geo }, interrupt) {
  const { caller, task } = geo.lanes;
  const x = geo.x(interrupt.at) + CAP_PX / 2;
  const from = caller.y + caller.h;
  const wire = svg('line', { class: 'wire', x1: x, y1: from, x2: x, y2: from, 'marker-end': 'url(#arrow)' });
  const group = svg('g', {}, wire);
  labels.append(group);
  logLabel(group, { text: interrupt.text }).place(x + 18, (from + task.y) / 2);
  return {
    at: interrupt.at + interrupt.beat * BEAT_MS,
    show(p) {
      fade(group, p > 0 ? 1 : 0);
      wire.setAttribute('y2', lerp(from + 14, task.y - 2, p));
    },
  };
}

function makeStop({ bars, geo }, stop, lane, state) {
  const cap = svg('rect', {
    class: 'bar ' + state, x: geo.x(stop.at), y: geo.lanes[lane].y, width: CAP_PX, height: geo.lanes[lane].h,
  });
  bars.append(cap);
  return { at: stop.at + (stop.beat || 0) * BEAT_MS, show: p => fade(cap, p) };
}

// ---- instruments: the pen that marks "now", and the elapsed-time readout ----

function makePen({ pen, geo }) {
  const group = svg('g', {}, [
    svg('line', { class: 'plot-pen-arm', x1: 0, y1: geo.top, x2: 0, y2: geo.axis }),
    svg('rect', { class: 'plot-pen-car', x: -17, y: geo.top, width: 34, height: 18 }),
    svg('circle', { class: 'plot-pen-tip', cx: 0, cy: geo.axis, r: 10 }),
  ]);
  pen.append(group);
  return (t, opacity) => {
    group.setAttribute('transform', `translate(${geo.x(t)} 0)`);
    fade(group, opacity);
  };
}

function makeClock(root, geo) {
  const windows = el('span', { class: 'win' });
  const row = el('div', { class: 'ro' }, [
    el('span', { class: 'lb', text: 'Elapsed' }), windows, el('span', { class: 'un', text: 'ms' }),
  ]);
  const width = 470;
  root.append(el('div', {
    class: 'readouts',
    style: { left: geo.right + 62 - width + 'px', top: geo.foot - 35 + 'px', width: width + 'px' },
  }, row));
  let shown = null;
  return (t, tone) => {
    row.className = tone ? 'ro ' + tone : 'ro';
    const digits = fmt(Math.floor(t));
    if (digits === shown) return;
    shown = digits;
    windows.replaceChildren(...[...digits].map(ch => el('i', { class: ch === ',' && 'dot', text: ch })));
  };
}

// ---- what step 1 adds, as parts on a 0..1 timeline ----

function buildRetry(chart, root) {
  const { geo } = chart;
  const lane = geo.lanes.extra;
  const x = geo.x(RETRY_AT_MS);
  const name = laneName(chart.axis, geo, 'extra', 'RETRY');
  const bar = svg('rect', { class: 'bar is-run timeout-faint', x, y: lane.y, width: 0, height: lane.h });
  const start = svg('circle', { class: 'timeout-dot', cx: x, cy: lane.mid, r: 7 });
  const onward = svg('line', {
    class: 'wire', x1: geo.right, y1: lane.mid, x2: geo.right + 40, y2: lane.mid, 'marker-end': 'url(#arrow)',
  });
  chart.bars.append(bar, start, onward);
  const note = el('div', {
    class: 'note',
    style: { left: x + 6 + 'px', top: geo.rows.b2 - 30 + 'px', '--tilt': '-1deg' },
    text: 'retry: a second charge is on its way',
  });
  root.append(note);
  return [
    { from: 0, to: 0.12, show: p => { fade(name, p); fade(start, p); } },
    { from: 0.12, to: 0.7, show: p => { bar.setAttribute('width', (geo.right - x) * p); fade(onward, p < 1 ? 0 : 1); } },
    { from: 0.7, to: 0.85, show: p => fade(note, p) },
  ];
}

function buildProvider(chart, root, run) {
  const { geo } = chart;
  const lane = geo.lanes.extra;
  const { from, to } = run.provider;
  const x = geo.x(from);
  const end = geo.x(to);
  const name = laneName(chart.axis, geo, 'extra', 'PROVIDER');
  const bar = svg('rect', { class: 'bar is-leak', x, y: lane.y, width: 0, height: lane.h });
  chart.bars.append(bar);
  const charged = logLabel(chart.labels, { text: 'card charged' });
  charged.place(end - charged.width - 12, lane.mid);
  const note = el('div', {
    class: 'note',
    style: { left: geo.x(900) + 'px', top: geo.rows.b2 - 30 + 'px', '--tilt': '-1deg' },
    text: 'it already had the request',
  });
  root.append(note);
  return [
    { from: 0, to: 0.12, show: p => fade(name, p) },
    { from: 0.12, to: 0.7, show: p => bar.setAttribute('width', (end - x) * p) },
    { from: 0.72, to: 0.88, show: p => { fade(charged.node, p); charged.pop(p); } },
    { from: 0.82, to: 0.96, show: p => fade(note, p) },
  ];
}

const EXTRAS = { retry: buildRetry, provider: buildProvider };

// ---- the scene ----

Deck.scene('timeout', (root, args, ctx) => {
  const run = RUNS[args.mode] || RUNS.leak;
  const geo = layout(root.clientWidth, root.clientHeight);
  const chart = makeChart(root, geo);

  drawGround(chart);
  if (run.ghost) drawGhost(chart, run.ghost);
  drawDeadline(chart);
  drawAxis(chart);
  drawLegend(chart, run.legend);
  for (const lane of Object.keys(LANE_NAMES)) laneName(chart.axis, geo, lane, LANE_NAMES[lane]);

  const spans = run.spans.map(span => makeSpan(chart, span));
  const events = run.events.map(entry => makeEvent(chart, entry));
  const timed = [...events];
  if (run.interrupt) timed.push(makeInterrupt(chart, run.interrupt));
  if (run.stop) timed.push(makeStop(chart, run.stop, 'task', 'is-ok'));
  const extras = EXTRAS[run.extra](chart, root, run, events);
  const movePen = makePen(chart);
  const setClock = makeClock(root, geo);
  const total = Math.max(...timed.map(part => part.at)) + FADE_MS;

  function clockTone(t, clock) {
    if (run.alarmFrom != null && t > run.alarmFrom) return 'alarm';
    return clock >= total ? run.verdict : '';
  }

  // `clock` is milliseconds since the run started; the timeline itself stops at run.end.
  function drawRun(clock) {
    const t = Math.min(clock, run.end);
    for (const draw of spans) draw(t);
    for (const part of timed) part.show(clamp((clock - part.at) / FADE_MS, 0, 1));
    movePen(t, 1 - clamp((clock - run.end) / FADE_MS, 0, 1));
    setClock(t, clockTone(t, clock));
  }

  function drawExtra(p) {
    for (const part of extras) part.show(clamp((p - part.from) / (part.to - part.from), 0, 1));
  }

  function play() {
    ctx.loop((dt, seconds) => {
      const clock = seconds * 1000;
      if (clock < total) return drawRun(clock);
      drawRun(Infinity);
      return false;
    });
  }

  return {
    setStep(step, animate, from) {
      ctx.cancel();
      if (step === 0) {
        drawExtra(0);
        drawRun(animate ? 0 : Infinity);
        if (animate) ctx.after(LEAD_MS, play);
        return;
      }
      drawRun(Infinity);
      if (animate && step === 1 && from === 0) ctx.tween(EXTRA_MS, drawExtra, { ease: ease.linear });
      else drawExtra(1);
    },
  };
});
