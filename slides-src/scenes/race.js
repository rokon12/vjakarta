const { el, svg, fmt, clamp } = Deck;

// ---- parts both scenes use ----

function setDigits(win, text) {
  if (win.dataset.shown === text) return;
  win.dataset.shown = text;
  win.replaceChildren(...[...text].map(ch =>
    el('i', { class: ch === ',' ? 'dot race-comma' : null, text: ch })));
}

function readout(label, unit) {
  const win = el('span', { class: 'win' });
  const row = el('div', { class: 'ro' }, [el('span', { class: 'lb' }, label), win, unit]);
  return { row, win };
}

function placed(top, left, width, kids) {
  return el('div', {
    class: 'readouts',
    style: { left: left + 'px', top: top + 'px', width: width + 'px' },
  }, kids);
}

function setSpan(rect, x0, x1) {
  const width = Math.max(0, x1 - x0);
  rect.style.display = width > 0 ? '' : 'none';
  rect.setAttribute('x', x0.toFixed(1));
  rect.setAttribute('width', width.toFixed(1));
}

function canvas(root, name) {
  const width = root.clientWidth;
  const height = root.clientHeight;
  const art = svg('svg', { class: name, width, height, viewBox: `0 0 ${width} ${height}` });
  root.append(art);
  return { art, width, height };
}

// ---- race: 1,000 requests, a pool of 50 against a thread each ----

const RACE = { requests: 1000, serviceMs: 100, axisMs: 2200 };

const LANES = [
  {
    tag: 'A',
    name: '50 platform threads',
    hint: '20 batches of 50, one batch every 100 ms',
    batches: 20,
    finishMs: 2084,
    queueNote: 'QUEUEING FOR A THREAD',
  },
  {
    tag: 'B',
    name: 'One virtual thread each',
    hint: 'all 1,000 wait at the same time',
    batches: 1,
    finishMs: 114,
  },
];

const RACE_KEYS = [
  ['is-wait', 'Queued for a thread'],
  ['', 'Has a thread: 100 ms on the database'],
  ['is-ok', 'Done'],
];

const HEAD = 70;
const HEAD_GAP = 8;
const GRID_ROWS = 10;
const BLOCK_GAP = 14;
const CELL_STROKE = 2.5;
const KEY_LINE = 36;
const TRACK = 38;
const AXIS = 44;
const GAP = 14;
const GUTTER = 270;
const TAIL = 130;

function raceLayout(width, height) {
  const chartH = LANES.length * TRACK + AXIS;
  const free = height - LANES.length * (HEAD + HEAD_GAP) - KEY_LINE - chartH - 3 * GAP;
  const pitch = clamp(Math.floor(free / (LANES.length * GRID_ROWS)), 8, 18);
  const laneH = HEAD + HEAD_GAP + GRID_ROWS * pitch + GAP;
  const chartW = width - GUTTER - TAIL;
  return {
    width,
    pitch,
    cell: pitch - 3,
    laneH,
    keyY: LANES.length * laneH,
    chartY: height - chartH,
    chartW,
    x: ms => GUTTER + ms * chartW / RACE.axisMs,
  };
}

function laneHead(spec, top, width) {
  const label = [
    el('b', { class: 'race-tag', text: spec.tag }),
    spec.name,
    el('span', { class: 'sub race-hint', text: spec.hint }),
  ];
  const clock = readout(label, el('span', { class: 'un race-ms', text: 'ms' }));
  return { head: placed(top, 0, width, clock.row), win: clock.win };
}

function laneBatches(art, spec, lay, top) {
  const perBatch = RACE.requests / spec.batches;
  const cols = perBatch / GRID_ROWS;
  const blockW = (lay.width - (spec.batches - 1) * BLOCK_GAP) / spec.batches;
  const stepX = (blockW - lay.cell) / (cols - 1);
  const side = lay.cell - CELL_STROKE;
  const span = spec.finishMs / spec.batches;
  const layer = svg('g', { transform: `translate(${CELL_STROKE / 2} ${top + CELL_STROKE / 2})` });
  art.append(layer);

  return Array.from({ length: spec.batches }, (_, b) => {
    const cells = Array.from({ length: perBatch }, (_, i) => svg('rect', {
      class: 'tok race-cell is-wait',
      x: (b * (blockW + BLOCK_GAP) + (i % cols) * stepX).toFixed(2),
      y: Math.floor(i / cols) * lay.pitch,
      width: side,
      height: side,
    }));
    layer.append(...cells);
    return { cells, startMs: b * span, endMs: (b + 1) * span, state: 'wait' };
  });
}

