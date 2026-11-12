const { svg } = Deck;

function canvas(root) {
  const stage = svg('svg', {
    viewBox: `0 0 ${root.clientWidth} ${root.clientHeight}`,
    width: root.clientWidth,
    height: root.clientHeight,
    style: { overflow: 'visible' },
  });
  root.append(stage);
  return (tag, attrs, parent = stage) => parent.appendChild(svg(tag, attrs));
}

function database(add, y, height) {
  add('rect', { class: 'box is-heavy', x: 1340, y, width: 367, height });
  add('text', { class: 'lbl', x: 1523, y: y + height / 2 - 6, 'text-anchor': 'middle', text: 'DATABASE' });
  add('text', { class: 'sub', x: 1523, y: y + height / 2 + 40, 'text-anchor': 'middle', text: 'every query is a wait' });
}

// One request per OS thread: the thread is held for the whole wait.
function platform(root, ctx) {
  const add = canvas(root);
  const CYCLE = 3.4;
  const lanes = [];

  const poolLabel = add('text', { class: 'lbl sm', x: 330, y: 44 });
  for (let i = 0; i < 6; i++) {
    const y = 70 + i * 96;
    add('text', { class: 'lbl sm', x: 330, y: y + 46, text: 'THREAD ' + (i + 1) });
    add('rect', { class: 'box', x: 500, y, width: 790, height: 64 });
    add('line', { class: 'wire', x1: 1290, y1: y + 32, x2: 1336, y2: y + 32, 'marker-end': 'url(#arrow)' });
    lanes.push({
      token: add('rect', { class: 'tok is-run', x: 514, y: y + 17, width: 30, height: 30 }),
      first: add('rect', { class: 'bar is-run', x: 560, y: y + 17, height: 30, width: 0 }),
      wait: add('rect', { class: 'bar is-wait', x: 620, y: y + 17, height: 30, width: 0 }),
      last: add('rect', { class: 'bar is-run', x: 1210, y: y + 17, height: 30, width: 0 }),
    });
  }
  database(add, 70, 544);

  const queueLabel = add('text', { class: 'lbl sm', x: 0, y: 44, text: 'WAITING FOR A THREAD' });
  const queue = Array.from({ length: 6 }, (_, i) =>
    add('rect', { class: 'tok is-wait', x: 250 - i * 44, y: 300, width: 30, height: 30 }));
  add('line', { class: 'wire', x1: 0, y1: 348, x2: 290, y2: 348, 'marker-end': 'url(#arrow)' });

  const cost = add('g');
  add('rect', { class: 'bar is-run', x: 500, y: 668, width: 44, height: 30 }, cost);
  add('text', { class: 'lbl sm', x: 558, y: 696, text: 'WORKING' }, cost);
  add('rect', { class: 'bar is-wait', x: 730, y: 668, width: 44, height: 30 }, cost);
  add('text', { class: 'lbl sm', x: 788, y: 696, text: 'WAITING, THREAD STILL HELD' }, cost);
  add('text', { class: 'val', x: 500, y: 742, text: 'about 1 MB of stack each, working or waiting' }, cost);

  function draw(t) {
    lanes.forEach((lane, i) => {
      const p = (t / CYCLE + i * 0.17) % 1;
      const waiting = p > 0.08 && p < 0.9;
      lane.token.setAttribute('class', waiting ? 'tok is-wait' : 'tok is-run');
      lane.first.setAttribute('width', Math.min(p / 0.08, 1) * 60);
      lane.wait.setAttribute('width', Math.max(0, Math.min((p - 0.08) / 0.82, 1)) * 590);
      lane.last.setAttribute('width', Math.max(0, (p - 0.9) / 0.1) * 60);
    });
    const shift = ((t / CYCLE) * 6) % 1;
    queue.forEach((token, i) => token.setAttribute('x', 250 - (i - shift) * 44));
    queue[0].setAttribute('opacity', 1 - shift);
  }

  return {
    setStep(step) {
      ctx.cancel();
      cost.setAttribute('visibility', step >= 1 ? 'visible' : 'hidden');
      queueLabel.setAttribute('visibility', step >= 2 ? 'visible' : 'hidden');
      poolLabel.textContent = step >= 2 ? 'THE POOL · OURS HAD 16 THREADS' : 'A POOL OF PLATFORM THREADS';
      draw(1.5);
      ctx.loop((dt, t) => draw(1.5 + t));
    },
  };
}

