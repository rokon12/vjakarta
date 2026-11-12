# Scenes `race` and `compare`: two results told with numbers

Two small scenes in one file pair. Both are about making a measured difference felt.

Files you own: `scenes/race.js`, `scenes/race.css` (register both scenes there),
`slides/08-intro-race.html`, `slides/17-demo1-result.html`.

## Scene `race` (slide `intro-race`, steps 0..2)
1,000 requests, each waits 100 ms on the database, run twice.

- Lane A, "50 platform threads": the 1,000 requests are processed in 20 batches of 50, one batch
  every 100 ms. Finishes at 2,084 ms.
- Lane B, "one virtual thread each": all 1,000 wait at the same time. Finishes at 114 ms.

Show all 1,000 requests in each lane (for example a 50 x 20 grid of cells) so the batches are
visible, plus a clock per lane that counts milliseconds.

- Step 0: both lanes idle, everything labelled, clocks at 0.
- Step 1: run it IN REAL TIME. Lane B is done in a blink while lane A grinds through its batches
  for two seconds. That contrast is the whole point, so do not slow it down or speed it up. The
  clocks stop on exactly 2,084 ms and 114 ms. Replay must work (the engine's R key calls
  `setStep(1, true, 0)` again).
- Step 2: both finished (same picture as the end of step 1). The host slide reveals the line
  "Every request still waits 100 ms. We stopped queueing for a thread." Make sure each cell in
  lane A visibly spent only 100 ms being served: the time went into waiting for a turn.

## Scene `compare` (slide `demo1-result`, steps 0..2)
Before and after for demo 1, out of the same 1,809 requests.

| | no limit | limit of 32 |
|---|---|---|
| answered within 500 ms | 1,077 | 1,518 |
| late | 732 | 0 |
| rejected at once | 0 | 291 |

- Step 0: the "no limit" result only.
- Step 1: the "limit of 32" result arrives next to it; bars or blocks grow and numbers count up.
- Step 2: emphasise the trade: 291 turned away at once, 441 more answered on time, nobody late.
  The host slide carries the headline "Saying no to 291 people got 440 more a fast yes."

Bars must be drawn to one scale (the same number of pixels per request in both columns) so the
picture is honest. A zero must look like a zero, not like a missing value.

## Notes
- In still mode, steps 1 and 2 of `race` show the finished state with both final times.
- These are numbers the audience has just watched appear in the terminal. They must match.
