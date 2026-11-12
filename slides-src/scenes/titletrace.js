Deck.scene('titletrace', (root, args, ctx) => {
  const frame = { x: 0, y: 10, w: 1220, h: 290 };
  const limitY = frame.y + 132;
  const baseY = frame.y + 246;
  const lastX = frame.w - 46;
  const bursts = [
    { from: 0.17, to: 0.31, height: 170 },
    { from: 0.45, to: 0.6, height: 205 },
    { from: 0.73, to: 0.89, height: 238 },
  ];

  const random = Deck.rng(11);
  const points = [];
  for (let x = 0; x <= lastX; x += 6) {
    const f = x / lastX;
    const burst = bursts.find(b => f >= b.from && f <= b.to);
    let y = baseY - (random() - 0.5) * 9;
    if (burst) {
      const u = (f - burst.from) / (burst.to - burst.from);
      const rise = u < 0.3 ? Math.pow(u / 0.3, 1.4) : 1;
      y = baseY - burst.height * rise * (0.72 + 0.28 * random()) - (random() - 0.5) * 46 * rise;
    }
    points.push([x, Math.max(frame.y + 12, y)]);
  }

  const svg = Deck.svg('svg', {
    viewBox: `0 0 ${root.clientWidth} ${root.clientHeight}`,
    width: root.clientWidth,
    height: root.clientHeight,
    style: { overflow: 'visible' },
  });
  const add = (tag, attrs, parent = svg) => parent.appendChild(Deck.svg(tag, attrs));

  const defs = add('defs');
  const clip = (id, y, height) =>
    add('rect', { x: -20, y, width: frame.w + 40, height }, add('clipPath', { id }, defs));
  clip('titletrace-above', frame.y - 40, limitY - frame.y + 40);
  clip('titletrace-below', limitY, frame.y + frame.h - limitY);

  add('rect', { class: 'plot-frame', x: frame.x, y: frame.y, width: frame.w, height: frame.h });
  for (let x = 100; x < frame.w; x += 100) {
    add('line', { class: 'plot-grid', x1: x, y1: frame.y + 2, x2: x, y2: frame.y + frame.h - 2 });
  }
  add('line', { class: 'plot-mark', x1: frame.x, y1: limitY, x2: frame.w, y2: limitY, 'stroke-dasharray': '18 10' });
  add('rect', { x: 14, y: limitY - 42, width: 92, height: 38, style: { fill: 'var(--ink)' } });
  add('text', {
    class: 'plot-label', x: 60, y: limitY - 9, 'text-anchor': 'middle', 'font-size': 34,
    style: { fill: 'var(--white)' }, text: 'LIMIT',
  });

  const below = add('path', { class: 'plot-trace blue' }, add('g', { 'clip-path': 'url(#titletrace-below)' }));
  const above = add('path', { class: 'plot-trace red' }, add('g', { 'clip-path': 'url(#titletrace-above)' }));

  const pen = add('g');
  const arm = add('line', { class: 'plot-pen-arm', x1: 0, y1: frame.y, x2: 0, y2: frame.y }, pen);
  add('rect', { class: 'plot-pen-car', x: -17, y: frame.y - 9, width: 34, height: 18 }, pen);
  const tip = add('circle', { class: 'plot-pen-tip', r: 10 }, pen);

  bursts.forEach((burst, i) => {
    const x1 = burst.from * lastX;
    const x2 = burst.to * lastX;
    const y = frame.y + frame.h + 10;
    add('path', { class: 'rule', d: `M${x1} ${y} v12 H${x2} v-12`, fill: 'none' });
    add('text', {
      class: 'plot-label', x: (x1 + x2) / 2, y: y + 56, 'text-anchor': 'middle', 'font-size': 38,
      text: ['THE SWITCH', 'THE LAUNCH', 'THE REBUILD'][i],
    });
  });
  root.append(svg);

  function draw(p) {
    const n = Math.max(1, Math.round(p * (points.length - 1)));
    const d = points.slice(0, n + 1)
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`)
      .join(' ');
    below.setAttribute('d', d);
    above.setAttribute('d', d);
    const [x, y] = points[n];
    pen.setAttribute('transform', `translate(${x} 0)`);
    arm.setAttribute('y2', y);
    tip.setAttribute('cy', y);
    tip.style.fill = y < limitY ? 'var(--red)' : 'var(--blue)';
  }

  return {
    setStep(step, animate) {
      ctx.cancel();
      draw(animate ? 0 : 1);
      if (animate) ctx.tween(2100, draw, { ease: Deck.ease.linear, delay: 250 });
    },
  };
});