function buildLane(root, art, spec, lay, index) {
  const top = index * lay.laneH;
  const { head, win } = laneHead(spec, top, lay.width);
  root.append(head);
  return {
    win,
    finishMs: spec.finishMs,
    batches: laneBatches(art, spec, lay, top + HEAD + HEAD_GAP),
  };
}

function batchState(batch, ms) {
  if (ms >= batch.endMs) return 'ok';
  return ms > batch.startMs ? 'run' : 'wait';
}

function paintLane(lane, ms) {
  for (const batch of lane.batches) {
    const state = batchState(batch, ms);
    if (state === batch.state) continue;
    batch.state = state;
    for (const cell of batch.cells) cell.setAttribute('class', 'tok race-cell is-' + state);
  }
  setDigits(lane.win, fmt(Math.min(ms, lane.finishMs)));
}

function raceKeys(top) {
  return el('div', { class: 'race-keys', style: { top: top + 'px' } },
    RACE_KEYS.map(([state, text]) => el('div', { class: 'key' }, [el('i', { class: state || null }), text])));
}

function chartFrame(art, lay) {
  const top = lay.chartY;
  const bottom = top + LANES.length * TRACK;
  const frame = svg('g');
  frame.append(svg('rect', {
    class: 'plot-ground', x: lay.x(0), y: top, width: lay.chartW, height: bottom - top,
  }));
  for (let ms = 0; ms <= RACE.axisMs; ms += 100) {
    const major = ms % 500 === 0;
    const x = lay.x(ms).toFixed(1);
    if (major && ms > 0) frame.append(svg('line', { class: 'plot-grid', x1: x, y1: top, x2: x, y2: bottom }));
    frame.append(svg('line', { class: 'plot-tick', x1: x, y1: bottom, x2: x, y2: bottom + (major ? 14 : 8) }));
    if (major) {
      frame.append(svg('text', { class: 'plot-num', x, y: bottom + 42, 'text-anchor': 'middle', text: fmt(ms) }));
    }
  }
  frame.append(svg('text', { class: 'plot-num', x: lay.x(RACE.axisMs) + 22, y: bottom + 42, text: 'ms' }));
  frame.append(svg('path', {
    class: 'plot-axis', d: `M${lay.x(0)} ${top - 6} V${bottom} H${lay.x(RACE.axisMs) + 10}`,
  }));
  art.append(frame);
}

function queueNote(notes, spec, lay, top, queuedUntil) {
  const text = svg('text', {
    class: 'lbl sm',
    x: (lay.x(0) + lay.x(queuedUntil)) / 2,
    y: top + 32,
    'text-anchor': 'middle',
    text: spec.queueNote,
  });
  notes.append(text);
  const box = text.getBBox();
  notes.insertBefore(svg('rect', {
    class: 'plot-ground', x: box.x - 18, y: top + 1, width: box.width + 36, height: TRACK - 2,
  }), text);
}

function chartRow(art, spec, lay, index) {
  const top = lay.chartY + index * TRACK;
  const queuedUntil = spec.finishMs * (spec.batches - 1) / spec.batches;
  const bar = state => svg('rect', { class: 'bar is-' + state, y: top + 4, height: TRACK - 8 });
  const queued = bar('wait');
  const served = bar('run');
  const tip = svg('circle', { class: 'plot-pen-tip race-tip', r: 9, cy: top + TRACK / 2 });
  const notes = svg('g');
  art.append(
    svg('rect', { class: 'race-tag-box', x: 0, y: top + 2, width: 40, height: TRACK - 4 }),
    svg('text', { class: 'lbl sm race-tag-text', x: 20, y: top + 32, 'text-anchor': 'middle', text: spec.tag }),
    svg('text', { class: 'lbl sm', x: 54, y: top + 32, text: 'LAST REQUEST' }),
    queued, served, notes, tip);

  notes.append(svg('text', {
    class: 'lbl sm', x: lay.x(spec.finishMs) + 22, y: top + 32, text: RACE.serviceMs + ' MS',
  }));
  if (spec.queueNote) queueNote(notes, spec, lay, top, queuedUntil);

  return {
    queued, served, tip, notes, queuedUntil,
    servedUntil: queuedUntil + RACE.serviceMs,
    finishMs: spec.finishMs,
  };
}

