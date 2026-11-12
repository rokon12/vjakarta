# Spike results

Machine: the speaker's Mac, Java 25, Open Liberty 26.0.0.11, PostgreSQL 16 in Docker, k6 1.6.1.

Settings for every run: 4 seats per request, seat hold `pg_sleep` 10 ms, provider 50 ms and 20 charges at a time, pool of 20 connections, `@Retry` with MicroProfile defaults. Load: 100 requests a second for 30 s, plus the sale on top from second 10 to 13.

## Run 1: `before` (maxAsync = 16), sale +300/s

`requests 3609, p50 5701, p99 8207, on time 751, late 2858, refused 0, failed 0, dropped 293`

The pool of 16 is the bottleneck: about 150 requests a second. A sale of 400/s builds a queue at the executor that takes the rest of the run to drain. A hiccup at second 6, before the sale, already pushed p50 to 1.4 s, because 100/s is two thirds of the capacity. k6 dropped 293 arrivals while it started VUs; preallocation was raised to 2,000 per scenario after this run.

## Run 2: `switched` (virtual = true), same load

`requests 3902, p50 52, p99 248, on time 3803, late 2, refused 0, failed 97, dropped 0`

In flight peaked at 51. The provider refused 857 charges during the sale; 760 retries; 97 requests failed after the retries ran out. p99 during the sale was about 370 ms.

The switch made the service better at this load. The pool of 16 was the real limit, and the database and the provider had room to spare.

## Run 3: `switched`, sale +600/s

`requests 4801, p50 56, p99 1912, on time 2814, late 1033, refused 0, failed 954, dropped 0`

In flight peaked at 786. 12,811 requests queued for a connection (9,211 s of waiting in total); 4,677 retries; 954 failed payments. p99 in seconds 11–13 was 1.3–1.9 s, back to normal 3 s after the sale. `before` would be far worse here: its capacity is about 150/s.

## What this means

With the executor's queue unbounded (what `maxAsync` gives), `before` has less capacity than `switched` at every load. At any load where the switch can hurt, `before` is already queueing harder. No honest knob makes `switched` explode next to a healthy `before`. The structural change the plan allowed (paying while holding a connection) does not change that.

## Decision (the speaker, November 11)

Tell it as "faster first, then it breaks": a small sale that the switch fixes, then the big sale where `switched` breaks. The explosion is compared with `switched` at the small sale, and the speaker says plainly that `before` would be worse at the big sale.

## Chosen settings

Normal traffic 60 requests a second for 30 s. Small sale: +120/s for 6 s from second 10. Big sale: +640/s for 3 s from second 10. Everything else as above (`./run.sh load <name> small|big`).

| run | p50 ms | p99 ms | on time | late | failed | in flight max | retries | connection waits | provider refused |
|---|---|---|---|---|---|---|---|---|---|
| before, small, 1 | 75 | 1,178 | 1,927 | 594 | 0 | 162 | 0 | 0 | 0 |
| before, small, 2 | 54 | 1,018 | 1,803 | 719 | 0 | 164 | 0 | 0 | 0 |
| before, small, 3 | 54 | 1,043 | 1,835 | 686 | 0 | 149 | 0 | 0 | 0 |
| switched, small, 1 | 51 | 72 | 2,522 | 0 | 0 | 9 | 0 | 64 | 0 |
| switched, small, 2 | 51 | 86 | 2,520 | 0 | 2 | 27 | 20 | 278 | 22 |
| switched, small, 3 | 52 | 58 | 2,522 | 0 | 0 | 10 | 0 | 26 | 0 |
| switched, big, 1 | 544 | 2,325 | 1,651 | 1,132 | 939 | 829 | 4,000 | 9,061 | 4,939 |
| switched, big, 2 | 745 | 3,741 | 1,560 | 1,244 | 918 | 1,157 | 3,899 | 9,637 | 4,817 |
| switched, big, 3 | 389 | 2,411 | 1,783 | 1,022 | 916 | 795 | 3,876 | 9,096 | 4,792 |
| before, big, 1 | 4,682 | 11,697 | 688 | 3,033 | 0 | 1,560 | 0 | 0 | 0 |

