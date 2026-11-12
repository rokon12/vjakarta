# How a scene plugs into the deck

The deck is one self-contained HTML file assembled by `build.mjs` from parts in this directory.
Read `core/core.js` (the engine, about 700 lines) and `core/theme.css` (the design system)
before you write anything.

```
build/
  build.mjs            assembles everything into one HTML file
  core/core.js         the engine (navigation, steps, scenes, checks). Do not edit.
  core/base.css        engine mechanics. Do not edit.
  core/theme.css       the design system: tokens, type, layouts, shared diagram parts. Do not edit.
  core/chrome.html     persistent chrome. Do not edit.
  slides/NN-id.html    one <section class="slide"> per file, assembled in file-name order
  scenes/<name>.js     scene code, one file per scene family
  scenes/<name>.css    scene styles
  specs/               this contract, the numbers sheet, one spec per scene
  tools/shot.sh        screenshot a slide state
  tools/check.mjs      run the built-in checks
```

You may only write the files your spec lists under "Files you own". Other people are writing
the other scenes and slides in this same directory at the same time.

## A slide

```html
<section class="slide" id="demo1-what" data-layout="scene" data-title="What happened"
         data-section="Demo 1" data-section-key="demo1" data-steps="3">
  <h2 class="headline">Slow database for three seconds, slow service for five</h2>
  <div class="scene-box" data-scene="overload" data-args='{"mode":"replay"}'></div>
  <p class="caption" data-step="3">732 of 1,809 customers waited more than half a second.</p>
</section>
```

- `id` is unique, with no dots. `data-steps` is the number of the last step (steps run 0..N).
  Without it the engine uses the highest `data-step` on the slide.
- An element with `data-step="k"` is hidden until step k (the engine adds `is-on`; it adds
  `is-new` to what appeared on the current step). `data-until="m"` hides it again from step m.
- The engine sets `data-at-step="k"` on the section, so CSS can react to the step.
- Host slides already exist for your scene. Keep their id, headline text and step story. You may
  restructure the markup inside the section, move captions, and change `data-steps` if your
  scene needs it. Keep slide copy in the slide file, not hard-coded in JS, unless it is a label
  that belongs to the diagram itself.

## A scene

```js
Deck.scene('overload', (root, args, ctx) => {
  // called once at load; root is the [data-scene] element, already laid out
  const width = root.clientWidth, height = root.clientHeight;   // stage pixels, read them here
  // build your DOM or SVG inside root
  return {
    setStep(step, animate, from) {},   // required
    enter() {},                        // optional: the slide became visible
    leave() {},                        // optional: the slide was hidden
    key(k) { return false; },          // optional: a letter key while visible; return true if handled
  };
});
```

`setStep(step, animate, from)` is the heart of it:
- It must put the scene into the state for `step`, whatever state it was in before. The speaker
  can jump to any step of any slide in any order, go backwards, and reload the page mid-talk.
- `animate` true: play the transition into this step. `from` is the previous step on this slide,
  or -1 when the slide was just entered. Going backwards and reloading always pass `animate` false.
- `animate` false: render the finished state of this step immediately and synchronously.
- Start it with `ctx.cancel()` so a fast double click never leaves two animations fighting.
- The engine cancels everything you scheduled through `ctx` when the slide is left, and calls
  `setStep` again when it is shown, so you rarely need `enter` and `leave`.

`ctx` is your only clock. Do not call `requestAnimationFrame`, `setTimeout` or `setInterval`
yourself, and do not animate scene content with CSS transitions or keyframes:
- `ctx.tween(ms, p => {...}, { ease, delay, done })` calls you with p from 0 to 1.
- `ctx.loop((dt, t) => {...})` calls you every frame with seconds since the last frame and since
  the loop started. Return false to stop. Long frames are clamped to 0.1 s.
- `ctx.after(ms, fn)` runs once.
- `ctx.cancel()` stops everything this scene scheduled.
- With motion off (`ctx.motion` false) tweens jump to p = 1, `after` runs at once and loops do
  not run. So "finished state without motion" has to come out of `setStep` itself.

Helpers: `Deck.el(tag, attrs, kids)`, `Deck.svg(tag, attrs, kids)` (attrs may include `text`
and a `style` object), `Deck.fmt(1812)` gives "1,812", `Deck.lerp`, `Deck.clamp`,
`Deck.ease.{linear,in,out,inOut,back}`, `Deck.rng(seed)` for repeatable randomness.

Your scene file is wrapped in its own function at build time, so top-level `const` is private.
Prefix every CSS class you add with the scene name (`.overload-slot`) and never restyle a
selector from `theme.css`.

## Drawing
- The stage is 1920 x 1080 and is scaled to the screen with a CSS transform. Prefer SVG and DOM;
  they stay sharp. If you use a canvas, give it a backing store twice its CSS size.
- Read sizes from `root` at mount. Do not assume the box size; lay out from width and height.
- Use the design tokens (CSS custom properties in `theme.css`) for every colour and font. In
  SVG, set `fill` and `stroke` through CSS classes or `style` with `var(--token)`, not literals.
- The diagram vocabulary is shared by all six scenes and defined in `theme.css` under
  "Diagram vocabulary": what a request looks like, and one colour each for running, waiting,
  done, late, rejected, cancelled, lock held. Use those meanings exactly, so that a waiting
  request looks the same on every slide of the deck.
- Projector rules: no meaningful text below 28 px, no hairlines (strokes at least 3 px for
  anything that carries meaning), strong contrast. Readouts the speaker quotes should be large.

## Code style
Plain modern JavaScript, no libraries, no network, no build step beyond concatenation. Write it
the way a careful person would by hand: small named functions, no comment that restates the
code, no dead code, no debugging leftovers, no `console.log`.

