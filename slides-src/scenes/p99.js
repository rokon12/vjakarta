const { svg, el, clamp } = Deck;

// @data
const SERIES = {"before-small":{"p99":[71,53,53,53,54,58,96,78,59,65,276,464,613,766,903,1039,1012,394,54,55,55,55,54,54,72,57,56,54,54,59],"refused":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"failed":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"summary":{"requests":2522,"p50":54,"p99":1018,"on time":1803,"late":719,"refused":0,"failed":0,"dropped":0}},"switched-small":{"p99":[69,88,53,52,53,52,52,52,63,53,54,54,56,54,52,53,55,52,79,53,53,52,234,64,63,52,53,70,93,109],"refused":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"failed":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"summary":{"requests":2522,"p50":51,"p99":72,"on time":2522,"late":0,"refused":0,"failed":0,"dropped":0}},"switched-big":{"p99":[67,87,53,100,235,224,91,53,55,54,865,1609,2350,2343,1479,616,59,56,75,96,55,54,59,79,59,54,55,57,53,59],"refused":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"failed":[0,0,0,0,0,0,0,0,0,0,340,312,287,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"summary":{"requests":3722,"p50":544,"p99":2325,"on time":1651,"late":1132,"refused":0,"failed":939,"dropped":0},"inFlight":[0,4,3,3,3,14,3,4,3,4,235,510,829,738,390,7,3,3,3,3,3,3,3,3,4,3,3,3,3,0,0,0]},"budgeted-big":{"p99":[57,184,89,55,58,88,55,57,67,59,91,85,85,58,56,62,53,112,110,57,70,54,53,58,55,100,229,385,231,57],"refused":[0,0,0,0,0,0,0,0,0,0,364,318,309,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"failed":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"summary":{"requests":3722,"p50":52,"p99":114,"on time":2731,"late":0,"refused":991,"failed":0,"dropped":0}},"before-big":{"p99":[61,62,62,57,74,54,54,63,55,57,3551,8384,11802,11800,11190,10573,9961,9333,8717,8103,7501,6885,6274,5655,5036,4414,3788,3167,2552,1932],"refused":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"failed":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"summary":{"requests":3721,"p50":4682,"p99":11697,"on time":688,"late":3033,"refused":0,"failed":0,"dropped":0}},"deadlines-big":{"p99":[120,59,56,53,177,82,140,77,68,57,87,91,86,110,85,54,55,53,67,55,57,97,56,54,60,57,54,58,55,59],"refused":[0,0,0,0,0,0,0,0,0,0,361,337,317,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"failed":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"summary":{"requests":3721,"p50":52,"p99":92,"on time":2706,"late":0,"refused":1015,"failed":0,"dropped":0}}};
// @end

const SECONDS = 30;
const LOW = 40;
const HIGH = 5000;
const DEADLINE = 500;
const PLAY_MS = 10000;

const p99Of = run => SERIES[run].summary.p99;

const MODES = {
  small: {
    sale: [10, 16],
    first: { run: 'before-small', tone: 'blue', play: true, readouts: [['p99 · 16 threads', p99Of('before-small'), 'ms', '']] },
    second: { run: 'switched-small', tone: 'green', readouts: [['p99 · virtual', p99Of('switched-small'), 'ms', 'good']] },
  },
  big: {
    sale: [10, 13],
    first: { run: 'switched-small', tone: 'green', faint: true, readouts: [['p99 · small sale', p99Of('switched-small'), 'ms', 'good']] },
    second: {
      run: 'switched-big', tone: 'red', readouts: [
        ['p99 · big sale', p99Of('switched-big'), 'ms', 'alarm'],
        ['Failed', SERIES['switched-big'].summary.failed, '', 'alarm'],
        ['In flight', Math.max(...SERIES['switched-big'].inFlight), '', 'alarm'],
      ],
    },
  },
  rebuilt: {
    sale: [10, 13],
    refusals: true,
    first: { run: 'switched-big', tone: 'red', faint: true, readouts: [['p99 · big sale', p99Of('switched-big'), 'ms', 'alarm']] },
    second: {
      run: 'budgeted-big', tone: 'green', readouts: [
        ['p99 · rebuilt', p99Of('budgeted-big'), 'ms', 'good'],
        ['Turned away', SERIES['budgeted-big'].summary.refused, '', ''],
        ['Failed', SERIES['budgeted-big'].summary.failed, '', 'good'],
      ],
    },
  },
};

const TICKS = [50, 100, 500, 1000, 5000];

Deck.scene('p99', (root, args, ctx) => {
  const mode = MODES[args.mode || 'small'];
  const W = root.clientWidth;
  const H = root.clientHeight;
  const strip = mode.refusals ? 120 : 0;
  const chart = { x: 120, y: 56, w: W - 120 - 680, h: H - 56 - 76 - strip };
  const sx = s => chart.x + (s / SECONDS) * chart.w;
  const span = Math.log10(HIGH / LOW);
  const sy = ms => chart.y + chart.h - (Math.log10(clamp(ms, LOW, HIGH) / LOW) / span) * chart.h;

  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: { overflow: 'visible' } });
  const add = (tag, attrs, parent = stage) => parent.appendChild(svg(tag, attrs));
  root.append(stage);

  // axes
  add('rect', { class: 'plot-ground', x: chart.x, y: chart.y, width: chart.w, height: chart.h });
  const [saleFrom, saleTo] = mode.sale;
  add('rect', { class: 'plot-band', x: sx(saleFrom), y: chart.y, width: sx(saleTo) - sx(saleFrom), height: chart.h });
  add('text', { class: 'plot-label', x: (sx(saleFrom) + sx(saleTo)) / 2, y: chart.y - 14, 'text-anchor': 'middle', text: 'SALE' });
  for (let s = 0; s <= SECONDS; s += 5) {
    if (s > 0 && s < SECONDS) add('line', { class: 'plot-grid', x1: sx(s), y1: chart.y, x2: sx(s), y2: chart.y + chart.h });
    add('line', { class: 'plot-tick', x1: sx(s), y1: chart.y + chart.h, x2: sx(s), y2: chart.y + chart.h + 10 });
    add('text', { class: 'plot-num', x: sx(s), y: chart.y + chart.h + 40, 'text-anchor': 'middle', text: String(s) });
  }
  add('text', { class: 'plot-num', x: chart.x + chart.w + 24, y: chart.y + chart.h + 40, text: 's' });
  for (const ms of TICKS) {
    add('line', { class: 'plot-grid', x1: chart.x, y1: sy(ms), x2: chart.x + chart.w, y2: sy(ms) });
    add('line', { class: 'plot-tick', x1: chart.x - 10, y1: sy(ms), x2: chart.x, y2: sy(ms) });
    add('text', { class: 'plot-num', x: chart.x - 16, y: sy(ms) + 10, 'text-anchor': 'end', text: ms < 1000 ? String(ms) : `${ms / 1000} s` });
  }
  add('text', { class: 'plot-label', x: chart.x - 16, y: chart.y - 18, 'text-anchor': 'end', text: 'P99' });
  add('line', { class: 'plot-mark', x1: chart.x, y1: sy(DEADLINE), x2: chart.x + chart.w, y2: sy(DEADLINE) });
  add('text', { class: 'plot-label', x: chart.x + chart.w - 12, y: sy(DEADLINE) - 14, 'text-anchor': 'end', text: 'LATE' });
  add('path', { class: 'plot-axis', d: `M${chart.x} ${chart.y} V${chart.y + chart.h} H${chart.x + chart.w + 8}` });

  // people turned away at the door, one column a second
  const refusals = [];
  if (mode.refusals) {
    const base = H - 20;
    const most = Math.max(...SERIES[mode.second.run].refused, 1);
    add('text', { class: 'plot-label', x: chart.x - 16, y: base - 30, 'text-anchor': 'end', text: 'TURNED' });
    add('text', { class: 'plot-label', x: chart.x - 16, y: base + 6, 'text-anchor': 'end', text: 'AWAY' });
    add('line', { class: 'plot-axis', x1: chart.x, y1: base, x2: chart.x + chart.w, y2: base });
    SERIES[mode.second.run].refused.forEach((count, i) => {
      const height = (count / most) * (strip - 30);
      refusals.push(add('rect', { class: 'bar is-off', x: sx(i) + 4, y: base - height, width: chart.w / SECONDS - 8, height, visibility: 'hidden' }));
    });
  }

  // the runs
  function trace(spec) {
    return { spec, data: SERIES[spec.run].p99, path: add('path', { class: `plot-trace ${spec.tone}`, opacity: spec.faint ? 0.45 : 1 }) };
  }
  const first = trace(mode.first);
  const second = trace(mode.second);

  function pointAt(line, upTo) {
    const i = clamp(Math.floor(upTo - 0.5), 0, line.data.length - 1);
    const next = Math.min(i + 1, line.data.length - 1);
    const p = clamp(upTo - 0.5 - i, 0, 1);
    return [sx(upTo), Deck.lerp(sy(line.data[i]), sy(line.data[next]), p)];
  }

  function draw(line, upTo) {
    const points = [];
    for (let i = 0; i + 0.5 <= upTo && i < line.data.length; i++) points.push([sx(i + 0.5), sy(line.data[i])]);
    if (upTo > 0.5 && upTo < SECONDS) points.push(pointAt(line, upTo));
    line.path.setAttribute('d', points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '));
  }

  function drawRefusals(upTo) {
    refusals.forEach((bar, i) => bar.setAttribute('visibility', i + 1 <= upTo ? 'visible' : 'hidden'));
  }

  // the pen that draws the trace
  const pen = add('g', { visibility: 'hidden' });
  const penArm = add('line', { class: 'plot-pen-arm', x1: 0, x2: 0, y1: chart.y }, pen);
  add('rect', { class: 'plot-pen-car', x: -17, y: chart.y - 9, width: 34, height: 18 }, pen);
  const penTip = add('circle', { class: 'plot-pen-tip', r: 9 }, pen);

  function movePen(line, upTo) {
    const [x, y] = pointAt(line, Math.max(upTo, 0.5));
    pen.setAttribute('visibility', 'visible');
    pen.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
    penArm.setAttribute('y2', y.toFixed(1));
    penTip.setAttribute('cy', y.toFixed(1));
  }

  // readouts
  function readouts(spec) {
    return spec.readouts.map(([label, value, unit, tone]) => {
      const digits = String(value).split('').map(ch => el('i', { text: ch }));
      return el('div', { class: `ro ${tone}`.trim() }, [
        el('span', { class: 'lb', text: label }), el('span', { class: 'win' }, digits), el('span', { class: 'un p99-unit', text: unit }),
      ]);
    });
  }
  const firstRows = readouts(mode.first);
  const secondRows = readouts(mode.second);
  root.append(el('div', { class: 'readouts', style: { left: `${chart.x + chart.w + 70}px`, top: `${chart.y}px`, width: '610px' } }, [
    el('p', { class: 'p99-speed', text: '30 s of each run, played at 3× speed' }), ...firstRows, ...secondRows,
  ]));
  const reveal = (rows, on) => rows.forEach(row => row.classList.toggle('p99-hidden', !on));

  function play(line, then) {
    ctx.loop((dt, t) => {
      const upTo = Math.min(SECONDS, (t * 1000 / PLAY_MS) * SECONDS);
      draw(line, upTo);
      if (line === second) drawRefusals(upTo);
      movePen(line, upTo);
      if (upTo < SECONDS) return true;
      pen.setAttribute('visibility', 'hidden');
      then();
      return false;
    });
  }

  return {
    setStep(step, animate, from) {
      ctx.cancel();
      pen.setAttribute('visibility', 'hidden');
      const moving = animate && ctx.motion;
      reveal(secondRows, false);
      draw(second, 0);
      drawRefusals(0);

      if (step === 0 && moving && mode.first.play && from === -1) {
        reveal(firstRows, false);
        draw(first, 0);
        play(first, () => reveal(firstRows, true));
        return;
      }
      draw(first, SECONDS);
      reveal(firstRows, true);
      if (step === 0) return;

      if (moving && from === 0) {
        play(second, () => reveal(secondRows, true));
        return;
      }
      draw(second, SECONDS);
      drawRefusals(SECONDS);
      reveal(secondRows, true);
    },
  };
});
