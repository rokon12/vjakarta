# Scene `timeout`: the caller left, the work stayed

One timeline, three modes, three slides. The log lines and timestamps are real output from the
Java demos (see `_numbers.md`); show them as they were printed.

Files you own: `scenes/timeout.js`, `scenes/timeout.css`, `slides/29-demo3-leak.html`,
`slides/31-demo3-cancel.html`, `slides/33-demo3-order.html`.

## The picture
- A time axis from 0 to 2,000 ms with the 200 ms deadline clearly marked.
- Two tracks: the caller (the request handler) and the payment task (its own virtual thread).
- Events as they happen, labelled with the exact log text and timestamp.
- Play IN REAL TIME: the leak takes 1.8 seconds, and the room should sit through all of it.

## Mode `leak` (slide `demo3-leak`, steps 0..2)
`future.get(200, MILLISECONDS)` and nothing else.
- Step 0: play. 2 ms "charging card". At 205 ms the caller stops waiting: "timed out, customer
  told to try again". The payment task keeps going, alone, all the way to 1,812 ms: "card
  charged". Then 1,812 ms "handler returned": the caller track must show that the handler itself
  was stuck until then, because closing the executor waits for the task.
  The stretch from 205 ms to 1,812 ms is work nobody is waiting for. Make that stretch the loudest
  thing on the slide.
- Step 1: the customer presses retry. Show that a second attempt means a second charge (a second,
  fainter task starting after the timeout is enough; it does not need exact numbers, so do not
  print invented timestamps on it).
- Step 2: hold. The host slide reveals "get(timeout) limits how long the caller waits. It says
  nothing to the task."

## Mode `cancel` (slide `demo3-cancel`, steps 0..1)
The same code plus one line: `reservation.cancel(true)`.
- Step 0: play. 4 ms "charging card", 209 ms "timed out, customer told to try again", then the
  interrupt travels from the caller to the task: 209 ms "payment cancelled", 209 ms "handler
  returned". Keep the leak run's long bar as a faint ghost so the room sees what was saved.
- Step 1: the catch. Show the alternate ending when the task swallows the interrupt: it logs
  "payment cancelled" and then "card charged" at 207 ms. The host slide reveals "Interruption is
  a request. Swallow the exception and the card is charged anyway."

## Mode `structured` (slide `demo3-order`, steps 0..1)
`StructuredTaskScope` with a 200 ms timeout on the scope.
- Step 0: play. Draw the scope as something that encloses both tracks and owns the deadline.
  3 ms "charging card". At the deadline the scope cancels its subtask first: 207 ms "payment
  cancelled". Only then does `join()` throw: 208 ms "timed out, customer told to try again",
  208 ms "handler returned".
- Step 1: emphasise the order, numbered 1, 2, 3: cancelled, then reported, then returned. The
  host slide reveals "The payment is already cancelled when our catch block runs."

## Notes
- Events at 207, 208 and 209 ms are a millisecond apart on a 2,000 ms axis. Their labels will
  collide unless you design for it (stack them, fan them out with leader lines, or add a zoomed
  inset around the deadline). Check this in screenshots.
- "card charged" after a timeout is the alarming event of the whole talk. It should look alarming.
- In still mode every step shows the finished timeline for that step.