No run dropped an arrival. `switched` at the small sale occasionally bursts past the provider's 20 (one run in three: 22 refused, 20 retries, 2 failed payments out of 2,522); the retries absorb almost all of it.

At the big sale, p99 in `switched` is 30 to 60 times its small-sale p99, and back to normal 3 to 4 s after the sale ends. Per second, run 1: p99 865, 1,609, 2,350 ms during the sale, then 2,343, 1,479, 616, 59.

## Why p99 explodes at the big sale, in plain English

700 requests a second arrive and nothing makes any of them wait at the door. Each one starts five tasks at once: four seat holds and a payment. The four seat holds need a connection each, and there are 20, so thousands of them queue for a connection (about 9,000 waits per run). The payments go straight to the provider, which can only take 20 at a time; it refuses about 4,800 charges. Each refusal is retried up to three times, so the provider gets even more traffic. About 920 customers end up with a failed payment, and the ones who get through wait seconds for their connections.

## `budgeted`

Built in two commits, measured at both sales after each.

| run | p50 ms | p99 ms | on time | late | refused (503) | failed | in flight max | retries | connection waits | provider refused |
|---|---|---|---|---|---|---|---|---|---|---|
| door only, big | 52 | 196 | 2,744 | 1 | 926 | 50 | 24 | 243 | 3,918 | 293 |
| door only, small | 52 | 67 | 2,521 | 0 | 0 | 0 | 10 | 0 | 39 | 0 |
| door + budgets, big, 1 | 52 | 114 | 2,731 | 0 | 991 | 0 | 24 | 0 | 0 | 0 |
| door + budgets, big, 2 | 52 | 397 | 2,721 | 20 | 980 | 0 | 24 | 0 | 0 | 0 |
| door + budgets, big, 3 | 52 | 84 | 2,752 | 0 | 970 | 0 | 24 | 0 | 0 | 0 |
| door + budgets, small, 1 | 52 | 62 | 2,521 | 0 | 0 | 0 | 11 | 0 | 0 | 0 |
| door + budgets, small, 2 | 51 | 57 | 2,521 | 0 | 0 | 0 | 11 | 0 | 0 | 0 |

At the big sale, compared with `switched`: about 2,730 on time instead of about 1,650, no late answers instead of about 1,130, no failed payments instead of about 920, and about 980 people told "try again" at once. Per second (run 1) p99 stays at 85–91 ms during the sale and is back to 58 ms the second it ends.

Not added, because they would change nothing at this load once the budgets were in: a per-request fan-out limit, `@Bulkhead`, a gentler retry policy.

## `deadlines`: what cancelling does here

Leak version (committed), provider at 1,800 ms a charge, one request:

    1 ms  charging card
  507 ms  timed out, customer told to try again     (the customer got 504 after 0.52 s)
 1850 ms  card charged

Probe (not committed): the same plus `part.cancel(true)` on every part at the deadline.

    0 ms  charging card
  504 ms  timed out, customer told to try again
  510 ms  the payment call fails: ProcessingException ... SocketException: Closed by interrupt

So on Liberty, `cancel(true)` on a managed `CompletableFuture` does interrupt the running task (a plain JDK `CompletableFuture` does not; this is Liberty's behaviour, not the spec's). The virtual thread blocked on the socket is woken and the socket is closed.

But the provider's own log says `1 charged`: it had the request and finished the charge anyway. Cancelling stops our work and frees our connection and executor slot; it does not un-send a request to another service. In vfun the payment was local, so cancelling saved the card. Here the customer is told to try again and has already been charged; a retry charges again unless the provider deduplicates (an idempotency key) or is told the deadline.
