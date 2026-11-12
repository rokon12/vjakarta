# Numbers and facts (single source of truth)

Every number on a slide must come from this sheet. They were measured on the speaker's laptop
by the real Java demos; the audience will see the same demos run live, so the slides must agree
with them. Never invent, round differently, or "improve" a number.

## Warm-up (`./run.sh intro`)
- 1,000 requests, each waits 100 ms on the database.
- 50 platform threads: 2,084 ms. That is 20 batches of 50.
- One virtual thread per request: 114 ms.

## Demo 1: the database slows down (`./run.sh overload`, then `./run.sh bounded`)
- Traffic: 200 requests a second (one every 5 ms). Connection pool: 8 connections.
- Query: 20 ms normally, so capacity is 400 a second and the service runs at half.
- For three seconds (seconds 3, 4 and 5 of a 9 second run) the query takes 80 ms. Capacity drops to about 100 a second.
- Deadline: an answer after more than 500 ms counts as late.
- Unbounded run, state at the end of each second:

  | second | db query | in flight | slowest answer |
  |---|---|---|---|
  | 1 | 20 ms | 4 | 23 ms |
  | 2 | 20 ms | 4 | 21 ms |
  | 3 | 80 ms | 113 | 531 ms |
  | 4 | 80 ms | 218 | 1,050 ms |
  | 5 | 80 ms | 322 | 1,589 ms |
  | 6 | 20 ms | 187 | 1,632 ms |
  | 7 | 20 ms | 44 | 951 ms |
  | 8 | 20 ms | 4 | 220 ms |
  | 9 | 20 ms | 4 | 21 ms |

  Totals: 1,809 requests. Answered within 500 ms: 1,077. Late: 732. Rejected: 0.
  The line the speaker says: "Slow database for three seconds, slow service for five."
- Bounded run (admission limit of 32 requests in flight = 8 running + 24 waiting):
  in flight stays at 32 while the database is slow and is back to 4 the moment it recovers;
  slowest answer about 335 ms; rejected (cumulative) 81, 186, 290 at the end of seconds 3, 4, 5, final 291.
  Totals: answered within 500 ms: 1,518. Late: 0. Rejected: 291.
- "Saying no to 291 people got 440 more a fast yes." (1,518 - 1,077 = 441.)

## Demo 2: requests run one at a time (`./run.sh wide`, `./run.sh pinning`, `./run.sh narrow`)
- 40 seats, 50 customers arrive at the same moment. Charging the card takes 80 ms.
- Wide lock (card charged while holding the lock): confirmed 40, turned away 10, 3,356 ms. That is 40 x 80 ms, one at a time.
- Narrow lock (lock only around the seat count): confirmed 40, turned away 10, 92 ms. 36 times faster.
- Pinning probe: 20 tasks on 2 carrier threads, each sleeps 100 ms inside its own `synchronized` block.
  JDK 21: 1,037 ms (the carrier is pinned, so 2 at a time, 10 rounds). JDK 25: 108 ms.
  Fixed by JEP 491 in JDK 24.

## Demo 3: work continues after a timeout (`./run.sh leak`, `./run.sh cancel`, `./run.sh structured`)
- The caller waits 200 ms. The payment provider takes 1,800 ms.
- Leak, `future.get(200, MILLISECONDS)`, log lines with their timestamps:
  2 ms charging card / 205 ms timed out, customer told to try again / 1,812 ms card charged / 1,812 ms handler returned
- Cancel, the same plus `reservation.cancel(true)`:
  4 ms charging card / 209 ms timed out, customer told to try again / 209 ms payment cancelled / 209 ms handler returned
- Cancel with `throw e;` deleted (interrupt swallowed), 14 runs: "payment cancelled" and "card charged" land in the same millisecond, 204 to 210 ms. The run shown on the slide:
  4 ms charging card / 209 ms timed out, customer told to try again / 209 ms payment cancelled / 209 ms card charged / 209 ms handler returned
- Structured, `StructuredTaskScope` with `withTimeout(Duration.ofMillis(200))` (preview API in JDK 25, JEP 505):
  3 ms charging card / 207 ms payment cancelled / 208 ms timed out, customer told to try again / 208 ms handler returned
  The order is the point: the payment is cancelled before the timeout is reported.

## Vocabulary
- "in flight" = requests inside the service (running or waiting).
- "carrier" = the platform (OS) thread a virtual thread is mounted on while it runs.
- "parked" = a virtual thread that is waiting; it is unmounted and lives on the heap.
- Use "platform thread" and "virtual thread", never "green thread" or "fiber".
