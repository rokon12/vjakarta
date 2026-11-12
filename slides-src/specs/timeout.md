# Scene `timeout`: the customer left, the work stayed

One timeline, two modes, two slides. The log lines and timestamps are real output from the
Liberty app's `leak` and `cancel` tags (see `_numbers.md`); show them as they were logged.

Files you own: `scenes/timeout.js`, `scenes/timeout.css`, `slides/27-leak.html`,
`slides/29-cancel.html`.

## The picture

- A time axis from 0 to 2,000 ms with the 500 ms deadline marked.
- Two lanes: the caller (the request, answered at the deadline) and the payment task.
- Events as they happen, labelled with the exact log text and timestamp.
- Play in real time.

## Mode `leak` (slide `leak`, steps 0..2)

`orTimeout(500)` and nothing else.
- Step 0: play. 1 ms "charging card". At 507 ms the caller stops waiting and the customer gets
  504: "timed out, customer told to try again". The payment keeps going, alone, to 1,850 ms:
  "card charged". The stretch from 507 to 1,850 ms is the loudest thing on the slide.
- Step 1: the customer presses retry: a second, fainter task after the timeout (no invented
  timestamps).
- Step 2: hold; the host slide reveals the caption.

## Mode `cancel` (slide `cancel`, steps 0..1)

The same code plus `part.cancel(true)` on every part at the deadline.
- Step 0: play. 1 ms "charging card", 506 ms "timed out, customer told to try again", then the
  interrupt travels to the task: 507 ms "payment call cancelled". The leak run's long bar stays
  as a faint ghost.
- Step 1: a third track, the provider, draws its charge running on to about 1,800 ms (the
  provider's configured time; the app did not log it) and ends in "card charged", with the note
  "it already had the request". The host slide reveals "Cancel stops your call. It does not
  un-send the charge."
