# Scene `overload`: the flash sale, and the door

A live simulation of the reservation service during the big sale, retuned from vfun's version.
Same layout and drawing; a new model. Files you own: `scenes/overload.js`,
`slides/14-flood.html`, `slides/20-door.html`.

## The model (a real simulation, calibrated to the measured run)

- Arrivals at 60 a second, 700 a second from t = 10 s to 13 s (an accumulator, no randomness).
- Each reservation: 4 seat holds through a pool of 20 connections, FIFO, 11.76 ms each
  (10 ms `pg_sleep` plus a calibrated overhead), and 1 payment through a provider of 20 slots,
  55 ms each. A full provider refuses; a refused payment is retried up to 3 times after
  0–200 ms of jitter (`Deck.rng(7)`, repeatable); the fourth refusal fails the reservation.
- In flight: reservations whose holds or payment have not finished. Late: in flight for more
  than 500 ms.
- Door (mode `door`): at most 24 in flight; any other arrival is turned away at once.
- Only measured numbers rest on screen: Retries, Failed and Turned away appear in the summary, with the measured totals, and the provider says "refusing charges" while it refuses rather than a simulated count.
- Calibration: `flood` reads 829 in flight at exactly t = 13.000 s (the measured peak).

## What is shown

Traffic (60 or 700, red during the sale), the door, the pile of reservations in flight (one
token = 4, hollow blue parked, hollow red late), the pool's 20 bars, the provider's 20 cells and
its refusal count, grey tokens bouncing off the door and off the provider, a strip chart of in
flight over 0–18 s with the sale band, and readouts: In flight, Retries, Failed (`flood`) or
Turned away (`door`).

## Modes

- `flood`, steps 0–3: 0 healthy at t = 9 s (ambient flow); 1 the sale plays 9→13 s in real time
  and freezes; 2 recovery plays 13→17 s then the ambient flow holds; 3 summary with the measured
  totals: in flight 829, retries 4,000, failed 939.
- `door`, steps 0–2: 0 healthy with the door; 1 the sale plays and freezes; 2 recovery, then the
  measured door-only totals: in flight 24, retries 243, turned away 926.

Summary readouts use the measured totals, not the simulation's counts.
