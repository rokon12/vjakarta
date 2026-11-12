const { svg } = Deck;

Deck.scene('service', (root, args, ctx) => {
  const W = root.clientWidth;
  const H = root.clientHeight;
  const stage = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: { overflow: 'visible' } });
  const add = (tag, attrs, parent = stage) => parent.appendChild(svg(tag, attrs));
  root.append(stage);

  const holdsY = 190;
  const payY = 500;
  const executor = { x: 430, w: 280 };
  const right = { x: 1290, w: W - 1290 };
  const steps = [];
  const at = step => {
    const g = add('g');
    steps.push([step, g]);
    return g;
  };

  function heading(x, y, width, text, parent = stage) {
    add('text', { class: 'lbl sm', x, y, text }, parent);
    add('line', { class: 'rule', x1: x, y1: y + 10, x2: x + width, y2: y + 10 }, parent);
  }

  function value(x, y, number, unit, sub, parent) {
    const text = add('text', { class: 'val', x, y, 'text-anchor': 'middle', style: { 'font-size': '120px' } }, parent);
    add('tspan', { text: number }, text);
    if (unit) add('tspan', { class: 'val unit', text: ` ${unit}`, style: { 'font-size': '56px' } }, text);
    add('text', { class: 'sub', x, y: y + 48, 'text-anchor': 'middle', text: sub }, parent);
  }

  // one reservation, five calls
  heading(0, 60, 260, 'ONE RESERVATION');
  add('rect', { class: 'box', x: 0, y: 260, width: 220, height: 170 });
  for (let i = 0; i < 5; i++) add('rect', { class: 'tok is-run', x: 22 + i * 38, y: 330, width: 26, height: 26 });
  add('text', { class: 'sub', x: 110, y: 470, 'text-anchor': 'middle', text: 'all five at once' });
  add('path', { class: 'wire', d: `M220 300 C 320 300, 330 ${holdsY}, ${executor.x} ${holdsY}`, 'marker-end': 'url(#arrow)' });
  add('path', { class: 'wire', d: `M220 390 C 320 390, 330 ${payY}, ${executor.x} ${payY}`, 'marker-end': 'url(#arrow)' });
  add('text', { class: 'lbl sm', x: 226, y: holdsY - 40, text: '4 SEAT HOLDS' });
  add('text', { class: 'lbl sm', x: 226, y: payY + 70, text: '1 PAYMENT' });

  // the executor
  heading(executor.x, 60, executor.w, 'EXECUTOR');
  add('rect', { class: 'box is-heavy', x: executor.x, y: 100, width: executor.w, height: 480 });
  value(executor.x + executor.w / 2, 360, '16', '', 'platform threads', at(2));

  // seat holds: the pool, then the database
  add('line', { class: 'wire', x1: executor.x + executor.w, y1: holdsY, x2: 800, y2: holdsY, 'marker-end': 'url(#arrow)' });
  heading(800, 60, 420, 'POOL');
  add('rect', { class: 'box', x: 800, y: 100, width: 420, height: 180 });
  const poolNumbers = at(1);
  add('text', { class: 'lbl sm', x: 884, y: 60, text: '· 20 CONNECTIONS' }, poolNumbers);
  for (let i = 0; i < 20; i++) {
    add('rect', { class: 'box', x: 822 + (i % 10) * 38, y: 132 + Math.floor(i / 10) * 66, width: 28, height: 44 }, poolNumbers);
  }
  add('line', { class: 'wire', x1: 1220, y1: holdsY, x2: right.x, y2: holdsY, 'marker-end': 'url(#arrow)' });
  heading(right.x, 60, right.w, 'DATABASE');
  add('rect', { class: 'box', x: right.x, y: 100, width: right.w, height: 180 });
  value(right.x + right.w / 2, 210, '10', 'ms', 'a seat hold', at(1));

  // the payment: straight to the provider
  add('line', { class: 'wire', x1: executor.x + executor.w, y1: payY, x2: right.x, y2: payY, 'marker-end': 'url(#arrow)' });
  heading(right.x, 370, right.w, 'PAYMENT PROVIDER');
  add('rect', { class: 'box', x: right.x, y: 410, width: right.w, height: 180 });
  value(right.x + right.w / 2, 520, '20', '', 'at a time · 50 ms each', at(1));

  const retry = at(3);
  add('rect', { class: 'box', x: 820, y: payY - 46, width: 300, height: 92 }, retry);
  add('text', { class: 'lbl', x: 970, y: payY + 16, 'text-anchor': 'middle', text: '@RETRY' }, retry);
  add('text', { class: 'sub', x: 970, y: payY + 90, 'text-anchor': 'middle', text: '3 retries · never needed so far' }, retry);

  return {
    setStep(step) {
      ctx.cancel();
      for (const [from, g] of steps) g.setAttribute('visibility', step >= from ? 'visible' : 'hidden');
    },
  };
});