function paintRow(row, ms, lay) {
  setSpan(row.queued, lay.x(0), lay.x(Math.min(ms, row.queuedUntil)));
  setSpan(row.served, lay.x(row.queuedUntil), lay.x(clamp(ms, row.queuedUntil, row.servedUntil)));
  row.tip.setAttribute('cx', lay.x(Math.min(ms, row.finishMs)).toFixed(1));
  row.notes.style.display = ms >= row.finishMs ? '' : 'none';
}

Deck.scene('race', (root, args, ctx) => {
  const { art, width, height } = canvas(root, 'race-art');
  const lay = raceLayout(width, height);
  const lanes = LANES.map((spec, i) => buildLane(root, art, spec, lay, i));
  root.append(raceKeys(lay.keyY));
  chartFrame(art, lay);
  const rows = LANES.map((spec, i) => chartRow(art, spec, lay, i));
  const endMs = Math.max(...LANES.map(spec => spec.finishMs));
  let shownMs = 0;

  function draw(ms) {
    shownMs = ms;
    for (const lane of lanes) paintLane(lane, ms);
    for (const row of rows) paintRow(row, ms, lay);
  }

  function run(fromMs) {
    draw(fromMs);
    ctx.loop((dt, seconds) => {
      const ms = fromMs + seconds * 1000;
      draw(Math.min(ms, endMs));
      return ms < endMs;
    });
  }

  return {
    setStep(step, animate, from) {
      ctx.cancel();
      if (step === 0) draw(0);
      else if (animate && step === 1) run(0);
      else if (animate && from === 1 && shownMs < endMs) run(shownMs);
      else draw(endMs);
    },
  };
});

// ---- compare: demo 1 before and after, out of the same 1,809 requests ----

const DEMO1 = {
  total: 1809,
  runs: [
    { name: 'NO LIMIT', onTime: 1077, late: 732, rejected: 0 },
    { name: 'LIMIT OF 32', onTime: 1518, late: 0, rejected: 291 },
  ],
};

const OUTCOMES = [
  { key: 'onTime', state: 'ok', label: 'Answered within 500 ms', word: 'ON TIME', alert: 'good', width: 700 },
  { key: 'late', state: 'leak', label: 'Late', word: 'LATE', alert: 'alarm', width: 280 },
  { key: 'rejected', state: 'off', label: 'Rejected at once', word: 'REJECTED', alert: '', width: 520 },
];

const SPAN_H = 52;
const READ_H = 70;
const BAR_H = 104;
const NAME_W = 250;
const GROW_MS = 1400;
const TRADE_MS = 500;

function compareLayout(width, height) {
  const barW = width - NAME_W;
  const [first, middle, last] = OUTCOMES.map(outcome => outcome.width);
  return {
    width,
    barW,
    x: requests => NAME_W + requests * barW / DEMO1.total,
    barY: [SPAN_H + READ_H + 2 * GAP, height - READ_H - GAP - BAR_H],
    readY: [SPAN_H + GAP, height - READ_H],
    readX: [0, (first + width - last - middle) / 2, width - last],
  };
}

function totalSpan(art, lay) {
  const mid = SPAN_H / 2;
  const centre = (lay.x(0) + lay.width) / 2;
  const text = svg('text', {
    class: 'lbl', x: centre, y: mid + 15, 'text-anchor': 'middle',
    text: `THE SAME ${fmt(DEMO1.total)} REQUESTS`,
  });
  art.append(
    svg('line', { class: 'rule', x1: lay.x(0), y1: 4, x2: lay.x(0), y2: SPAN_H - 4 }),
    svg('line', { class: 'rule', x1: lay.width, y1: 4, x2: lay.width, y2: SPAN_H - 4 }),
    svg('line', {
      class: 'rule', x1: lay.x(0) + 4, y1: mid, x2: lay.width - 4, y2: mid,
      'marker-start': 'url(#arrow)', 'marker-end': 'url(#arrow)',
    }),
    text);
  const box = text.getBBox();
  art.insertBefore(svg('rect', {
    class: 'compare-gap', x: box.x - 24, y: 0, width: box.width + 48, height: SPAN_H,
  }), text);
}

function runSegment(layer, outcome, top) {
  const bar = svg('rect', { class: 'bar is-' + outcome.state, y: top, height: BAR_H });
  const word = svg('text', {
    class: outcome.state === 'off' ? 'lbl' : 'lbl compare-on-fill',
    y: top + BAR_H / 2 + 15,
    text: outcome.word,
  });
  layer.append(bar, word);
  return { key: outcome.key, bar, word, room: word.getComputedTextLength() + 44 };
}

function runReadout(root, outcome, top, left) {
  const { row, win } = readout(outcome.label);
  const holder = placed(top, left, outcome.width, row);
  root.append(holder);
  return { key: outcome.key, alert: outcome.alert, row, win, holder };
}

