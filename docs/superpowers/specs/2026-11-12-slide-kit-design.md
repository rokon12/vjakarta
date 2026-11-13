# Slide kit and the Jakarta light theme: design

Date: 2026-11-12. Speaker: the author of the vfun and vjakarta talks.

## Why

Each talk so far started by copying the previous talk's `slides-src` and stripping out its slides (vjakarta was built that way from vfun). The speaker wants their own reusable kit in a separate repo, so the next talk starts from a clean template and a new slide is quick to make, either written by hand or described to Claude. Separately, the JakartaOne deck (vjakarta, live on December 1, 2026) should look a bit Jakarta EE themed.

## What gets built

Two parts, in this order.

**Part 1: vjakarta in the Jakarta light theme (now, before December 1).** Swap the deck's colors and type to the Jakarta light theme in place. The slide fragments, scenes, notes, click order and timings do not change. The deck stays on its current engine and HTML fragments.

The speaker chose to **keep the lab-notebook pieces and recolor them**: the rubber stamps, the handwritten red-pen notes and arrows, the taped terminal label, the code highlighter sweep, the digit-window readouts and label|value plates, the plate numerals, the sprocket strip, the paper-feed transition, the taped book cover. Slide text (headlines, body, captions, kickers) moves to Inter. Text inside the animated diagrams keeps the condensed face, because its labels sit at fixed positions and Inter is much wider. Part 1 is a stylesheet change: no slide fragment or scene file is edited.

**Part 2: the kit, a separate repo.** The engine, the build, the checks, the phone cue-sheet generator, a set of slide layouts, two themes (Jakarta light, and the vfun blueprint look), and a Markdown authoring format. It ships an example `deck.md` made by converting a dozen or so vjakarta slides, which exercises every layout on real content.

After December 1, moving vjakarta onto the kit is optional and not part of this work.

## Decided by the speaker

- The kit lives in its own repo and is used as a template: each new talk starts with GitHub's "Use this template" and gets its own copy. Later kit fixes do not flow into older talks.
- Theme direction **B, Jakarta light** (from three mockups: blueprint recolored, Jakarta light, Jakarta dark).
- **No Jakarta EE logo**, anywhere. Colors and the brand font are enough.
- Slides are written in **Markdown**, with this shape (played back and confirmed):
  - One `deck.md` per talk. `---` separates slides. A short header block on a slide picks its layout and options. The deck's first header block holds deck-level settings (`theme`, `title`, `minutes`).
  - List items written with `+` appear one per click; items written with `-` appear together.
  - Everything after `???` on a slide is its speaker notes. A `run:` line becomes a command cue, as the `./run.sh` cues work today. Notes feed both the presenter view and the phone cue sheet.
  - A code slide's `source: <tag>:<path>` keeps today's check that every code line matches the real file at that git tag (`…` elides text).
  - Animated diagrams stay JavaScript, one file each, in the talk's own folder. Markdown only places them (`layout: scene`, `scene: <name>`).
  - Raw HTML is allowed inside a slide for anything Markdown cannot express.
- vjakarta gets the theme now; the kit's example deck uses converted vjakarta slides; vjakarta itself is not rebuilt on the kit before the talk.
- vfun (rokon12/vfun, `~/projects/vfun`) stays untouched.

## The Jakarta light theme

From the official Jakarta EE branding guidelines (jakarta.ee/legal/trademark_guidelines/jakarta-ee-branding-guidelines.pdf, v202510):

| Role | Color |
|---|---|
| Slide background | White `#FFFFFF` |
| Headings, big numbers | Dark Purple `#1B208B` |
| Kickers, small labels, "ok/neutral" data | Royal Blue `#182CB9` |
| Body text, captions | Grey `#2F4A60` (the guidelines allow Grey only for body copy) |
| Accent (rules, highlights), "late" data | Orange `#FF7110` |
| Chart lines, secondary data, footer | Light Blue `#5EA9FF` |
| "Failed" and "late" data | today's red (`#d31f2b`), per the data-color rule below |
| Code panel | a pale tint of the purple (mockup: `#f3f5ff`), purple text, keywords Royal Blue, highlighted tokens a dark orange (mockup: `#d05700`) |

