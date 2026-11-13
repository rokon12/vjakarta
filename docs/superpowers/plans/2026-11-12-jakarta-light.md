# Jakarta Light Theme (vjakarta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the JakartaOne deck in the Jakarta light theme with stylesheet and build changes only, keep every check green, and republish it.

**Architecture:** The color and font tokens move out of `core/theme.css` into theme files (`themes/blueprint.css`, `themes/jakarta-light.css`). `build.mjs` inlines one of them, picked by `--theme` (default in one constant), and inlines fonts referenced as `url("font:<file>")` as data URIs. A new headless-Chrome probe (`tools/style_probe.mjs`) reads computed styles, painted colors and text contrast from the built deck, and Python tests assert on its output.

**Tech Stack:** Node 24 (no npm packages), Python 3 unittest, headless Google Chrome over the DevTools protocol (as `tools/live_run.mjs` already does), Inter 4.1 variable font (SIL OFL).

**Spec:** `docs/superpowers/specs/2026-11-12-slide-kit-design.md` (Part 1).

## Global Constraints

- Work in `/Users/bazlur/projects/vjakarta` on a branch `jakarta-light` cut from `main`; all paths below are relative to `slides-src/` unless they start with `docs/`.
- Do not edit `slides/*`, `scenes/*`, `core/core.js`, `core/chrome.html`, `core/notes.json`, `run-of-show.html`, or anything outside `slides-src/` except the final rebuilt `../slides.html` and `../index.html`. No slide text, number, click count, note or minute mark changes.
- Jakarta palette, exact: Dark Purple `#1B208B`, Royal Blue `#182CB9`, Light Blue `#5EA9FF`, Orange `#FF7110`, Grey `#2F4A60` (body text only). Yellow `#FDB940` is never used. No Jakarta EE logo.
- Data colors keep today's meanings: red `#d31f2b` (late and failed), red ink `#b5121d`, green `#0a7d4f` (ok, done, stopped cleanly), blue = Royal Blue `#182CB9` (running, has a thread), lock held = Orange `#FF7110` (it was yellow).
- Slide text (headlines, say/body/caption/rows/kickers/title/tblock text) uses Inter. SVG text inside scenes, stamps, cue labels, digit readouts and the handwriting notes keep the faces they have in the blueprint theme.
- Inter is embedded (Inter is not installed on the presenting Mac). The built deck stays one self-contained file that works offline from `file://`.
- Switching back is one line: `const DEFAULT_THEME = 'jakarta-light';` in `build.mjs` (or `node build.mjs --theme blueprint`).
- Must stay green at the end: `python3 -m unittest discover -s tools -p 'test_*.py'`, `python3 ../tools/test_series.py`, `node tools/check.mjs ../slides.html selftest` (38 slides, 102 states), `python3 tools/numbers_check.py ../slides.html specs/_numbers.md`, `python3 tools/code_check.py ../slides.html ..`, `node tools/check.mjs ../slides.html fitcheck` with no spills beyond the four known ones (`leak.0` comma and ms, `cancel.0` ms, pinning comma), and `node tools/live_run.mjs` matching at least as well as before (99/102, the 3 known overload flickers).
- Commit messages: short, lowercase, plain English, like the existing history.

## Review Focus

1. Text painted in Light Blue (2.6:1 on white) or Orange (2.9:1 on white) in some state no test names: unreadable on the livestream. Pinned by the contrast test in Task 4.
2. Inter is wider than DIN Condensed, so headlines and rows wrap or spill into scene boxes. Pinned by the fitcheck step in Task 4 (no new spills).
3. Hardcoded blueprint colors (the SVG fills in `core/chrome.html`, `rgba(255, 196, 0, 0.86)` in the highlighter, overlay fallbacks in `core/base.css`) still paint navy or yellow. Pinned by the painted-colors test in Task 4.
4. Scene SVG text switching to Inter because a shared font token changed, so diagram labels collide. Pinned by `test_scene_text_keeps_its_face` in Task 3.
5. The embedded font failing to load from `file://` and the deck silently falling back to Verdana. Pinned by `test_inter_is_embedded_and_loaded` in Task 3.