function buildRun(root, art, run, lay, index) {
  const top = lay.barY[index];
  const layer = svg('g');
  art.append(layer);
  layer.append(
    svg('text', { class: 'lbl', x: 0, y: top + BAR_H / 2 + 15, text: run.name }),
    svg('line', { class: 'plot-axis', x1: lay.x(0), y1: top - 10, x2: lay.x(0), y2: top + BAR_H + 10 }));
  return {
    run,
    layer,
    segments: OUTCOMES.map(outcome => runSegment(layer, outcome, top)),
    readouts: OUTCOMES.map((outcome, k) => runReadout(root, outcome, lay.readY[index], lay.readX[k])),
  };
}

function paintRun(view, share, lay) {
  let before = 0;
  for (const segment of view.segments) {
    const count = Math.round(view.run[segment.key] * share);
    const x0 = lay.x(before);
    const x1 = lay.x(before + count);
    setSpan(segment.bar, x0, x1);
    segment.word.setAttribute('x', (x0 + 22).toFixed(1));
    segment.word.style.display = x1 - x0 >= segment.room ? '' : 'none';
    before += count;
  }
  for (const item of view.readouts) {
    const count = Math.round(view.run[item.key] * share);
    setDigits(item.win, fmt(count));
    item.row.className = count > 0 && item.alert ? 'ro ' + item.alert : 'ro';
  }
}

function showRun(view, on) {
  const display = on ? '' : 'none';
  view.layer.style.display = display;
  for (const item of view.readouts) item.holder.style.display = display;
}

function tradeSpan(layer, lay, y, span) {
  const x0 = lay.x(span.from);
  const x1 = lay.x(span.to);
  const centre = (x0 + x1) / 2;
  layer.append(
    svg('line', {
      class: 'rule', x1: x0 + 5, y1: y, x2: x1 - 5, y2: y,
      'marker-start': 'url(#arrow)', 'marker-end': 'url(#arrow)',
    }),
    svg('text', {
      class: 'val compare-figure is-' + span.state, x: centre, y: y - 62, 'text-anchor': 'middle', text: span.figure,
    }),
    svg('text', { class: 'lbl sm', x: centre, y: y - 16, 'text-anchor': 'middle', text: span.words }));
}

function buildTrade(art, lay) {
  const [before, after] = DEMO1.runs;
  const top = lay.barY[0] + BAR_H;
  const bottom = lay.barY[1];
  const y = bottom - 26;
  const layer = svg('g');
  art.append(layer);
  for (const requests of [before.onTime, DEMO1.total]) {
    const x = lay.x(requests).toFixed(1);
    layer.append(svg('line', { class: 'plot-mark', x1: x, y1: top, x2: x, y2: bottom }));
  }
  const split = lay.x(after.onTime).toFixed(1);
  layer.append(svg('line', { class: 'rule', x1: split, y1: y - 22, x2: split, y2: bottom }));
  tradeSpan(layer, lay, y, {
    from: before.onTime, to: after.onTime, state: 'ok',
    figure: '+' + fmt(after.onTime - before.onTime), words: 'MORE ON TIME',
  });
  tradeSpan(layer, lay, y, {
    from: after.onTime, to: DEMO1.total, state: 'off',
    figure: fmt(after.rejected), words: 'TURNED AWAY',
  });
  return layer;
}

function showTrade(layer, strength) {
  layer.style.display = strength > 0 ? '' : 'none';
  layer.style.opacity = strength;
}

Deck.scene('compare', (root, args, ctx) => {
  const { art, width, height } = canvas(root, 'compare-art');
  const lay = compareLayout(width, height);
  totalSpan(art, lay);
  const [unlimited, limited] = DEMO1.runs.map((run, i) => buildRun(root, art, run, lay, i));
  const trade = buildTrade(art, lay);
  paintRun(unlimited, 1, lay);

  function draw(step) {
    showRun(limited, step >= 1);
    paintRun(limited, 1, lay);
    showTrade(trade, step >= 2 ? 1 : 0);
  }

  return {
    setStep(step, animate, from) {
      ctx.cancel();
      draw(step);
      if (!animate) return;
      if (step === 1 && from === 0) {
        ctx.tween(GROW_MS, share => paintRun(limited, share, lay), { ease: Deck.ease.inOut });
      }
      if (step === 2 && from === 1) ctx.tween(TRADE_MS, strength => showTrade(trade, strength));
    },
  };
});
