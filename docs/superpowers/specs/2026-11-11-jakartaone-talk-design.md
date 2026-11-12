# JakartaOne talk: design

**Talk:** Virtual Threads Removed the Thread Limit. What Breaks Next in Jakarta EE?
**Where and when:** JakartaOne, December 1, 2026, 45 minutes.
**What gets built:** a slide deck built the same way as the speaker's previous talk (vfun), and a Jakarta EE demo app that is migrated to virtual threads, broken and fixed during the talk.

Earlier work this reuses: `/Users/bazlur/projects/vfun` (Java demos in `src/`, deck sources in `slides-src/`, measured numbers in `slides-src/specs/_numbers.md`, deck published at https://rokon12.github.io/vfun/).

## Intent

Virtual threads make blocking cheap, so a Jakarta EE service can start thousands of concurrent operations. Its limits are still there: twenty database connections, a downstream API with a rate limit, finite memory and transaction throughput. The old platform-thread pool was quietly keeping load under those limits. Virtual threads remove that pool, nothing replaces it, and the service fails faster than before.

The vfun talk made this point with plain Java. This talk makes it in the stack this audience runs: a Jakarta EE service with a managed executor, a connection pool and a downstream API. It then rebuilds the service with its limits written down ("explicit concurrency budgets").

The closing line of the submitted abstract: Rather than asking "How many tasks can I start?" ask "How much concurrent work can the entire system safely carry out?" (A reworded version was suggested; see open questions.)

## Audience and setting

- Said by the speaker: JakartaOne, a mixed audience, mostly people who care about Jakarta EE. 45-minute slot. The session is live, not pre-recorded.
- Guessed: JakartaOne is a livestream. Viewers see a screen share, ask questions in chat, and the session is recorded. Many viewers know what virtual threads are but have not migrated yet. The exact time slot is still to be confirmed with the organizers; it only affects rehearsal timing.

## Goals

1. **The climax** (the speaker's words): p99 latency exploding right after switching to virtual threads, on screen.
2. Viewers understand why it exploded: the thread pool was the limit, and it is gone.
3. Viewers leave with a method they can use on Monday: a budget per dependency, refusing work early, timeouts and cancellation, and the few metrics that warn before collapse.
4. Reuse as much of the vfun talk as possible (the speaker's instruction).

## Non-goals

- Teaching virtual threads from scratch. The basics get at most three slides.
- Comparing application servers.
- Locks and pinning. vfun's demo 2 is dropped; its pinning slide is kept only as a backup slide for Q&A.
- Production-quality application code. This is a demo.

## Anti-goals (failure even if everything technically works)

- The talk comes across as "virtual threads are bad". The message is that virtual threads are fine and the limits were never written down.
- The failure looks rigged. Every limit in the setup must be one real services have: a pool of 20 connections, a provider with a rate limit, a retry policy, the server's default connection timeout. Simulated latency (a sleep in SQL or in the fake provider) is said out loud, as vfun did.
- A vendor pitch. The runtime is named once. Code uses Jakarta and MicroProfile APIs, and MicroProfile is called MicroProfile, not Jakarta EE.
- A live step that cannot recover. Every live step has a recorded fallback.

## Constraints

- 20 days: today is November 11, the talk is December 1.
- The speaker's Mac: JDK 25 (`25-tem` via sdkman), Maven, Docker 28, k6 1.6.1, the `postgres:16-alpine` image are already installed.
- Code style (the speaker's standing preference): code that looks written by a person, minimal comments, no banner or Javadoc headers, no defensive code the demo does not need, JDK 25 idioms, `IO.println` and instance `void main()` in any plain-Java program.
- The deck uses the vfun engine as-is: one self-contained HTML file that runs offline, the same macOS fonts (DIN Condensed, DIN Alternate, Bradley Hand), the same tools.
- Keep multi-agent fan-outs small. A large one exhausted the usage limit mid-task before the vfun talk.
- Creating a GitHub repository or Pages site needs the speaker's keyring `gh` login (`env -u GITHUB_TOKEN gh …`) and the speaker's permission each time.

## Decided by the speaker

- Deliverables: a deck like vfun's plus a demo app.
- The climax: p99 exploding after the switch.
- Reuse as much as possible. The reuse map in "The deck" below was approved ("sounds like a plan").
- The runtime choice was handed to the designer.
- The session is live, not pre-recorded.

## Designer's calls (not individually approved by the speaker)

- **Runtime: Open Liberty 26.0.0.11 on Java 25.** It is certified for the full Jakarta EE 11 platform, so it has Concurrency 3.1, where `virtual = true` on `@ManagedExecutorDefinition` lives. It ships MicroProfile Fault Tolerance (`@Bulkhead`, `@Timeout`, `@Retry`) and metrics in the same server. `liberty:dev` reloads on save, so a change made live shows up seconds later. Java 25 is supported since 25.0.0.10. WildFly is certified only for EE 11 Core Profile, which has no Concurrency; GlassFish 8 has no Fault Tolerance.
- **Project location:** a new folder, `/Users/bazlur/projects/vjakarta`. vfun stays untouched; it is published.
- **Domain:** the same seat-reservation service and payment provider as vfun, so vfun's scenes, wording and vocabulary carry over ("in flight", "the door").
- **Database:** PostgreSQL 16 in Docker.
- **Payment provider:** a separate small process (a single plain-Java file using the JDK's HTTP server) with a fixed response time and a fixed capacity. Above capacity it answers 429.
- **Load:** k6 with an open model (arrival rate, not virtual users), so arrivals do not slow down when the service does. A closed model (fixed virtual users) would hide the p99 explosion and would be dishonest.
- **The trigger: two flash sales.** (Decided by the speaker on November 11, after the spike.) The spike showed that, honestly, the switch makes the service *better* at a sale the old pool could barely take: the pool of 16 was the real bottleneck and the database and the provider had room to spare. So the story follows the abstract's own arc, "faster first, then it breaks": a **small sale** that `before` struggles with and `switched` handles easily, then the **big sale** (the launch) where `switched` breaks. The p99 explosion is compared with `switched` at the small sale a minute earlier, not with `before`. On stage, say plainly that `before` would have been even worse at the big sale. See `docs/spike-results.md`.
- **Live view of p99:** k6's built-in web dashboard during live runs. The deck's charts are drawn from recorded runs. No Grafana or Prometheus stack.
- The running order and the schedule below.

## The demo app

### Shape

- `POST /reservations` (Jakarta REST). One request reserves seats for a group. It fans out in parallel on a managed executor: seat holds in the database and a payment call to the provider. It answers when all parts are done.
- The executor is defined with `@ManagedExecutorDefinition`.
- The data source is PostgreSQL with Liberty's connection pool set to 20 connections. The connection wait timeout stays at Liberty's default in the "before" and "switched" states. (Liberty's default is believed to be 30 seconds; verify.)
- The provider client carries a retry policy (`@Retry`, a few retries, no jitter). In the "before" state the provider never refuses, so the policy never fires. It was there all along.
- Liberty's HTTP request threads must not become a hidden limit that masks the switch. Either the resource method is asynchronous (returns a `CompletionStage`) so request threads are released, or the spike shows that Liberty's request threads do not cap concurrency at the test load.

### Four states, one git tag each

1. **`before`:** platform threads, with `maxAsync = 16` on the executor ("sized to 16 years ago"). Healthy at normal traffic; at the small sale its queue grows and p99 rises to around a second.
2. **`switched`:** the migration as a team following the usual advice ("never pool virtual threads") would do it: `virtual = true`, `maxAsync` removed. The diff shown on screen is one line. At the small sale p99 stays near normal: virtual threads delivered. At the big sale p99 explodes: hundreds of requests in flight wait for connections, the provider answers 429, retries pile on, and payments fail.
3. **`budgeted`:** the limits written down.
   - Admission control at the door: a limit on requests in flight; anything above it is refused at once with 503 and `Retry-After`. This is vfun's "door".
   - A budget per dependency: `maxAsync` comes back with a number derived from the dependencies. It is the same attribute, but now it is a budget, not a thread count. Fan-out per request is bounded. `@Bulkhead` on the provider client matches the provider's capacity.
   - Retries: fewer, with backoff and jitter, only on 429, so retries cannot multiply load.

   Each fix should exist as its own small diff so the deck can show them in order. The live demo may apply them in one or two steps. p99 must recover in this state without help from the timeouts in state 4, because the live run at minute 32 comes before the timeouts section. If recovery turns out to need the short connection wait timeout, move that one setting into this state and explain it here.
4. **`deadlines`:** timeouts and cancellation (designer's call to split this from `budgeted`, so the running order matches the tags). A request deadline in the app: the caller is answered at the deadline, and in the leak version the payment still completes afterwards. Then `Future.cancel(true)` on the managed executor's tasks and `@Timeout` on the provider call, plus a short connection wait timeout. Not run live; the timeout scene replays log lines measured from this state.

### What the numbers must show

The builder tunes the numbers (arrival rate, latencies, limits, fan-out width) and records them. The constraints:

- Two loads, the same in every state: normal traffic plus the small sale, and normal traffic plus the big sale.
- Outside the sales, every state is healthy.
- `before`: at the small sale p99 rises to around a second and recovers soon after; no 429s, no retries. At the big sale it is far worse than `switched`; measure it once so the speaker can say so.
- `switched`: at the small sale p99 near normal, no failed payments. At the big sale p99 at least ten times its small-sale p99, ideally seconds, with connection waits, 429s, retries and failed payments visible.
- `budgeted`: at the small sale as good as `switched`. At the big sale refusals (503) only during the sale, quick, counted and shown; p99 of admitted requests low throughout and normal as soon as the sale ends; no failed payments; more requests answered on time than `switched` (vfun's "saying no to 291 people got 440 more a fast yes" pattern).
- Reproducible run to run on the speaker's Mac. One run fits in 60 seconds on stage; 30 is better.
- Every number goes into `slides-src/specs/_numbers.md` as in vfun. Slides quote only measured numbers.

### Metrics

Exposed by the app and shown live with one terminal command next to the k6 dashboard: requests in flight, connection-pool wait time and connections in use, provider 429s, retries, bulkhead rejections, and p50/p99 from k6. The deck's "what to watch" slide names four or five of these as the ones that warn before collapse.

### Running it

One script, like vfun's `run.sh`, with one short command per step: start the database, start the provider, start the app, run the load, switch states. The builder decides the details.

## The deck

Copy vfun's `slides-src/` into the new project and build the same way (see `slides-src/README.md` in vfun). The approved reuse map, with vfun slide file names:

| vfun | In this talk |
|---|---|
| Engine and tools: `build.mjs`, `core/`, `tools/` (check, screenshots, notes, phone page) | As-is |
| The look: fonts, colors, scene style | As-is |
| Basics: `05-platform`, `06-virtual`, `08-intro-race` (and the scenes behind them) | At most three slides |
| Demo 1: `13-demo1-what` (overload scene), `14-demo1-why`, `16-demo1-door`, `17-demo1-result`, `18-check1` | "Where the queue moved" and admission control. The overload scene keeps its layout and drawing, but its model changes: the trigger becomes the flash sale (an arrival-rate jump) instead of a slow database, with 20 connections and numbers measured from the Liberty app. Check 1 becomes the central takeaway |
| Demo 3: `28-demo3-ask` to `31-demo3-cancel`, `34-demo3-tieback` (timeout scene) | Timeouts and cancellation, in Jakarta form: `Future.cancel` on a managed executor and `@Timeout`. Log lines and numbers re-measured from the app's `deadlines` state |
| Demo 3: `32-demo3-scope`, `33-demo3-order` (structured concurrency) | Kept as "where this is going" (designer's call). Labelled as a JDK 25 preview API, run in plain Java, with vfun's measured numbers. Not run in Liberty. One line may mention that a scope can take a managed thread factory; show code for that only if the builder confirms it works on Liberty |
| Closing: `36-jobs`, `37-checks`, `38-thanks`, `39-links` | Reworded. Same book cover, QR code and social handles; the GitHub plate points at this talk's repo |
| `22-pinning` | Backup slide after the end, for Q&A |
| Demo 2: `19`–`21`, `23`–`26` | Dropped |

New slides and scenes:

- Title and plan.
- The service: request → executor → connection pool → database, and the provider.
- The switch: the one-line diff.
- **The p99 chart**, before vs. switched (and later budgeted), drawn from recorded k6 data and played over time like vfun's traces. Its end frame is the clearest frame of the deck.
- The retry storm: 429s, retries, more load.
- Code slides for admission control, the `maxAsync` budget, the bulkhead, timeouts and retries.
- What to watch: the metrics.

Speaker notes are written in `tools/notes.py` as in vfun, plain English, with a phone run-of-show page published as a private artifact.

## Running order (45 minutes)

| Time | Section | Live or recorded |
|---|---|---|
| 0–3 | Title, the promise, the one-line switch as a teaser | Slides |
| 3–6 | Basics: platform vs. virtual threads, the race | Slides (reused) |
| 6–9 | Meet the service: its shape and numbers; the small sale on platform threads, p99 around a second | Live k6 run |
| 9–15 | **The switch.** One line, reload, the small sale again: fixed. Then the big sale: p99 explodes | Live, recorded fallback |
| 15–21 | Where the queue moved: the overload scene, "why didn't this happen before", the retry storm, the metrics | Slides plus one live metrics command |
| 21–33 | Rebuild with budgets: the door, the `maxAsync` budget and bounded fan-out, the bulkhead, retries. Same load: p99 back down | Slides plus live run, recorded fallback |
| 33–39 | Timeouts and cancellation | Slides (reused timeout scene) |
| 39–42 | What to watch, the checks for Monday | Slides |
| 42–45 | Summary, links, questions | Slides |

## Schedule

| Dates | Milestone |
|---|---|
| Nov 11–14 | Spike: prove the p99 explosion on Liberty, under the flash sale, in `before` vs. `switched`. This is the largest risk; if it does not reproduce honestly, stop and rethink before building anything else |
| Nov 15–19 | The app's three states, the run script, measured numbers |
| Nov 18–25 | The deck: engine copied, reused slides adapted, new scenes, notes |
| Nov 26–28 | Full run-throughs with the streaming software running, fallbacks recorded, fixes |
| Nov 29–30 | Buffer. Publishing, with the speaker's permission |
| Dec 1 | The talk |

## Risks

1. The p99 explosion may not reproduce, or may come from something other than the intended mechanism. For example, Liberty's request threads might cap concurrency, so the switch changes nothing. The spike settles this first.
2. The spec lets vendor configuration override `virtual = true`. Confirm that tasks really run on virtual threads (log `Thread.currentThread().isVirtual()` once).
3. The spec says `maxAsync` bounds concurrently running tasks, not threads, and is independent of `virtual`. Confirm Liberty behaves that way with `virtual = true`.
4. On a livestream, Docker, Liberty, k6 and the streaming software share one laptop. Rehearse with the streaming software running; keep recorded fallbacks.

## Left to the builder

Exact numbers, endpoint and schema details, the REST client used for the provider, the k6 script, fan-out width, the run script, scene implementation, and whether metrics come from MicroProfile Metrics or MicroProfile Telemetry.

## Open questions for the speaker

- The closing line: keep "the entire system safely carry out" (as submitted) or use the suggested "each part of the system safely carry"?
- The exact time slot (organizers). Only affects rehearsal timing.
- Publishing: a new public GitHub repo and Pages site for this talk?