---

### Task 1: Theme files and the build's `--theme` option

**Files:**
- Create: `themes/blueprint.css` (the `:root` token block moved verbatim from `core/theme.css` lines 1–35)
- Modify: `core/theme.css` (token block removed, nothing else), `build.mjs`
- Test: `tools/test_build.py`

**Interfaces:**
- Produces: `node build.mjs [--theme <name>] [--out <file>]`; `const DEFAULT_THEME` in `build.mjs` (`'blueprint'` in this task); theme CSS is appended after `core/theme.css` in the `/*@core.css*/` part; inside theme CSS, `url("font:<file>")` is replaced by `url("data:font/woff2;base64,<…>")` read from `assets/fonts/<file>`.
- Build errors (exit 1, message on stderr): `unknown theme: <name> (have: <comma-separated names>)`; `missing font: assets/fonts/<file>`.

- [ ] **Step 1: Take a baseline of the current look**

Run: `git switch -c jakarta-light && node build.mjs --out tmp/baseline.html && node tools/shoot_all.mjs tmp/baseline.html tmp/shots-before`
Expected: 102 PNGs in `tmp/shots-before`.

- [ ] **Step 2: Write the failing tests**

```python
class BuildTest(unittest.TestCase):
    def test_unknown_theme_fails_and_names_the_themes(self):
        run = build('--theme', 'nope', '--out', 'tmp/nope.html')
        self.assertEqual(1, run.returncode)
        self.assertIn('unknown theme: nope (have: blueprint', run.stderr)

    def test_a_missing_font_fails_the_build(self):
        # writes themes/zz-missing.css containing url("font:Missing.woff2"), builds with it, removes it in tearDown
        self.assertIn('missing font: assets/fonts/Missing.woff2', run.stderr)
```

`build(*args)` runs `node build.mjs` in `slides-src/` with `capture_output=True, text=True`.

- [ ] **Step 3: Run them to see them fail**

Run: `python3 -m unittest tools/test_build.py -v`
Expected: both FAIL (the build ignores `--theme` today).

- [ ] **Step 4: Move the tokens, add the option and the font inlining**

- [ ] **Step 5: Run the tests, then prove blueprint did not move a pixel**

Run: `python3 -m unittest tools/test_build.py -v && node build.mjs --theme blueprint --out tmp/blueprint.html && node tools/shoot_all.mjs tmp/blueprint.html tmp/shots-after && for f in tmp/shots-before/*.png; do cmp -s "$f" "tmp/shots-after/$(basename "$f")" || echo "DIFF $f"; done`
Expected: 2 tests OK, and no `DIFF` lines.

- [ ] **Step 6: Commit**

```bash
git add themes/blueprint.css core/theme.css build.mjs tools/test_build.py
git commit -m "move the colors and fonts into theme files the build can pick"
```

### Task 2: The style probe

**Files:**
- Create: `tools/cdp.mjs` (the Chrome launch and DevTools-protocol plumbing extracted from `tools/live_run.mjs`), `tools/style_probe.mjs`
- Modify: `tools/live_run.mjs` (imports `tools/cdp.mjs`; behavior unchanged)
- Test: `tools/test_style_probe.py`

