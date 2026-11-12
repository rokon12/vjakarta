# Numbers and facts (single source of truth for the slides)

Every number on a slide comes from this sheet. All were measured on the speaker's Mac with the code at the named tag; `docs/spike-results.md` has every run. Never round differently or "improve" a number. Where a range is given, it is three runs.

## The service

- One reservation holds 4 seats and charges one card, all five at once.
- A seat hold is one insert that takes about 10 ms (`pg_sleep`, said out loud).
- The payment provider takes 50 ms a charge and handles 20 at a time; above that it answers 429.
- 20 database connections. `@Retry` on the payment with the MicroProfile defaults (3 retries).
- `before`: one managed executor, `maxAsync = 16`, platform threads. By arithmetic it finishes about 150 reservations a second (16 slots, about 107 ms of work per reservation).
- An answer after more than 500 ms is late.

## The load

- Normal traffic: 60 reservations a second for 30 s.
- Small sale: +120 a second for 6 s, from second 10.
- Big sale: +640 a second for 3 s, from second 10. That is 700 a second.

## Small sale

| | p50 | p99 | on time | late | failed |
|---|---|---|---|---|---|
| `before` | 54 ms | 1,018 ms (1,018–1,178) | 1,803 | 719 | 0 |
| `switched` | 51 ms | 72 ms (58–86) | 2,522 | 0 | 0 |

The line: "Same sale. A second at p99 on sixteen threads, seventy milliseconds on virtual threads."

## Big sale

| | p50 | p99 | on time | late | failed | in flight max | retries | waited for a connection | provider refused |
|---|---|---|---|---|---|---|---|---|---|
| `switched` | 544 ms | 2,325 ms (2,325–3,741) | 1,651 | 1,132 | 939 | 829 | 4,000 | 9,061 | 4,939 |
| door only | 52 ms | 196 ms | 2,744 | 1 | 50 | 24 | 243 | 3,918 | 293 |
| `budgeted` | 52 ms | 114 ms (84–397) | 2,731 | 0 | 0 | 24 | 0 | 0 | 0 |
| `before` | 4,682 ms | 11,697 ms | 688 | 3,033 | 0 | 1,560 | 0 | 0 | 0 |

- `switched` at the big sale: p99 in the three sale seconds 865, 1,609, 2,350 ms; back to 59 ms four seconds after the sale.
- `budgeted` turned away 991 people at once (503). "Saying no to 991 people got 1,080 more a fast yes, and nobody's payment failed." (2,731 − 1,651 = 1,080.)
- `before` is worse than `switched` at the big sale. Say so.
- The door: 24 in flight. Budgets: seat holds 20 at a time (the pool), payments 20 at a time (the provider).

## Deadlines (`deadlines` tag, provider at 1,800 ms, one request)

- Deadline only:
  `1 ms charging card` / `507 ms timed out, customer told to try again` / `1850 ms card charged`
- Plus `cancel(true)`:
  `1 ms charging card` / `506 ms timed out, customer told to try again` / `507 ms payment call cancelled`, and the provider charged the card anyway.
- No idempotency key, the customer retries 2.5 s later: two 504s, 2 charges, 8 seat holds in 2 reservations.
- With the key: attempt 1 gets 504 after 0.52 s; attempt 2 gets 201 after 0.026 s; the provider charged once and answered "already charged" once; 4 seat holds.
- `deadlines` under the big sale: p99 92 ms, 2,706 on time, 1,015 turned away, nothing failed.

## Versions

- Java 25 (virtual threads need Java 21 or later), Jakarta EE 11, Jakarta Concurrency 3.1, Open Liberty 26.0.0.11, MicroProfile Fault Tolerance 4.1, k6 1.6.1.

## How the door and the budgets were sized

- The provider charges 20 cards at a time in about 55 ms each (50 ms plus the call), so about 360 a second.
- A reservation takes about 52 ms (p50), so at full speed about 19 are inside (360 × 0.052).
- The door is 24, to leave room for bursts.
- Seat holds: 20 at a time, because the pool has 20 connections. Payments: 20 at a time, because the provider takes 20.

## Per-second series for the charts

`docs/series/*.json` (one object per second: requests, p50, p99 of the requests let in, and counts of 201, 503 and other): `before-small`, `switched-small`, `switched-big`, `budgeted-big`, `before-big`, `deadlines-big`.

## Recorded fallbacks

k6 dashboard reports in `results/` (not in git): `before-small-7.html`, `switched-small-7.html`, `switched-big-1.html`, `budgets-big-1.html`, `deadlines-big-1.html`.

## Vocabulary

- "in flight" = reservations inside the service.
- "turned away" = 503 at the door. "failed" = the payment failed after the retries ran out (502).

## Reused from vfun (plain Java, measured for the vfun talk)

These are vfun's numbers, copied verbatim from its `_numbers.md`. Label them "plain Java" on screen.

### Warm-up (`./run.sh intro`)
- 1,000 requests, each waits 100 ms on the database.
- 50 platform threads: 2,084 ms. That is 20 batches of 50.
- One virtual thread per request: 114 ms.

### Pinning probe (backup slide)
- Pinning probe: 20 tasks on 2 carrier threads, each sleeps 100 ms inside its own `synchronized` block.
  JDK 21: 1,037 ms (the carrier is pinned, so 2 at a time, 10 rounds). JDK 25: 108 ms.
  Fixed by JEP 491 in JDK 24.

### Structured concurrency (the `scope` slide)
- Structured, `StructuredTaskScope` with `withTimeout(Duration.ofMillis(200))` (preview API in JDK 25, JEP 505):
  3 ms charging card / 207 ms payment cancelled / 208 ms timed out, customer told to try again / 208 ms handler returned
  The order is the point: the payment is cancelled before the timeout is reported.
