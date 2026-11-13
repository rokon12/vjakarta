# Slide sources

`index.html` in the project root is built from this folder, on vfun's engine.

    tools/numbers_sheet.sh                      # after docs/numbers.md changes
    python3 tools/series_data.py                # after docs/series/ changes
    python3 tools/gen_slides.py
    python3 tools/notes.py run-of-show.html
    node build.mjs --out ../slides.html
    node tools/check.mjs ../slides.html selftest
    python3 tools/numbers_check.py ../slides.html specs/_numbers.md
    python3 tools/code_check.py ../slides.html ..
    cp ../slides.html ../index.html

`slides.html` is the copy to present from and is not in git. `index.html` is the one a Pages site would serve.

## What is where

| | |
|---|---|
| `slides/` | One HTML fragment per slide, in order. The text and code slides are written by `tools/gen_slides.py`; the ones that host an animation are edited by hand |
| `scenes/` | The animated diagrams, one script and one stylesheet each |
| `core/` | The engine (`core.js`), the styles, the page shell and the speaker notes as JSON |
| `assets/` | The book cover |
| `specs/` | The measured numbers the slides quote (`_numbers.md`) and the notes each animation was built from |
| `run-of-show.html` | The phone page with the same notes, slide by slide |

## Tools

| | |
|---|---|
| `tools/notes.py` | The speaker notes live here. Running it rewrites `core/notes.json`; pass `run-of-show.html` to rebuild the phone page as well |
| `tools/gen_slides.py` | Rewrites the text and code slides in `slides/` |
| `tools/links_slide.py` | Rewrites the last slide with the cover and the QR code. Needs `pip install segno` |
| `tools/check.mjs` | `selftest` steps through every slide and click and reports script errors; `fitcheck` reports text that spills out of its box |
| `tools/shot.sh` | Screenshots one slide state |
| `tools/shoot_all.mjs` | Screenshots every state |
| `tools/live_run.mjs` | Presses the arrow key through the whole deck in real time and compares each state with its still frame. Give it `11500` ms a state so the p99 charts finish |
| `tools/numbers_check.py` | Lists every number on a slide that `specs/_numbers.md` does not contain |
| `tools/code_check.py` | Checks every line of Java on a slide against the git tag its `data-source` cites; `…` stands for elided text |
| `tools/numbers_sheet.sh` | Rebuilds `specs/_numbers.md` from `../docs/numbers.md` and the vfun numbers this deck reuses |
| `tools/series_data.py` | Writes the measured per-second series from `../docs/series/` into `scenes/p99.js` |
| `tools/style_probe.mjs` | Reads the built deck in headless Chrome: computed `styles` in a state, every `colors` painted, text below readable `contrast`, `fonts`, the phone `page` and a touch `swipe`; `--device phone-upright` or `phone-sideways` emulates a phone |
| `tools/cdp.mjs` | The headless Chrome plumbing `live_run.mjs` and `style_probe.mjs` share |

The screenshot tools expect Chrome in `/Applications`. `node build.mjs --no-notes` builds a copy without the speaker notes.

## Themes

The colors and fonts live in `themes/`, one file per look; `core/theme.css` only uses their variables.

| | |
|---|---|
| `themes/jakarta-light.css` | The default. White paper in the Jakarta EE colors, Inter for the slide text; the notebook pieces (stamps, red pen, taped labels, readouts) recolored. Text inside the diagrams keeps its condensed face |
| `themes/blueprint.css` | The vfun look: graph paper, navy ink, yellow tape |

`node build.mjs --theme blueprint` builds the other look; switching for good is the one line `const DEFAULT_THEME = 'jakarta-light';` in `build.mjs`. A theme can embed a font from `assets/fonts/` with `url("font:<file>")`; the build inlines it, so the deck still works offline. Inter is under the SIL Open Font License, in `assets/fonts/OFL.txt`.

`tools/test_theme.py` pins the Jakarta colors, checks no blueprint navy or yellow is painted in any state and every text run is readable; `tools/test_phone.py` checks the deck on a phone (the hint under an upright slide, no fullscreen button, swiping).