**Interfaces:**
- Produces `tools/cdp.mjs`: `export async function openDeck(url: string, { width = 1920, height = 1080 } = {}): Promise<{ evaluate(expression: string): Promise<any>, close(): Promise<void> }>`.
- Produces `node tools/style_probe.mjs <deck.html> <mode> [arg]`, always printing one JSON document to stdout, exit 0 unless the page fails to load. The deck is opened with `?still`; a state `"<slide-id>.<step>"` is reached through the URL hash the way `core.js` handles it (see `core.js` around line 298).
  - `styles <spec.json>`: spec is `[{ "state": "big.1", "selector": ".headline", "pseudo": null, "props": ["color", "font-family"] }]`; output is the same list with a `"values": {prop: computedValue}` added (first matching element; `"values": null` if none).
  - `colors`: every distinct computed `color`, `background-color`, `fill`, `stroke`, `border-*-color` and every `rgb(…)`/`rgba(…)` inside `background-image`, from visible elements under `#stage` and `#chrome`, across all states, as `[{ "value": "rgb(…)", "states": ["big.1", …], "example": "<selector-ish path>" }]`. Fully transparent values are skipped.
  - `contrast`: every visible text run under `#stage` and `#chrome` in every state whose contrast ratio against the nearest opaque background behind it (walk ancestors' `background-color`, else the stage background) is below 3.0 when its font size is ≥ 24 px, or below 4.5 when smaller, as `[{ "state", "text", "color", "background", "ratio", "size" }]`. SVG text uses `fill` as its color.
  - `fonts`: `{ "families": [{ "family", "status" }] }` from `document.fonts` after `await document.fonts.ready`.

- [ ] **Step 1: Write the failing tests (against the blueprint build from Task 1)**

```python
class StyleProbeTest(unittest.TestCase):
    def test_reads_the_blueprint_paper(self):
        values = probe_styles('tmp/blueprint.html', [{'state': 'title.0', 'selector': '#stage', 'props': ['background-color']}])
        self.assertEqual('rgb(238, 242, 243)', values[0]['values']['background-color'])

    def test_finds_the_blueprint_yellow(self):
        self.assertIn('rgb(255, 196, 0)', [c['value'] for c in probe('tmp/blueprint.html', 'colors')])

    def test_reports_low_contrast_text(self):
        # a three-line fixture deck page under tools/fixtures/contrast.html with one #5EA9FF paragraph on white
        found = probe('tools/fixtures/contrast.html', 'contrast')
        self.assertEqual(['light blue on white'], [f['text'] for f in found])
```

`tools/fixtures/contrast.html` is the smallest page the probe can open: a `#stage` holding one `.slide.is-active` section (id `fixture`) with a 30 px paragraph "light blue on white" in `#5EA9FF` and one in `#1B208B`, plus the `Deck` hash handling stubbed so `fixture.0` is a state. The probe must not need the engine to list states: a slide's steps are the larger of its `data-steps` attribute and the highest `data-step` value inside it, and its states are `<id>.0` to `<id>.<steps>`.

- [ ] **Step 2: Run them to see them fail**

Run: `python3 -m unittest tools/test_style_probe.py -v`
Expected: FAIL (no `tools/style_probe.mjs`).

- [ ] **Step 3: Extract `tools/cdp.mjs`, write `tools/style_probe.mjs`**

Contrast uses the WCAG relative-luminance formula; an `rgba` color is composited over the background it sits on before the ratio is taken.

- [ ] **Step 4: Run the tests and confirm live_run still works**

Run: `python3 -m unittest tools/test_style_probe.py -v && node tools/live_run.mjs tmp/blueprint.html tmp/live-blueprint 7000 8 | tail -2`
Expected: 3 tests OK; live_run reports the same match count as before the extraction (99/102).

- [ ] **Step 5: Commit**

```bash
git add tools/cdp.mjs tools/style_probe.mjs tools/live_run.mjs tools/test_style_probe.py tools/fixtures/contrast.html
git commit -m "add a probe that reads styles, colors and contrast from the built deck"
```

### Task 3: The Jakarta light theme

**Files:**
- Create: `themes/jakarta-light.css`, `assets/fonts/InterVariable.woff2`, `assets/fonts/OFL.txt`
- Modify: `build.mjs` (`DEFAULT_THEME = 'jakarta-light'`)
- Test: `tools/test_theme.py`

**Interfaces:**
- Consumes: Task 1's `--theme` and `url("font:…")`; Task 2's `style_probe.mjs styles|fonts`.
- Produces: `themes/jakarta-light.css` with these tokens, exact: `--paper #FFFFFF`, `--paper-2 #F3F5FF`, `--white #FFFFFF`, `--grid #E6E9FB`, `--grid-major #CDD3F5`, `--ink #1B208B`, `--ink-2 #2F4A60`, `--plate #1B208B`, `--red #d31f2b`, `--red-ink #b5121d`, `--blue #182CB9`, `--green #0a7d4f`, `--yellow #FF7110`, `--letterbox #0d1050`, `--overlay-ground rgba(13, 16, 80, 0.97)`, `--overlay-ground-solid #0d1050`, `--overlay-ink #FFFFFF`, `--overlay-pick #FF7110`, plus new `--sans: Inter, "Helvetica Neue", Arial, sans-serif`, `--orange #FF7110`, `--light-blue #5EA9FF`. `--dc`, `--da`, `--mono`, `--hand` keep their blueprint values (scene text depends on them); slide text gets Inter through selectors, not by redefining those tokens.

- [ ] **Step 1: Get Inter**

Run (in the scratch folder, never inside the repo): download `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip` into a new empty folder, unzip it there, copy `web/InterVariable.woff2` to `assets/fonts/InterVariable.woff2` and `LICENSE.txt` to `assets/fonts/OFL.txt`.
Expected: `file assets/fonts/InterVariable.woff2` says Web Open Font Format (Version 2); `OFL.txt` contains "SIL OPEN FONT LICENSE".

- [ ] **Step 2: Write the failing tests (build `../slides.html` with the default theme in `setUpClass`, and `tmp/blueprint.html` with `--theme blueprint`)**

```python
class JakartaLightTest(unittest.TestCase):
    def test_the_stage_is_white_without_graph_paper(self):
        v = style('title.0', '#stage', 'background-color', 'background-image')
        self.assertEqual(('rgb(255, 255, 255)', 'none'), v)

    def test_headlines_are_dark_purple_inter_800(self):
        color, family, weight = style('big.0', '.headline', 'color', 'font-family', 'font-weight')
        self.assertEqual('rgb(27, 32, 139)', color)
        self.assertTrue(family.startswith('Inter'))
        self.assertEqual('800', weight)

    def test_the_title_is_dark_purple_inter(self):
        color, family = style('title.0', '[data-layout="title"] h1', 'color', 'font-family')
        self.assertEqual('rgb(27, 32, 139)', color)
        self.assertTrue(family.startswith('Inter'))

    def test_captions_are_grey_inter(self):
        color, family = style('big.1', '.caption', 'color', 'font-family')
        self.assertEqual('rgb(47, 74, 96)', color)
        self.assertTrue(family.startswith('Inter'))

    def test_the_terminal_cue_is_orange(self):
        self.assertEqual('rgb(255, 113, 16)', style('before-run.1', '.cue .h', 'background-color')[0])

    def test_code_sits_on_a_pale_panel_in_dark_purple(self):
        panel, = style('budgets-code.0', '.code', 'background-color')
        line, = style('budgets-code.0', '.code .ln', 'color')
        keyword, = style('budgets-code.0', '.code .k', 'color')
        self.assertEqual(('rgb(243, 245, 255)', 'rgb(27, 32, 139)', 'rgb(24, 44, 185)'), (panel, line, keyword))

    def test_the_highlighter_is_orange_not_yellow(self):
        image, color = style('budgets-code.1', '.code .hl', 'background-image', 'color')
        self.assertIn('rgba(255, 113, 16, 0.18)', image)
        self.assertEqual('rgb(208, 87, 0)', color)

    def test_the_left_stripe_has_the_three_colors(self):
        image, width = style('title.0', '#stage', 'background-image', 'width', pseudo='::before')
        for rgb in ('rgb(27, 32, 139)', 'rgb(24, 44, 185)', 'rgb(255, 113, 16)'):
            self.assertIn(rgb, image)
        self.assertEqual('12px', width)

    def test_scene_text_keeps_its_face(self):
        for state, selector in [('big.1', 'svg text'), ('flood.1', 'svg .lbl'), ('service.1', 'svg .val')]:
            self.assertEqual(style(state, selector, 'font-family', deck='tmp/blueprint.html'),
                             style(state, selector, 'font-family'))

    def test_stamps_and_handwriting_keep_their_faces(self):
        for state, selector in [('door.2', '.stamp'), ('switch.0', '.note')]:   # pick states where each is visible
            self.assertEqual(style(state, selector, 'font-family', deck='tmp/blueprint.html'),
                             style(state, selector, 'font-family'))

    def test_inter_is_embedded_and_loaded(self):
        families = probe('../slides.html', 'fonts')['families']
        self.assertIn({'family': 'Inter', 'status': 'loaded'}, families)
        self.assertIn('url("data:font/woff2;base64,', DECK)

    def test_switching_back_is_one_constant(self):
        self.assertIn("const DEFAULT_THEME = 'jakarta-light';", BUILD)
```

If a named state does not show the element (a stamp first appears at a later step), use the first state that does; keep the assertion.

- [ ] **Step 3: Run them to see them fail**

Run: `python3 -m unittest tools/test_theme.py -v`
Expected: FAIL on everything except the scene-text and stamp tests (those pass trivially until the theme exists, which is fine: they guard the next step).

- [ ] **Step 4: Write `themes/jakarta-light.css` and flip `DEFAULT_THEME`**

Besides the tokens: `@font-face { font-family: Inter; src: url("font:InterVariable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }`; `#stage` background white with no image; `#stage::before` is the stripe (`position: absolute; left: 0; top: 0; bottom: 0; width: 12px; pointer-events: none; background: linear-gradient(#1B208B 0 40%, #182CB9 40% 70%, #FF7110 70%)`), stacked under slide content; Inter (`var(--sans)`) on the slide-text selectors (`.headline`, `[data-layout="title"] h1`, `[data-layout="title"] .lede`, `.say`, `.body`, `.caption`, `.rows > li > span`, `.tblock`, `[data-layout="section"] h2`, `[data-layout="check"] .q`, `.book-title`) with headlines at weight 800 and no uppercase transform; captions/body in `var(--ink-2)`; `.code` panel `#F3F5FF` with Dark Purple lines, Royal Blue keywords, the highlighter sweep `rgba(255, 113, 16, 0.18)` with text `#d05700`; plates (label|value, plate numerals, chrome plate) in Dark Purple with white text and Orange numerals. Font sizes of the Inter selectors may be reduced in this file if Task 4's fitcheck needs it.

- [ ] **Step 5: Run the tests**

Run: `node build.mjs --out ../slides.html && node build.mjs --theme blueprint --out tmp/blueprint.html && python3 -m unittest tools/test_theme.py -v`
Expected: 12 tests OK.

- [ ] **Step 6: Commit**

```bash
git add themes/jakarta-light.css assets/fonts build.mjs tools/test_theme.py
git commit -m "add the jakarta light theme and make it the default"
```

### Task 4: Chrome, leftovers, contrast and fit

**Files:**
- Modify: `themes/jakarta-light.css`
- Test: `tools/test_theme.py` (three more tests)

**Interfaces:**
- Consumes: Task 2's `colors` and `contrast` modes; Task 3's theme.

- [ ] **Step 1: Write the failing tests**

```python
    def test_no_yellow_and_no_blueprint_navy_or_paper_is_painted(self):
        painted = {c['value'] for c in probe('../slides.html', 'colors')}
        for banned in ('rgb(255, 196, 0)', 'rgba(255, 196, 0', 'rgb(253, 185, 64)',
                       'rgb(14, 27, 44)', 'rgb(22, 38, 58)', 'rgb(238, 242, 243)', 'rgb(10, 63, 184)'):
            self.assertFalse([v for v in painted if v.startswith(banned)], banned)

    def test_every_text_run_is_readable(self):
        self.assertEqual([], probe('../slides.html', 'contrast'))

    def test_the_footer_ruler_is_dark_purple(self):
        self.assertEqual(('rgb(27, 32, 139)',), style('big.1', '#chrome .ruler line', 'stroke'))
```

- [ ] **Step 2: Run them to see them fail**

Run: `python3 -m unittest tools/test_theme.py -v`
Expected: the three new tests FAIL, listing the leftovers (chrome ruler and markers, hatch pattern, highlighter rgba, overlays).

- [ ] **Step 3: Override the leftovers in `themes/jakarta-light.css`**

CSS beats SVG presentation attributes: restyle `#chrome .ruler line`, `#chrome .ruler text`, the arrow markers (`--ink`, red arrow `--red`) and the hatch pattern (`--blue`) defined in `core/chrome.html`; the progress fill in Light Blue, the "here" marker in Orange; the overview and help overlays through the `--overlay-*` tokens; anything the contrast list names, by changing its color in the theme (never by editing a slide). The speaker-notes window (`NOTES_PAGE` in `core.js`) is the speaker's own screen and stays as it is.

- [ ] **Step 4: Run the tests and the fit check**

Run: `node build.mjs --out ../slides.html && python3 -m unittest tools/test_theme.py -v && node tools/check.mjs ../slides.html fitcheck`
Expected: 15 tests OK; fitcheck lists only the four known spills (`leak.0` comma and ms, `cancel.0` ms, pinning comma). Any other spill: shrink that selector's size in the theme and rerun.

- [ ] **Step 5: Look at every slide at livestream size**

Run: `node tools/shoot_all.mjs ../slides.html tmp/shots-jakarta` and view the final state of every slide (38 images) scaled to 1280 × 720.
Expected: no overlap, nothing clipped, every label readable, the stripe never covers content, red/green/blue/orange mean what the notes say on the climax (big.1), flood, door, rebuilt, timeout and pinning slides. Fix in the theme and repeat Step 4 if not.

- [ ] **Step 6: Commit**

```bash
git add themes/jakarta-light.css tools/test_theme.py
git commit -m "recolor the footer, markers and overlays, and keep every label readable"
```

### Task 5: Full check, publish

**Files:**
- Modify: `README.md` (a short "Themes" section: the two themes, `--theme`, `DEFAULT_THEME`, `url("font:…")`, the probe), `../slides.html`, `../index.html`
- Test: the whole suite

- [ ] **Step 1: Run every check on the final build**

Run: `node build.mjs --out ../slides.html && python3 -m unittest discover -s tools -p 'test_*.py' 2>&1 | tail -3 && python3 ../tools/test_series.py 2>&1 | tail -1 && node tools/check.mjs ../slides.html selftest && python3 tools/numbers_check.py ../slides.html specs/_numbers.md && python3 tools/code_check.py ../slides.html .. && node tools/live_run.mjs ../slides.html tmp/live 7000 8 | tail -3`
Expected: unit tests OK (21 earlier plus the new ones), series OK, `SELFTEST OK slides=38 states=102`, `NUMBERS OK`, `CODE OK`, live_run 99/102 with only the overload flickers.

- [ ] **Step 2: Prove nothing but styles changed**

Run: `git diff --stat main -- slides scenes core/core.js core/chrome.html core/notes.json run-of-show.html`
Expected: no output.

- [ ] **Step 3: Write the README section, copy the build, commit, merge, push**

```bash
cp ../slides.html ../index.html
git add README.md ../index.html
git commit -m "publish the deck in the jakarta light theme"
git switch main && git merge --ff-only jakarta-light
env -u GITHUB_TOKEN git push origin main
```

- [ ] **Step 4: Confirm Pages serves it**

Run: wait for the Pages build (`env -u GITHUB_TOKEN gh api repos/rokon12/vjakarta/pages/builds/latest --jq .status` is `built`), then `curl -s https://rokon12.github.io/vjakarta/ | cmp - ../index.html`
Expected: no output (identical).