// Virtual threads hop on and off four carriers; the waiting happens on the heap.
function virtual(root, ctx) {
  const add = canvas(root);
  const RUN = 0.4;
  const PARK = 1.9;
  const carriers = [];

  add('text', { class: 'lbl sm', x: 0, y: 44, text: 'RUNNABLE' });
  add('line', { class: 'rule', x1: 0, y1: 54, x2: 290, y2: 54 });
  for (let i = 0; i < 4; i++) {
    const y = 70 + i * 70;
    add('text', { class: 'lbl sm', x: 330, y: y + 40, text: 'CARRIER ' + (i + 1) });
    add('rect', { class: 'box', x: 520, y, width: 770, height: 52 });
    carriers.push({ y, thread: null, bar: add('rect', { class: 'bar is-run', x: 574, y: y + 11, height: 30, width: 0 }) });
  }
  add('line', { class: 'wire', x1: 1290, y1: 200, x2: 1336, y2: 200, 'marker-end': 'url(#arrow)' });
  database(add, 70, 550);

  const heapLabel = add('text', { class: 'lbl sm', x: 330, y: 388 });
  add('rect', { class: 'box', x: 330, y: 400, width: 960, height: 220 });
  const crowd = add('g');
  for (let i = 39 * 2; i < 39 * 8; i++) {
    add('rect', { class: 'tok is-wait', x: 344 + (i % 39) * 24, y: 414 + Math.floor(i / 39) * 24, width: 18, height: 18 }, crowd);
  }
  const note = add('text', { class: 'val', x: 0, y: 214, style: { 'font-size': '32px' } });
  const note2 = add('text', { class: 'val', x: 0, y: 256, style: { 'font-size': '32px' } });

  const tokens = Array.from({ length: 7 }, () => add('rect', { class: 'tok is-run', width: 30, height: 30 }));
  let threads = [];

  function spawn(count, parks) {
    threads = Array.from({ length: count }, (_, i) => ({
      state: 'runnable', left: 0, parks, done: false, wake: i * 0.28, x: 20 + i * 38, y: 80, slot: i,
    }));
    carriers.forEach(c => { c.thread = null; });
  }

  function advance(dt) {
    for (const thread of threads) {
      thread.wake -= dt;
      thread.left -= dt;
      if (thread.state === 'running' && thread.left <= 0) {
        const carrier = carriers.find(c => c.thread === thread);
        carrier.thread = null;
        if (thread.parks && !thread.done) {
          thread.state = 'parked';
          thread.left = PARK;
        } else {
          thread.state = 'runnable';
          thread.done = false;
          thread.wake = 0.5;
          thread.x = -40;
        }
      } else if (thread.state === 'parked' && thread.left <= 0) {
        thread.state = 'runnable';
        thread.done = true;
        thread.wake = 0;
      }
    }
    const waiting = threads.filter(t => t.state === 'runnable' && t.wake <= 0);
    for (const carrier of carriers) {
      if (carrier.thread || !waiting.length) continue;
      const thread = waiting.shift();
      carrier.thread = thread;
      thread.state = 'running';
      thread.left = thread.parks ? RUN : 1.5;
      thread.span = thread.left;
    }
    const ease = 1 - Math.exp(-dt * 16);
    let queued = 0;
    for (const thread of threads) {
      const carrier = carriers.find(c => c.thread === thread);
      const target = carrier
        ? [530, carrier.y + 11]
        : thread.state === 'parked'
          ? [350 + thread.slot * 48, 412]
          : [20 + queued++ * 38, 80];
      thread.x += (target[0] - thread.x) * ease;
      thread.y += (target[1] - thread.y) * ease;
    }
  }

  function draw() {
    tokens.forEach((token, i) => {
      const thread = threads[i];
      token.setAttribute('visibility', thread ? 'visible' : 'hidden');
      if (!thread) return;
      token.setAttribute('x', thread.x.toFixed(1));
      token.setAttribute('y', thread.y.toFixed(1));
      token.setAttribute('class', thread.state === 'running' ? 'tok is-run' : 'tok is-wait');
    });
    for (const carrier of carriers) {
      const thread = carrier.thread;
      carrier.bar.setAttribute('width', thread ? (1 - thread.left / thread.span) * 700 : 0);
    }
  }

  return {
    setStep(step, animate) {
      ctx.cancel();
      crowd.setAttribute('visibility', step === 3 ? 'visible' : 'hidden');
      heapLabel.textContent = step === 3
        ? 'HEAP · 1,000 PARKED VIRTUAL THREADS, STILL 4 CARRIERS'
        : 'HEAP · PARKED VIRTUAL THREADS';
      note.textContent = ['mounted: it runs', 'blocked: it parks,', 'answered: runnable,', ''][step];
      note2.textContent = ['on a carrier', 'carrier moves on', 'any free carrier', ''][step];
      spawn(step === 0 ? 1 : 7, step > 0);
      for (let i = 0; i < 160; i++) advance(1 / 60);
      draw();
      ctx.loop(dt => {
        advance(dt);
        draw();
      });
    },
  };
}

Deck.scene('carriers', (root, args, ctx) => (args.mode === 'platform' ? platform(root, ctx) : virtual(root, ctx)));
