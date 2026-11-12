# Virtual threads removed the thread limit. What breaks next in Jakarta EE?

A seat-reservation service on Open Liberty that gets faster when it moves to virtual threads, then falls over at a big flash sale, then holds up once its limits are written down.

Java 25, Open Liberty 26.0.0.11, PostgreSQL 16 in Docker, k6.

## Start it

    ./run.sh db          # PostgreSQL in Docker, port 5432
    ./run.sh provider    # the payment provider: 20 charges at a time, 50 ms each
    ./run.sh app         # Liberty in dev mode, port 9080

Then in another terminal `./run.sh watch` prints in flight, connection waits, retries and refusals once a second.

## Run order

| | Command | What to look at |
|---|---|---|
| 1 | `./run.sh state before` then `./run.sh load before small` | 16 platform threads: p99 about a second during the small sale |
| 2 | `./run.sh state switched` then `./run.sh load switched small` | One line changed, `virtual = true`: p99 about 70 ms |
| 3 | `./run.sh load switched big` | 700 a second: p99 in seconds, payments fail, retries pile on, hundreds in flight |
| 4 | `./run.sh state budgeted` then `./run.sh load budgeted big` | A door of 24 and a budget per dependency: p99 about 100 ms, nobody's payment fails, the rest are told to try again at once |
| 5 | `./run.sh state deadlines`, `MILLIS=1800 ./run.sh provider`, then send one request | A 500 ms deadline, `cancel(true)`, and an idempotency key so a retry does not charge the card twice |

`./run.sh reset` empties the seat holds between runs. `./run.sh state main` goes back to the latest code. Each load run saves a k6 report in `results/`.

The numbers the slides quote are in `docs/numbers.md`.