- Yellow `#FDB940` is not used: the guidelines reserve it for the logo, and there is no logo.
- Type: Inter (the brand font) for slide text; headings heavy (800), labels semi-bold. Code keeps the current monospace stack. SVG text inside scenes keeps the condensed face. The handwriting face stays for the red-pen notes.
- A thin three-color stripe (Dark Purple, Royal Blue, Orange) runs down the left edge of every slide.
- The graph-paper background of the blueprint look is not part of this theme.
- **Data colors are not brand colors.** The colors that carry meaning in charts, scenes and stamps keep the meanings they have today, in both themes: red is late and failed (the speaker notes say "the red ones" about late requests), green is ok, done or stopped cleanly, blue is running or has a thread, and "lock held" (the pinning backup) gets its own warm color. The builder tunes their exact shades for a white background and may use Jakarta Royal Blue for "running". The Jakarta palette dresses everything else: type, rules, labels, code panels, the footer, the stripe. Where the mockup showed "late" in orange, this rule wins. Scenes take their colors from the theme, so the same scene reads correctly in either theme.
- Yellow does not appear as furniture (cue labels, highlighter sweeps, section numerals use Orange instead).
- The mockup the speaker picked is option B in `.superpowers/brainstorm/50300-1794537275/content/theme-direction.html`.

## The kit

Contents:

- The engine from vjakarta (`core/`: slides, clicks, scenes, speaker notes and presenter view, presenter timer, footer ruler sized to the talk's `minutes`).
- The build: one command turns `deck.md` (plus the talk's scenes and assets) into one self-contained HTML file, the copy to present from and the copy Pages serves.
- Themes: `jakarta-light` and `blueprint` (today's vfun/vjakarta look). One deck setting switches between them.
- Layouts, each with an example in the example deck: title, section break, statement, number (big number with stats), code (with `source:`), side-by-side, links/QR, scene host. The builder may add one if a converted vjakarta slide needs it.
- The checks: step-through self-test, the fit check (text spilling out of its box), the code check, the numbers check (optional per talk, against a numbers sheet).
- The phone cue-sheet generator, fed from the notes in `deck.md`.
- One small example scene, so the scene layout has something to host.
- A README: how to start a new talk from the template, write a slide, build, check, publish to Pages.
- Instructions for Claude in the repo (CLAUDE.md), so slides described to Claude get built the same way every time: the format, the layouts, the checks to run.

Talk-specific content stays out: vjakarta's scenes (overload, p99, carriers and the rest), numbers sheets, the book cover, slide text other than the example deck.

## Phones

The speaker asked to mind mobile UX (2026-11-12, when approving the plans). People open the published deck from a link on their phones, and the speaker reads the cue sheet on a phone.

- Today the engine already swipes left/right between slides, advances on a tap, and scales the slide to the screen. On a phone held upright the 16:9 slide is a thin strip with unreadably small text, a tap can only go forward, and the fullscreen button only appears on mouse movement (and does not work on iPhones).
- **vjakarta (Part 1), stylesheet only:** on touch screens held upright, a short line under the slide says to turn the phone sideways and swipe to move; the fullscreen button is hidden on touch screens; double-tap zoom does not swallow taps. Desktop looks exactly as before.
- **The kit (Part 2), in the engine:** a tap on the left third goes back, elsewhere forward; a phone held upright gets Back and Next buttons (at least 44 px tall) and a slide counter under the slide; the help overlay lists the touch gestures on touch screens; the generated cue sheet fits a 390 px wide phone with no sideways scrolling, tap targets at least 44 px and body text at least 16 px.
- Checked by running the built deck in headless Chrome emulating a phone (390 × 844 upright, 844 × 390 sideways, touch on).

## Constraints

- Building a deck needs only `node` and `python3`, as today. No `npm install` step.
- The built deck stays one self-contained HTML file that works offline (the talk is live; venue Wi-Fi is not trusted).
- Everything the engine does today keeps working: presenter notes view, timer, footer ruler, scenes, click steps, the phone page, the checks.
- Part 1 must not change any slide's text, numbers, click count, notes or minute marks. All existing vjakarta checks stay green: unit tests (21), `tools/test_series.py`, self-test (38 slides, 102 states), numbers check, code check, fit check with no new spills beyond the four known ones, and the real-time run (`live_run`) matching as before. Every slide stays readable at 1280 × 720 (livestream size).
- Part 1 ends by rebuilding `slides.html` and `index.html` and pushing `main`, which updates the public deck at https://rokon12.github.io/vjakarta/.
- Creating the kit's GitHub repo uses the speaker's keyring `gh` login (`env -u GITHUB_TOKEN gh …`), and the speaker is asked first, as every time.
- Demo-code style rules from the talks (human-looking code, minimal comments) apply to the example scene and any code in the example deck.

## Anti-goals

- Anything that puts the December 1 talk at risk. Part 1 is a theme swap, not a rework.
- The Jakarta EE logo, or yellow outside a logo.
- A kit that needs a framework or package manager to build a deck.
- Losing what the current engine does in exchange for Markdown.
- Touching vfun.

## Calls I made (the speaker can override)

- **Kit name and place:** working name `slidekit`, at `~/projects/slidekit`, GitHub `rokon12/slidekit` marked as a template repo, **private** until the speaker says otherwise.
- **Inter is embedded** in the built deck (it is under the SIL Open Font License, whose text ships next to the font file). This is required, not a nicety: Inter is not installed on the presenting Mac (`fc-match Inter` gives Verdana), and the deck must work offline.
- **Kit default theme:** `jakarta-light`.
- **One Jakarta light theme, shared:** the kit's `jakarta-light` is the same theme vjakarta gets in Part 1 (notebook pieces recolored), not a separate plainer variant. A plainer variant can be added later as a third theme.
- **Part 1 keeps the blueprint look reachable:** the theme swap is done so switching back is a one-line change, in case the speaker changes their mind before December 1.
- **A talk repo looks like vjakarta:** the demo code, the deck sources and the built `index.html` live in one repo. So the kit's files sit in `slides-src/` in the template, not at its root, the built deck goes to the repo root as `index.html` (and the git-ignored `slides.html`), and the rest of the repo is free for demo code.
- **`source:` resolves against the talk's own repo.** It accepts `<tag>:<path>` (as today) and a bare `<path>` (the working tree). The example deck's code slides cite a small example file inside the kit by bare path, so the code check passes in a fresh "Use this template" copy, which has no tags.
- **A `run:` line in the notes is for the presenter view and the phone page only.** The on-screen terminal label the audience sees ("Next · terminal" today) is a separate slide header key with its own "hide after click N" option, because today the two differ (10-switch shows one command and cues another; 38-pinning has a label and no cue).

## Left to the builder

- How Markdown is parsed (a small parser written for the kit, or one vendored single-file library), as long as there is no install step.
- The exact syntax for per-click notes inside the `???` block, and for `tip:`/`more:`/`goal:` lines, as long as every field the current notes use (`say`, `tip`, `run`, `more`, per-slide `goal`) can be expressed and the README documents it.
- Slide-level header keys beyond those above (for example `id`, `title` for navigation, `section`, `min` for minute marks), mirroring today's `data-*` attributes.
- How themes are split into files, and how layouts are styled.
- Which dozen vjakarta slides become the example deck, as long as every layout appears.
- Which small scene is the example.
- How the letterbox, overlays and footer ruler are colored in Jakarta light.

## Done means

- Part 1: the vjakarta deck in Jakarta light, every check above green, readable at 1280 × 720, pushed and live on Pages.
- Part 2: from a fresh copy of the template, adding a slide is a few lines in `deck.md` and one build command; the slide appears with its notes in the presenter view and on the phone page; the example deck builds in both themes and passes the kit's checks.
