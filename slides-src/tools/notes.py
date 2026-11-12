#!/usr/bin/env python3
"""Speaker notes, one entry per click of every slide.
Writes core/notes.json for the deck and rebuilds the phone cue sheet around the same text."""
import html
import json
import pathlib
import re
import sys

BUILD = pathlib.Path(__file__).resolve().parent.parent
PAGE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None


def S(say, tip=None, run=None, more=None):
    return {'say': say, 'tip': tip, 'run': run, 'more': more}


SEGMENTS = [
    ('opening', 'Opening', 0, 3, 'Ask in chat who runs virtual threads, then promise the arc: faster, then broken, then fixed.'),
    ('primer', 'What a virtual thread is', 3, 6, 'Waiting gets cheap. Nothing gets faster.'),
    ('service', 'The service', 6, 9, 'One reservation, five calls at once, and the limits nobody chose on purpose.'),
    ('switch', 'The switch', 9, 15, 'Virtual threads fix the small sale. The big sale breaks them.'),
    ('moved', 'Where it moved', 15, 21, 'The queue moved from the thread pool to the connection pool and the provider.'),
    ('rebuild', 'The rebuild', 21, 33, 'Write the limits down: a door in front, a budget per dependency.'),
    ('deadlines', 'Deadlines', 33, 39, 'A deadline on the wait does nothing to the work, and cancelling does not un-send a charge.'),
    ('wrap', 'Wrap', 39, 45, 'What to watch, three checks, then questions.'),
]