## Build and check (run from the build directory)

```
node build.mjs --only <fragment>[,<fragment>] --scenes <name> --out tmp/<name>.html    # a mini deck: your slides, your scene files
node tools/check.mjs tmp/<name>.html selftest     # every step, forwards and backwards, without errors
node tools/check.mjs tmp/<name>.html fitcheck     # nothing outside the stage, no small or clipped text
tools/shot.sh tmp/<name>.html <slide-id>.<step> tmp/<name>-<step>.png            # finished state of a step
tools/shot.sh tmp/<name>.html <slide-id>.<step> tmp/<name>-f.png frames 1200     # loops frozen 1,200 ms in
```

`--only` takes fragments of slide file names, for example `--only 11-,13-,16-`. `--scenes` takes
the base name of your scene files, so other people's half-written scenes cannot break your
build. Always write the mini deck to `tmp/<your scene name>.html`, never to `dist/`.

`shot.sh ... frames <ms>` loads the step in its finished state and lets `ctx` loops run for that
many milliseconds of virtual time. Use it for continuous motion (a simulation, a flow).

`shot.sh ... play <ms>` plays the transition INTO that step (from the previous step, or the
entrance when the step is 0) and freezes it that many milliseconds after it starts. Use it to
look at a transition part way through, for example `play 400` and `play 1500`:

```
tools/shot.sh tmp/<name>.html <slide-id>.<step> tmp/<name>-p.png play 400
```

Then open every PNG with the Read tool and look at it the way the back row of the room would.

## Done means
- `selftest` and `fitcheck` both print OK for your mini deck (a `SMALL` or `OUT` line is a
  defect to fix, not to explain away; mark truly decorative elements with `data-bleed` or
  fine print with `data-fine` only when that is honestly what they are).
- You have looked at a still screenshot of every step of every slide you own, plus at least two
  `frames` or `play` screenshots of each animated state, and fixed what you saw.
- Every number on screen is in `specs/_numbers.md`.
- Your scene matches the design system: someone flipping from another slide to yours must not
  see a change of style.

## The look, and the parts every scene shares

The deck is a lab notebook: graph paper, plotted traces with calibrated axes, instrument plates,
rubber stamps, and a technician's red pen. Scenes should feel plotted and measured. That means
axes with ticks and units, traces, dimension lines with arrowheads, legend keys, labelled
readouts. It does not mean illustration: no icons, no emoji, no rounded cards, no shadows,
glows or gradients, no decorative animation.

The reference rendering is the style tile in `../tiles/strip-chart/` (`shot-1.png` to
`shot-4.png`, and `tile.html` for how each part was drawn). `theme.css` carries its tokens and
these shared classes; use them instead of inventing parallel ones:

| What | How |
|---|---|
| A request, which is also a virtual thread | a square `rect.tok`, 18 px with the class stroke, on a 24 px pitch when piled; up to 30 px when there are only a few |
| Its state | add `is-run` (solid blue: on a thread, being served), `is-wait` (hollow blue: parked), `is-late` (hollow red: has waited past the deadline), `is-leak` (solid red: work nobody is waiting for), `is-ok` (green: finished in time or stopped cleanly), `is-off` (grey: turned away), `is-lock` (yellow: holds a lock) |
| A span of time on a timeline or Gantt row | `rect.bar` with the same `is-*` states (`is-wait` and `is-late` are hatched) |
| Anything structural: a thread, a carrier, a pool slot, the heap, the database | `rect.box`, ink outline on white; `is-heavy` for the one that matters |
| A connection between parts | `.wire`, with `marker-end="url(#arrow)"` for direction |
| Section labels inside a diagram | `text.lbl` (DIN Condensed caps, 44 px) or `text.lbl.sm` (36 px), over a `.rule` line |
| Values | `text.val` (40 px), `text.val.big` (150 px) with a `tspan.val.unit` for the unit, `text.sub` for a quiet second line |
| Chart parts | `.plot-ground`, `.plot-axis`, `.plot-grid`, `.plot-tick`, `.plot-num` (axis numbers, JetBrains Mono 30 px), `.plot-label`, `.plot-mark` (dashed marker line), `.plot-band` (a shaded span), `.plot-trace` with `.blue`, `.red` or `.green` |
| The pen of a live plot | `.plot-pen-arm`, `.plot-pen-car`, `.plot-pen-tip`, as in the tile |
| Digit readouts | HTML: `div.readouts > div.ro[.alarm|.good] > span.lb + span.win > i (one per character, i.dot for a point) + span.un` |
| A legend entry | HTML: `div.key > i[.is-wait|.is-late|...] + text` |
| A handwritten remark | HTML `div.note` (red, Bradley Hand); use at most one or two per slide |
| Patterns and markers already in the page | `url(#hatch-wait)`, `url(#hatch-late)`, `url(#arrow)`, `url(#arrow-red)`, `filter: url(#rough)` |

Conventions for the two scenes that draw carriers (`carriers` and `pinning`), so they match:
a carrier is a horizontal lane (`rect.box`) labelled `CARRIER 1`, `CARRIER 2` in `text.lbl.sm`;
a mounted virtual thread is a solid blue token at the left end of its lane with its work drawn
as a blue bar growing to the right; the heap is one wide `rect.box` labelled
`HEAP · PARKED VIRTUAL THREADS`, holding hollow blue tokens on a 24 px grid; threads that are
runnable but have no carrier wait in a row labelled `RUNNABLE`; a pinned carrier shows a yellow
`is-lock` bar for as long as it is stuck and the word `PINNED` in red.

Colours carry meaning, so do not use red, green or yellow for anything else. Blue and ink are
the neutral colours.
