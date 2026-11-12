# Scene `overload`: the database slows down (the signature scene of the deck)

A live simulation of the reservation service under load. It appears on three slides with three
`mode` arguments. The audience watches the Java demo print one line a second in the terminal;
this scene is what makes them understand what those lines meant.

Files you own: `scenes/overload.js`, `scenes/overload.css`, `slides/11-demo1-healthy.html`,
`slides/13-demo1-what.html`, `slides/16-demo1-door.html`.

## The model (keep it a real simulation, not a canned animation)
- A request arrives every 5 ms (200 a second).
- 8 database connections. A request that finds none free waits (it is a parked virtual thread).
- A query takes `queryMs` (20 or 80) plus a small fixed overhead. Calibrate the overhead (it is
  close to 4.8 ms) so the simulation reproduces the measured run in `_numbers.md`: in flight
  about 113, 218 and 322 at t = 3, 4 and 5 s, and back to normal just before t = 8 s. Tune it so
  that the frozen frame at exactly t = 5.000 s reads 322 in flight; the speaker quotes that number.
- An answer after more than 500 ms is late.
- Optional admission limit: when 32 requests are in flight, a new arrival is rejected at once.
- The experiment clock runs 0..9 s. Seconds 3, 4 and 5 (t from 2.0 to 5.0) are the slow database.
- Deterministic: fixed arrivals, fixed service times, no randomness in the model. Use a fixed
  time step so that stepping to a given time always gives the same state.

## What must be visible
- Arrivals streaming in from the left at 200 a second.
- The waiting requests as a pile that visibly grows. 322 waiting requests must look like a crowd
  and still be roughly countable (rows of a known size help).
- The pool: 8 slots, each showing its current query in progress.
- The database, showing its current query time (20 ms or 80 ms) and clearly changing state when
  it slows down.
- Live readouts: in flight, slowest answer in the last second, rejected.
- A trace of "in flight" over the 9 seconds of the experiment, drawn as time advances, with the
  slow-database window (seconds 3 to 5) marked on its time axis. This trace is what proves
  "slow for three seconds, slow for five".
- Run the simulation in real time (one simulated second per real second).

## Mode `healthy` (slide `demo1-healthy`, steps 0..1)
- Step 0: steady healthy state, looping for as long as the slide is up: about 4 in flight, pool
  half busy, database at 20 ms. No trace needed here, or keep it flat.
- Step 1: same picture; the host slide reveals "8 connections / 20 ms = 400 a second. We use
  half." If you can, mark the idle half of the pool.

## Mode `replay` (slide `demo1-what`, steps 0..3)
- Step 0: healthy, experiment clock held at t = 2.0 s (the simulation keeps flowing so the slide
  is alive, but the experiment clock and the trace wait).
- Step 1: the database slows to 80 ms. Play t = 2.0 to 5.0 in real time, then FREEZE the whole
  picture at t = 5.0: 322 in flight, slowest answer 1.6 s, rejected 0. The speaker talks over
  this frozen frame, so it must be the clearest frame of the deck.
- Step 2: the database recovers. Play t = 5.0 to 9.0 in real time: the pile drains, in flight is
  back to 4 just before t = 8. Then hold the healthy flow.
- Step 3: summary. Show the totals: answered within 500 ms 1,077, late 732, rejected 0, and mark
  the two spans on the trace: database slow for 3 s, service slow for 5 s.
  Use the measured totals from `_numbers.md` for the summary, not whatever your simulation counted.

## Mode `bounded` (slide `demo1-door`, steps 0..2)
The same service with a door in front: the admission limit of 32.
- Step 0: healthy, the door visible and labelled "at most 32 in flight", clock held at t = 2.0.
- Step 1: the database slows. Play t = 2.0 to 5.0 then freeze: in flight pinned at 32 (8 running,
  24 waiting), every other arrival turned away at the door immediately, rejected counter climbing
  to about 290. Make the turned-away requests visibly leave at once, not wait.
- Step 2: the database recovers. Play t = 5.0 to 9.0: back to normal within a tenth of a second,
  rejected stops at 291. Final readouts: late 0, rejected 291.

## Free play (only if the scripted steps are solid)
Keys while the slide is active: `s` toggles the database between 20 ms and 80 ms without the
script, `a` toggles the admission limit. A step change resets to the scripted state. Return true
from `key()` when you handle one.

## Still mode
When `animate` is false, compute the end state of the step by fast-forwarding the model
synchronously, then render it: step 0 at t = 2.0, step 1 at t = 5.0, step 2 at t = 9.0, including
the trace up to that time. A screenshot of `demo1-what.1` in still mode must show 322 in flight.

## Performance
Up to about 350 tokens on screen at 60 fps on a laptop driving a projector. Do not create and
destroy DOM nodes per request per frame; pool them, or draw on a canvas whose backing store is
twice its CSS size.