SLIDES = [
    ('title', 'Title', 0, 'Set the promise: one Jakarta EE service, made faster, then broken, then fixed.', [
        S('“I’m Bazlur. In the next 45 minutes we take one Jakarta EE service, switch it to virtual threads with one line, and watch it get faster. Then we give it a bigger day and watch it break. Then we fix it by writing down limits we never knew we had.”',
          tip='Press T so your real time shows on the ruler. In a second terminal, have ./run.sh db, provider and app already running.'),
    ]),
    ('hands', 'Type in chat', 0.5, 'Find out who runs virtual threads, and plant the question the talk answers.', [
        S('“Quick poll in the chat. Type 1 if you run Java 21 or later in production.”', tip='Give the chat ten seconds. Read a few answers out.'),
        S('“Type 2 if virtual threads are switched on.”'),
        S('“And type 3 if you changed anything else when you switched them on. That last one is this talk.”'),
    ]),
    ('one-line', 'Turning them on is one line', 1, 'Switching them on is trivial. The consequences are not in the diff.', [
        S('“In Jakarta EE 11, Jakarta Concurrency 3.1 lets a managed executor run on virtual threads. It is one attribute: virtual = true.”'),
        S('“Java 21 or later, and a Jakarta EE 11 server with Concurrency 3.1: Web Profile or the full platform. I use Open Liberty today, but nothing here is Liberty-specific until I say so.”'),
        S('“Nothing in this diff looks like a bug in code review. Keep that in mind.”'),
    ]),
    ('plan', 'One service, two sales, one rebuild', 2, 'Give the map of the talk.', [
        S('“The plan. First a small sale: sixteen platform threads struggle, virtual threads fix it.”'),
        S('“Then the launch: a big sale, 700 reservations a second. That is where it breaks.”'),
        S('“Then we rebuild it, writing the limits down.”'),
        S('“And last, deadlines: what happens to the work after the customer gives up.”'),
        S('“Every number you see was measured on this laptop with k6. Nothing is drawn by hand.”'),
    ]),
    ('platform', 'A platform thread is an OS thread', 3, 'Show what a waiting platform thread costs, so the audience sees what virtual threads change.', [
        S('“A platform thread is a thin wrapper around an operating-system thread. One task takes one thread and keeps it until it finishes.”',
          tip='Point at one lane: the request on the left, its work drawn to the right.'),
        S('“The solid part is real work. The hatched part is waiting for the database, and for a typical service that is most of the time. The thread is held the whole time.”',
          more='About a megabyte of stack is reserved per thread. The real cost is that OS threads are limited, so every server caps them.'),
        S('“Because threads are expensive we pool them. In our service the pool is sixteen. Remember that number: it was quietly doing a second job.”'),
    ]),
    ('virtual', 'A virtual thread belongs to the JVM', 4, 'Mount, park, unmount: the one mechanism the rest of the talk relies on.', [
        S('“A virtual thread is a thread the JVM schedules itself. It needs an OS thread, its carrier, only while it is running.”'),
        S('“When it blocks, on a socket, a sleep or a lock, the JVM parks it and the carrier picks up another one. Nobody holds an OS thread while waiting.”'),
        S('“When the answer comes, it mounts again on whichever carrier is free. Your code is still plain blocking code.”'),
        S('“So thousands can wait at once on a few carriers. The advice is: never pool virtual threads. Hold on to that advice. It is about to cost us.”',
          more='JEP 444, final since JDK 21.'),
    ]),
    ('intro-race', 'Nothing got faster', 5, 'The gain is throughput. No single request got faster.', [
        S('“A measurement from my last talk, in plain Java: a thousand requests, each waits 100 ms. Top lane, a pool of 50. Bottom lane, a thread each.”'),
        S('Let it play. “Fifty at a time on top. Everyone else queues for a thread.”'),
        S('“2,084 milliseconds against 114. But every request still waited its 100 ms. Nothing got faster. We stopped queueing for a thread.”'),
    ]),
    ('service', 'One reservation, five calls at once', 6, 'Show the service and every limit in it, before anything breaks.', [
        S('“This is the service. One reservation holds four seats and charges one card, and it does all five at once on a managed executor.”',
          tip='Start ./run.sh watch in the second terminal now if it is not running.'),
        S('“The seat holds go through a pool of 20 database connections, about 10 ms each. The payment goes to a provider that takes 20 charges at a time, 50 ms each. Above 20 it says no: HTTP 429. Two things are simulated, and I want to say so: the 10 ms is a pg_sleep in the query, and the provider is a small fake that sleeps 50 ms. Everything else is real Liberty, real PostgreSQL and real k6.”'),
        S('“The executor has sixteen platform threads. Somebody chose sixteen years ago.”'),
        S('“And the payment call has @Retry on it, the MicroProfile defaults. So far the provider has never said no, so it has never fired.”'),
    ]),
    ('before-run', 'The small sale on sixteen threads', 7.5, 'Run the small sale live on platform threads.', [
        S('“A small sale. 60 reservations a second, then 120 more a second for six seconds.”'),
        S('“Watch p99 on the k6 dashboard.”', run='./run.sh load before small',
          tip='Expect p99 around one second during the sale and about 700 late. If the live run misbehaves, open results/before-small-7.html.'),
    ]),
    ('switch', 'The switch', 9, 'Make the one-line switch live.', [
        S('“So we do what everyone does. We switch to virtual threads.”'),
        S('“And we follow the advice: never pool virtual threads. So maxAsync = 16 goes, and virtual = true comes in.”'),
        S('“Same small sale.”', run='./run.sh load switched small', tip='First ./run.sh state switched; liberty:dev reloads in about a second. Fallback: results/switched-small-7.html.'),
    ]),
    ('small', 'Same sale, virtual threads', 10.5, 'Virtual threads delivered.', [
        S('Plays the platform-thread run. “These charts are the recorded rehearsal runs, so your live numbers just now will be close, not identical. Sixteen threads: p99 a second during the sale. The executor is the queue.”'),
        S('Plays the virtual-thread run over it. “Virtual threads: 72 milliseconds. Same sale. Faster. This is the slide everyone shows.”'),
    ]),
    ('big-ask', 'The launch', 12, 'Set up the climax and ask for a prediction.', [
        S('“Now the launch. 700 a second, for three seconds. The same service, the same switch.”'),
        S('“What happens to p99? Type your guess in the chat.”', run='./run.sh load switched big',
          tip='Watch the second terminal: in flight climbs into the hundreds, retries pour in. Fallback: results/switched-big-1.html.'),
    ]),
    ('big', 'The launch: 700 a second', 13, 'The climax: p99 explodes.', [
        S('“The small sale, faint, for reference.”'),
        S('Plays the big sale and freezes. “p99: 2,325 milliseconds. 939 payments failed. 829 reservations in flight at once. Nothing crashed. No exception you would notice. It just stopped working for a thousand people.”',
          tip='Stop talking for two seconds after the freeze.',
          more='Across three runs p99 was 2.3 to 3.7 seconds. Quote the run on screen.'),
    ]),
    ('flood', 'Where the queue moved', 15, 'Make the invisible queue visible.', [
        S('“The same sale as a picture. This is a simulation, calibrated to the recorded run: it reads 829 in flight at the same moment the real run did. Traffic on the left, the reservations in flight in the middle, the 20 connections, the provider.”'),
        S('Plays three seconds, then freezes. “700 a second. Nothing makes anyone wait at the door, so they all go straight to the pool and the provider. 829 in flight. The red ones have already missed half a second. The provider is full and refusing charges.”'),
        S('Plays on. “When the sale ends it drains in about three seconds.”'),
        S('“The totals: 939 payments failed, 4,000 retries, and 9,061 seat holds had to queue for a connection.”'),
    ]),
    ('why', 'Sixteen threads were your limit', 17, 'Explain why this never happened before the switch.', [
        S('“Why didn’t this happen before? Sixteen platform threads meant at most sixteen seat holds and payments at once. Nobody designed that as protection. It was an accident, but it was a limit.”'),
        S('“With virtual threads every reservation starts all five calls at once. Parked threads are almost free, so nothing pushes back.”'),
        S('“The limit moved to the 20 connections and the provider. 829 reservations in flight, waiting on one or the other.”'),
        S('“Sixteen protected the database and the provider. Nobody wrote it down. And to be fair: sixteen threads would have been worse at this sale, p99 11.7 seconds. They failed slowly, in their own queue, where you could see it.”'),
    ]),
    ('storm', '@Retry was always there', 18.5, 'Show the retry storm.', [
        S('“The provider takes 20 at a time. It refused 4,939 charges.”'),
        S('“Each refusal was retried, up to three times. 4,000 retries, each one more load on a provider that was already full.”'),
        S('“And 939 customers had their payment fail anyway.”'),
        S('“That @Retry was always in the code. It never fired before the switch, because sixteen threads never sent more than the provider could take.”'),
    ]),
    ('check1', 'Check 1', 20, 'First take-home question.', [
        S('“First check to take home.” Read it out. “If the honest answer used to be ‘the thread pool’, that limit is gone the day you switch.”'),
    ]),
    ('rebuild', 'The rebuild', 21, 'Open part two.', [
        S('“So we rebuild it. Not by going back to sixteen threads. By writing the limits down: a door in front, and a budget behind it for each dependency.”'),
    ]),
    ('door-code', 'A door: at most 24 inside', 21.5, 'Admission control in a Jakarta REST filter.', [
        S('“The door is a Jakarta REST request filter with a semaphore.”'),
        S('“The limit comes from config: 24.”'),
        S('“tryAcquire, not acquire. If there is no room we don’t queue at the door, we answer 503 with Retry-After at once.”'),
        S('“And the response filter hands the permit back on the way out.”'),
        S('“Why 24? The provider does about 360 charges a second, and a reservation takes about 52 ms. Little’s law: 360 times 0.052 is about 19 inside at full speed. 24 leaves room for bursts.”'),
    ]),
    ('door', 'The same sale, with a door', 24, 'The door survives the big sale.', [
        S('“The same simulation, with the door.”'),
        S('Plays three seconds, then freezes. “In flight climbs to 24 and stops. Everyone else is turned away at once.”'),
        S('“926 told to try again at once, never more than 24 inside. But 24 is more than the provider’s 20, so 50 payments still failed. That is the next fix.”'),
    ]),
    ('budgets-code', 'maxAsync is back, as a budget', 26, 'The same attribute, now a budget per dependency.', [
        S('“Behind the door, one executor per dependency.”'),
        S('“Seat holds get maxAsync = 20, because the pool has 20 connections.”'),
        S('“Payments get maxAsync = 20, because the provider takes 20 at a time. Work past the budget waits in our executor, not as a 429.”'),
        S('“It is the same attribute we deleted. Now it is a budget, not a thread count. Virtual threads stay on.”', run='./run.sh state budgeted',
          more='@Bulkhead(20) from MicroProfile Fault Tolerance is another way to write the payment budget.'),
    ]),
    ('rebuilt', 'The same launch, limits written down', 28.5, 'The rebuilt service at the big sale.', [
        S('“The same launch. The broken run, faint.”', run='./run.sh load budgeted big',
          tip='Fallback: results/budgets-big-1.html.'),
        S('Plays the rebuilt run. “p99: 114 milliseconds. The grey columns are the people told to try again: 991. And not one payment failed.”'),
    ]),
    ('result', 'Saying no to 991 people', 30.5, 'Refusing some got more served on time.', [
        S('“Saying no to 991 people got 1,080 more a fast yes.”', more='2,731 on time rebuilt, against 1,651 switched.'),
        S('“And nobody’s payment failed. A fast no beats a slow yes and a failed charge.”'),
    ]),
    ('check2', 'Check 2', 32, 'Second take-home question.', [
        S('“Second check.” Read it out. “Sixteen was a number left over from a thread pool. Twenty and twenty came from the dependencies.”'),
    ]),
    ('deadlines', 'Deadlines', 33, 'Open part three.', [
        S('“Part three. The provider has a bad day: 1,800 ms a charge. The customer waits 500.”'),
    ]),
    ('deadline-code', 'We answer at 500 ms', 33.5, 'Show the deadline everyone writes.', [
        S('“orTimeout on the combined future. At 500 ms the customer gets a 504 and a message to try again.”'),
        S('“What happens to the payment?”'),
    ]),
    ('leak', 'We said it failed. Then we charged.', 34.5, 'The customer left. The work stayed.', [
        S('Plays in real time. Stay silent until it stops. “At 507 ms we told the customer it failed. At 1,850 ms we charged the card.”'),
        S('“And the customer presses retry. That is a second charge on its way.”'),
        S('“orTimeout limits how long the customer waits. It says nothing to the work.”'),
    ]),
    ('cancel-code', 'The fix: cancel the work', 35.5, 'Cancel every part at the deadline.', [
        S('“The fix: when the deadline fires, cancel every part.”'),
        S('“One line: part.cancel(true).”'),
        S('“A detail worth knowing: on Liberty, cancel(true) on a managed CompletableFuture interrupts the task. On a plain JDK CompletableFuture it does nothing to the running task.”'),
    ]),
    ('cancel', 'Cancelled at 507 ms', 36, 'Cancel stops your call, not the charge.', [
        S('Plays. “Timed out at 506, payment call cancelled at 507. The last run’s long bar is the ghost.”'),
        S('“But look at the provider. It already had the request, and it charged the card anyway. Cancel stops your call. It does not un-send the charge.”',
          more='Measured: with cancel, the provider still logged one charge.'),
    ]),
    ('key', 'Charge each reservation once', 37, 'Idempotency keys make the retry safe.', [
        S('“So the retry has to be safe. The customer sends an Idempotency-Key, and we pass it to the provider.”'),
        S('“Without a key the retry is a new reservation: two charges, eight seat holds. With the key the retry finds the first charge: 201 in 26 milliseconds, four seat holds.”'),
        S('“Charged once.”'),
    ]),
    ('scope', 'Where this is going', 38, 'Structured concurrency owns the deadline.', [
        S('“Where this is going: structured concurrency. The scope owns the deadline, and nothing leaves the scope while its work runs.”'),
        S('“It is a preview in JDK 25, and this is plain Java from my last talk, not Liberty yet.”'),
        S('“Cancelled at 207, reported at 208: the work stops before the customer is told.”'),
    ]),
    ('check3', 'Check 3', 38.5, 'Third take-home question.', [
        S('“Third check.” Read it out.'),
    ]),
    ('watch-list', 'What to watch', 39, 'The metrics that warn before collapse.', [
        S('“What to watch. Requests in flight: 829 at the big sale, 24 behind the door.”'),
        S('“Waits for a connection. Liberty publishes it as a connection-pool metric.”'),
        S('“Retries. Each one is more load.”'),
        S('“Refusals: the 429s you get and the 503s you give. The first is a warning, the second is your protection working.”'),
        S('“And p99 second by second. An average over the run hides a sale.”'),
    ]),
    ('checks', 'Three checks to take home', 40.5, 'Leave them with something to do on Monday.', [
        S('“Three checks for Monday.” Read them. Leave the slide up for a moment.'),
    ]),
    ('jobs', 'Threads got free. Nothing else did.', 41.5, 'The whole talk in one slide.', [
        S('“Threads got free. Nothing else did. Sixteen threads were doing three jobs nobody gave them.”'),
        S('“Keeping the database under its 20 connections.”'),
        S('“Keeping the provider under its limit, so @Retry never fired.”'),
        S('“Being the one number in the system that said ‘enough’.”'),
        S('“Those jobs are yours now.”'),
    ]),
    ('thanks', 'Thank you', 42.5, 'Close, point at the code, open the floor.', [
        S('“Thank you. The code is on GitHub, and ./run.sh state before, switched, budgeted, deadlines puts every version in front of you.”'),
    ]),
    ('links', 'The long version', 43, 'Leave this up during questions.', [
        S('“If you want the long version, it is in the book. The QR code goes there.” Then take questions from the chat.'),
    ]),
    ('pinning', 'Is that pinning?', 45, 'Backup for questions: pinning was a different problem, and it is fixed.', [
        S('The top chart plays. “Pinning was this: on JDK 21 a virtual thread waiting inside synchronized held its carrier. Twenty tasks, two carriers, a full second.”'),
        S('The lower chart plays. “JDK 24 fixed it in JEP 491. The same code on JDK 25: about a tenth of a second.”'),
        S('“So pinning is fixed, and it is not why our service broke at the big sale. Pinning was the JVM’s problem. The limits are ours.”'),
    ]),
]

