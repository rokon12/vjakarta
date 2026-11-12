# Slide sources

`index.html` in the project root is built from this folder.

    node build.mjs --out ../slides.html
    node tools/check.mjs ../slides.html selftest
    cp ../slides.html ../index.html

`slides.html` is the copy to present from and is not in git. `index.html` is the one GitHub Pages serves.

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
| `tools/live_run.mjs` | Presses the arrow key through the whole deck in real time and compares each state with its still frame |

The screenshot tools expect Chrome in `/Applications`. `node build.mjs --no-notes` builds a copy without the speaker notes.