(BUILD / 'core' / 'notes.json').write_text(json.dumps(
    {sid: {'goal': goal, 'clicks': steps} for sid, _, _, goal, steps in SLIDES}, ensure_ascii=False, indent=1))
words = sum(len(' '.join(filter(None, s.values())).split()) for slide in SLIDES for s in slide[4])
print(f'notes for {len(SLIDES)} slides, {sum(len(s[4]) for s in SLIDES)} clicks, about {words} words')

if not PAGE:
    sys.exit()


def clock(minutes):
    return f'{int(minutes) // 60}:{int(minutes) % 60:02d}'


def cue(number, title, minute, goal, steps):
    rows = [f'<p class="slide-name">{html.escape(title)} <span class="min">{clock(minute)}</span></p>',
            f'<p class="goal">{html.escape(goal)}</p>']
    for i, step in enumerate(steps):
        mark = f'<span class="kind">click {i}</span>' if len(steps) > 1 else ''
        rows.append(f'<p>{mark}{html.escape(step["say"])}</p>')
        if step['run']:
            rows.append(f'<p><span class="kind run">Run</span><code class="cmd">{html.escape(step["run"])}</code></p>')
        if step['tip']:
            rows.append(f'<p class="note">{html.escape(step["tip"])}</p>')
        if step['more']:
            rows.append(f'<p class="note"><b>Background.</b> {html.escape(step["more"])}</p>')
    return (f'      <li class="cue" data-at="{minute}"><span class="at">{number:02d}</span><div class="what">\n        '
            + '\n        '.join(rows) + '\n      </div></li>')


sections = []
number = 0
for key, name, start, end, point in SEGMENTS:
    cues = []
    for sid, title, minute, goal, steps in SLIDES:
        if start <= minute < end:
            number += 1
            cues.append(cue(number, title, minute, goal, steps))
    sections.append(f'''  <section class="seg" id="{key}" data-start="{start}" data-end="{end}" data-name="{html.escape(name)}">
    <div class="seg-head">
      <p class="seg-time"><span>{clock(start)} to {clock(end)}</span><span>{end - start} min</span><span class="onnow">On now</span></p>
      <h2>{html.escape(name)}</h2>
      <p class="seg-point">{html.escape(point)}</p>
    </div>
    <ol class="cues">
{chr(10).join(cues)}
    </ol>
  </section>
''')

page = PAGE.read_text()
first = page.index('  <section class="seg" id="opening"')
last = page.index('  <section class="seg" id="questions"')
page = page[:first] + '\n'.join(sections) + '\n' + page[last:]
page = re.sub(r'<p class="lede">.*?</p>',
              '<p class="lede">One block per slide; the number on the left is the slide number. Each line is one click. '
              'Lines in quotes are yours to say, grey lines are stage directions and background. '
              'The numbers came from this laptop, so on the day read them off the screen.</p>', page, count=1, flags=re.S)
if '.goal' not in page:
    rules = '.goal { color: var(--act); font-weight: 700; }\n'
    if '.slide-name' not in page:
        rules = '''.slide-name { font-weight: 700; }
.slide-name .min { margin-left: 0.4rem; font-family: var(--font-mono); font-size: 0.8125rem; font-weight: 400; color: var(--muted); }
.cue.is-now .slide-name .min { color: var(--now); }
''' + rules
    page = page.replace('</style>', rules + '</style>', 1)
PAGE.write_text(page)
print(f'cue sheet rebuilt: {number} slides in {len(SEGMENTS)} segments')
