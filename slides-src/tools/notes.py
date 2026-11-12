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
    ('opening', 'Opening', 0, 3, 'Get a show of hands, then promise three things that break.'),
    ('primer', 'What a virtual thread is', 3, 10, 'Nothing gets faster. Waiting gets cheap, so requests stop queueing for a thread.'),
    ('demo-1', 'The database slows down', 10, 24, 'The thread pool was your limit. It is gone, so set one on purpose.'),
    ('demo-2', 'Requests run one at a time', 24, 38, 'Cheap waiting is still waiting. Keep slow calls out of the lock.'),
    ('demo-3', 'Work continues after a timeout', 38, 51, 'A timeout on the wait does nothing to the work.'),
    ('wrap', 'Wrap', 51, 56, 'One idea, three checks, then the book and where to find you.'),
]

SLIDES = [
    ('title', 'Title', 0, 'Set the promise: one small service, broken three ways, live.', [
        S('“I’m Bazlur. For the next hour we take one small seat-reservation service and break it three different ways, live, and fix it each time. Everything runs on JDK 25 from a single file, so you can repeat every demo on your own laptop tonight.”',
          tip='Press T first if you want your real time on the ruler. The trace on the slide crosses the limit line three times: that is the outline of the talk.',
          more='If the room looks new to virtual threads, add: “You don’t need to have used them. I’ll spend five minutes on what they are.”'),
    ]),
    ('hands', 'Hands up if', 0, 'Find out who runs virtual threads, and plant the question the talk answers.', [
        S('“Hands up if you run Java 21 or later in production.”',
          more='Most hands should go up: 21 is the first long-term-support release with virtual threads final.'),
        S('“Keep it up if virtual threads are switched on.”', more='Expect about half the hands to drop.'),
        S('“Keep it up if you changed anything else when you switched them on.” Pause and look around the room. “Almost nobody. That last question is this talk: what else has to change.”'),
    ]),
    ('one-line', 'Turning them on is one line', 1, 'Switching them on is trivial. The consequences are not in the diff.', [
        S('“Turning them on is one line. In Spring Boot 3.2 and later it is this property. Other frameworks have a similar switch, or you swap one executor.”',
          more='With this property Tomcat handles each request on a new virtual thread instead of a pooled platform thread.'),
        S('“Three things can go wrong afterwards.”'),
        S('“And none of them looks like a bug in code review. The diff is one line of configuration. The problems are in code nobody touched.”'),
    ]),
    ('plan', 'One service, three ways to break it', 2, 'Give the map of the hour and the method.', [
        S('“One: the database slows down, and the service falls over in a way it never did with a thread pool.”'),
        S('“Two: requests run one at a time, even though every one of them has its own thread.”'),
        S('“Three: work continues after a timeout. The caller has gone. The work hasn’t.”'),
        S('“The method is the same each time: break it, read what it prints, fix it. Every demo is one Java file you run with java File.java. No build, no framework, no Docker.”',
          more='The dependencies are a sleep and a semaphore on purpose, so nothing can fail on stage. Each one stands for a real thing, and you say which when you get there: the connection pool, the payment provider.'),
    ]),
    ('platform', 'A platform thread is an OS thread', 3, 'Show what a waiting platform thread costs, so the room sees what virtual threads change.', [
        S('“A platform thread is a thin wrapper around an operating-system thread. In the classic model one request takes one thread and keeps it until the response is written.”',
          tip='Point at one lane: the request on the left, its work drawn to the right.'),
        S('“Now look at what the thread is doing. The solid part is real work. The hatched part is waiting for the database, and for a typical service that is most of the request. The thread is held the whole time, and it reserves about a megabyte of stack whether it works or waits.”',
          more='The megabyte is reserved address space, not all committed. The real cost is that OS threads are limited and expensive to switch, so every server caps them.'),
        S('“Because threads are expensive we pool them. Tomcat’s default is 200. Request number 201 queues for a thread. Remember this pool. It comes back in the first demo, because it was quietly doing a second job.”'),
    ]),
    ('virtual', 'A virtual thread belongs to the JVM', 4, 'Mount, park, unmount: the one mechanism the rest of the talk relies on.', [
        S('“A virtual thread is a thread the JVM schedules itself. It needs an OS thread only while it is actually running. That OS thread is called its carrier, and by default there is one carrier per core.”'),
        S('“When the virtual thread blocks, on a socket, a sleep or a lock, the JVM parks it: its stack is copied to the heap, and the carrier immediately picks up another virtual thread. Nobody holds an OS thread while waiting.”',
          more='The carriers are a ForkJoinPool. Its size is jdk.virtualThreadScheduler.parallelism, the number of processors by default.'),
        S('“When the database answers, the virtual thread is runnable again and mounts on whichever carrier is free. It may be a different carrier every time. Your code doesn’t notice: it is still plain blocking code, top to bottom.”'),
        S('“So a thousand requests can wait at once on four carriers. A parked virtual thread costs kilobytes of heap, so you stop pooling and create one new thread per request. This has been final since JDK 21.”',
          more='JEP 444. Never pool virtual threads: they are meant to be created per task and thrown away.'),
    ]),
    ('intro-ask', 'A thousand requests', 6, 'Make the room predict the numbers before they see them.', [
        S('“Let’s measure it. A thousand requests, each waits 100 ms on the database. First with a pool of 50 platform threads. How long?”',
          tip='Let them work it out: 20 batches of 50, 100 ms each, two seconds.'),
        S('“And with one virtual thread per request?” Take a guess or two, then switch to the terminal.',
          run='./run.sh intro',
          tip='Intro.java is 25 lines: show it for a few seconds before you run it. If the room is warm, change 1_000 to 1_000_000 and comment out the platform line: about 4 seconds. Undo it afterwards.'),
    ]),
    ('intro-race', 'Nothing got faster', 7, 'The gain is throughput. No single request got faster.', [
        S('“Here is what you just watched, drawn. Each cell is one request. Top lane: the pool of 50. Bottom lane: a thread each.”'),
        S('Let it play. It runs in real time for two seconds. While the top lane grinds: “Fifty at a time. Everyone else is queueing for a thread.”'),
        S('“2,084 milliseconds against 114. But look at what did not change: every request still waited 100 ms on the database. Nothing got faster. We stopped queueing for a thread.”',
          tip='Point at the two bars at the bottom: the last request in lane A spent almost two seconds queueing and 100 ms being served.',
          more='Virtual threads raise throughput. They do nothing for the latency of one request.'),
    ]),
    ('cheated', 'And I cheated', 9, 'Turn the good news into the first problem.', [
        S('“And I cheated.” Pause.'),
        S('“My database took a thousand queries at the same instant without blinking, because it was a sleep. A real database sits behind a connection pool, and the pool has a size. So let’s give the service a real limit and see what a thread per request does to it.”'),
    ]),
    ('demo1', 'Demo 1: the database slows down', 10, 'Set up the numbers the whole demo uses.', [
        S('“Demo one. The same reservation service, now with numbers. 200 requests a second arrive. The pool has 8 database connections. A query takes 20 ms.”'),
    ]),
    ('demo1-healthy', 'A healthy afternoon', 10, 'Show the system when nothing is wrong, so the failure has a baseline.', [
        S('“This is that service on a normal afternoon, simulated live. Requests come in on the left, take a connection, run a 20 ms query and leave. Four or five in flight at any moment, and the chart at the bottom is flat.”',
          tip='Optional: show OverloadUnbounded.java in the IDE. connections is the pool, handle() counts a request in and out, reserve() runs the query.'),
        S('“The arithmetic: 8 connections at 20 ms each is 400 queries a second. We send 200. Half the capacity is spare. This is a healthy, boring system.”'),
    ]),
    ('demo1-ask', 'How long is the service slow?', 12, 'Get a prediction, then run the real program.', [
        S('“Now the database gets four times slower for three seconds. A missing index, a noisy neighbour, a backup. 80 ms a query, so capacity drops to 100 a second while 200 keep arriving.”'),
        S('“A question for you. The database is slow for three seconds. How long is the service slow?” Take two answers, then switch.',
          run='./run.sh overload',
          tip='Read the lines aloud as they print. In flight: 4, 4, then 113, 218, 322. The database is back at second 6 while 187 are still in flight. The service is back at second 8. Last line: about 1,077 on time, 732 late, rejected 0.'),
    ]),
    ('demo1-what', 'Three seconds of slow database', 15, 'Make the invisible queue visible: 322 parked threads.', [
        S('“The same run as a picture. On top, the service. Below, requests in flight over the nine seconds.”'),
        S('Plays three seconds, then freezes. “The database slows down. Watch the pile. Every request still gets its own thread, and every thread parks waiting for one of eight connections: a hundred more every second. At five seconds there are 322 in flight, the oldest has waited 1.6 seconds, and everything in red has already missed the half-second deadline.”',
          more='Nothing failed and nothing was logged. In production this pile is invisible: it is only parked threads.'),
        S('Plays four seconds. “At five seconds the database is healthy again. Look at the chart: the service isn’t. It has to work off the backlog while new requests keep arriving, so it needs almost three more seconds.”'),
        S('“Slow database for three seconds, slow service for five. 732 of 1,809 customers waited more than half a second. And we rejected nobody, so on a dashboard every one of those is a success.”'),
    ]),
    ('demo1-why', 'The pool was your limit', 16, 'Explain why this never happened with platform threads.', [
        S('“Why didn’t this happen before? With 200 platform threads, at most 200 requests could be inside the service. Nobody designed that as protection. It was an accident, but it was a limit.”'),
        S('“With virtual threads every request gets in and parks on the pool. A parked thread costs almost nothing, so nothing pushes back, and the queue grows without bound.”'),
        S('“That semaphore of eight is your HikariCP pool. In production these requests are parked inside getConnection(), and its default timeout is 30 seconds. So the symptom you actually see is a wall of connection-timeout exceptions half a minute later.”',
          more='The exception is SQLTransientConnectionException: “Connection is not available, request timed out after 30000ms”.'),
        S('“The standard advice for virtual threads is: limit concurrency with a semaphore, not with a pool. We already have one. It limits how many run. It does not limit how many wait. Those are two different limits, and we only have the first.”'),
    ]),
    ('demo1-fix', 'The fix: say no at the door', 19, 'Add the missing limit: how many may be inside at all.', [
        S('“The fix is six lines in handle().”',
          tip='Type them live in OverloadUnbounded.java if you like. OverloadBounded.java is the answer key.'),
        S('“A second semaphore, called admission, with 32 permits. That is how many requests may be inside the service at all, running or waiting.”'),
        S('“The important detail is tryAcquire, not acquire. If there is no permit we don’t wait at the door, we say no at once. Over HTTP that is a 503 with a Retry-After, and the caller still has time to do something useful.”'),
        S('“And we always hand the permit back, in a finally.”'),
        S('“Why 32? Eight are running, which leaves 24 waiting. At 80 ms a query the pool finishes about 100 a second, so 24 waiting is about 240 ms, plus the query itself: 330 ms, inside the 500 ms deadline. Pick the deadline first. The queue length follows from it.”',
          run='./run.sh bounded',
          tip='In flight stops at 32 (it can print 24 to 26, that is the sampling instant). Rejected climbs by about 100 a second and stops the moment the database is back. Last line: about 1,518 on time, 0 late, 291 rejected.'),
    ]),
    ('demo1-door', 'A door in front of the pool', 22, 'Show the bounded service surviving the same slowdown.', [
        S('“The same simulation with the door in front: at most 32 in flight.”'),
        S('Plays three seconds, then freezes. “The database slows down again. In flight climbs to 32 and stops: eight running, 24 waiting. Every other arrival is turned away at once. The rejected counter climbs, but nobody inside waits longer than a third of a second.”'),
        S('Plays on. “And when the database recovers, the service is back to normal within a tenth of a second, because there is no backlog to work off.”'),
    ]),
    ('demo1-result', 'Say no to 291, say yes to 441 more', 23, 'Rejecting some requests got more requests served on time.', [
        S('“The same 1,809 requests. Without the limit: 1,077 answered on time, 732 late.”'),
        S('“With the limit: 1,518 on time, nobody late, 291 told no immediately.”'),
        S('“Saying no to 291 people got 441 more people a fast yes. And a fast no beats a slow yes, because the caller can retry, fall back or show a message.”',
          tip='If time: a limit of 64 lets 223 answers arrive late, the slowest at 730 ms. A limit of 8 keeps everyone under 88 ms and rejects only 35 more. “A queue absorbs a burst. In a long overload it adds latency and no capacity.”'),
    ]),
    ('check1', 'Check 1', 23.5, 'First take-home question, then the bridge to demo 2.', [
        S('“First check to take home.” Read it out. “If the honest answer used to be ‘the thread pool’, that limit disappears the day you turn on virtual threads.” Then: “Demo one was about a pool: eight connections, a number somebody chose. Demo two is about a lock: one request at a time, and nobody chose that.”'),
    ]),
    ('demo2', 'Demo 2: requests run one at a time', 24, 'Set up the reservation logic and its numbers.', [
        S('“Demo two. Now the reservation logic itself. 40 seats, 50 customers arriving at the same moment, and charging a card takes 80 ms at the payment provider.”'),
    ]),
    ('demo2-ask', 'It must never oversell', 26, 'Show code that looks obviously correct, and get a wrong prediction.', [
        S('“This is reserve(). If there are no seats left, say so. Otherwise charge the card, then take the seat. It must never sell seat 41, so the whole method is synchronized. Reviewed, correct, shipped.”',
          tip='Point at the two marks: the yellow keyword is the lock, the boxed line is the 80 ms call.'),
        S('“Fifty customers, fifty virtual threads, 80 ms each. Virtual threads are good at waiting. How long does this take?” Let someone say 80 ms, then switch.',
          run='./run.sh wide', tip='It prints: confirmed 40, turned away 10, about 3,356 ms.'),
    ]),
    ('demo2-wide', 'Correct, and one at a time', 28, 'The answer is right but slow: the lock lets one customer through at a time, however many threads there are.', [
        S('The chart draws itself for about 3.4 seconds. Wait until it stops, then: “The result is correct. Forty seats, forty confirmed, ten turned away, nothing oversold. Now look at the clock: 3.4 seconds. The customers went through one at a time, and forty payments at 80 ms each is 3.2 seconds.”',
          tip='Point at the three counters on the left as you name them: confirmed, turned away, clock.'),
        S('“Here is how to read the chart. Each row is one customer, fifty rows, and time runs left to right. The yellow piece is the 80 ms in which that customer holds the lock and waits for the payment provider. The hatched part to its left is the same customer waiting for the lock. At the start one customer holds the lock and the other 49 are parked behind it. Each time one finishes, exactly one more gets in. Virtual threads make waiting cheap. They don’t make a lock hold two people.”',
          tip='Trace one row with your finger: hatched first, then yellow. The last two sentences are the caption on the slide.',
          more='Same shape as demo one. There the pool let eight requests run and the rest waited. Here the lock lets one run and the rest wait. The last ten customers also wait for the lock, find no seats left, and return at once.'),
    ]),
    ('pinning', 'Is that pinning?', 29, 'Someone will ask “isn’t that just pinning?”. Answer it first: pinning was a different problem, it is fixed, and our slow lock is still there.', [
        S('The top chart plays for about a second. Then: “Some of you are thinking: that is the pinning problem. It is not, and I want to show you the difference. Pinning was this. On JDK 21, when a virtual thread had to wait inside a synchronized block, it could not step aside. It kept its carrier thread busy for the whole wait. Here is a test for exactly that: twenty tasks, only two carrier threads, and each task sleeps 100 ms inside its own lock. Nobody shares a lock, so nobody should wait for anybody. But on JDK 21 only two could sleep at a time. Ten rounds of 100 ms: a full second.”',
          run='./run.sh pinning',
          tip='Run it after you have explained the test. On JDK 25 it prints about 108 ms. The 1,037 ms on the slide is what this laptop measured on JDK 21.'),
        S('The lower chart plays. Then: “JDK 24 fixed this, in JEP 491. Same code on JDK 25: a virtual thread that waits inside synchronized now steps aside, even though it still holds the lock. Both carrier threads are free straight away, so all twenty tasks sleep at the same time. About a tenth of a second instead of a full second.”',
          tip='Point at the two clocks: 1,037 ms above, 108 ms below.'),
        S('“So pinning is fixed, and our reservation still takes 3.4 seconds. Why? Pinning was about a carrier thread being held up. Our problem is different: fifty customers all need the same lock, and a lock lets one in at a time. No JDK release changes that. Pinning was the JVM’s problem. The wide lock is ours.”',
          tip='The last two sentences are the caption on the slide.',
          more='A carrier thread is one of the few real threads that virtual threads take turns running on. On JDK 25 a virtual thread can still hold on to its carrier while it waits inside native code or inside a class initializer.'),
    ]),
    ('demo2-fix', 'The fix: charge outside the lock', 32, 'Narrow the lock to the shared state, and pay for it with an undo.', [
        S('“The fix changes what the lock covers.”',
          tip='Or show ContentionNarrow.java next to ContentionWide.java in the IDE.'),
        S('“Take the seat under the lock: check, decrement, done. That is microseconds.”'),
        S('“Then charge the card with no lock held. Forty of these can now overlap.”'),
        S('“But we took the seat before the money arrived. If the charge fails we have to give it back, under the lock again. That is the price of a narrow lock: you need an undo.”',
          more='This is the hold, confirm, cancel shape. A real system also puts an expiry on the hold.'),
        S('Switch to the terminal.', run='./run.sh narrow', tip='It prints: confirmed 40, turned away 10, about 92 ms.'),
    ]),
    ('demo2-narrow', 'Same answer, 36 times faster', 35, 'Same correctness, a fraction of the time.', [
        S('Plays in real time and is over in a blink. “This is the same time axis as the wide run. That sliver at the left edge is the entire run: 92 ms.”'),
        S('Zooms in and replays slowly. “Zoomed in to the first 100 ms. Forty tiny lock holds, one after another, just to count seats. Then forty charges at the same time, with no lock held. Same answer, 40 confirmed and 10 turned away, 36 times faster.”'),
    ]),
    ('demo2-hides', 'Where it hides', 36, 'Help them recognise the pattern in their own code.', [
        S('“Where this hides in real code. A synchronized cache loader that calls the database.”',
          more='ConcurrentHashMap.computeIfAbsent with a slow loader does it too: it blocks other updates to that part of the map while the loader runs.'),
        S('“A token refresh under a lock. Every request waits while one thread calls the auth server.”'),
        S('“A database row lock, SELECT FOR UPDATE, held across an HTTP call. The lock lives in the database, but it is the same shape.”'),
        S('“With 200 threads you may never have noticed, because the pool was the bigger queue. With a thread per request, the lock is the only queue left.”'),
    ]),
    ('check2', 'Check 2', 37, 'Second take-home question, then the bridge to demo 3.', [
        S('“Second check.” Read it out. “Search for synchronized and for lock(), and look at what happens before the unlock.” Then: “The payment provider answered in 80 ms. What if it doesn’t? We put a timeout on it, of course.”'),
    ]),
    ('demo3', 'Demo 3: work continues after a timeout', 38, 'Set up the slow payment provider.', [
        S('“Demo three. The payment provider has a bad day: 1,800 ms an answer. We are not going to make the customer wait for that. We wait 200.”'),
    ]),
    ('demo3-ask', 'We won’t make them wait', 40, 'Show the timeout everyone writes, and ask what it does to the work.', [
        S('“The usual way: submit the work, then call get with a timeout of 200 ms. If it times out, we log it and tell the customer to try again.”',
          tip='Point at the highlighted get(200, MILLISECONDS).'),
        S('“So at 200 ms the customer is told: timed out, try again. What happens to the payment?” Let them answer, then switch.',
          run='./run.sh leak',
          tip='Four lines: charging card, timed out at about 205 ms, card charged at about 1,812 ms, handler returned at about 1,812 ms.'),
    ]),
    ('demo3-leak', 'We said it failed. Then we charged.', 42, 'The caller stopped waiting. Nothing told the work to stop.', [
        S('Plays 1.8 seconds in real time. Stay silent until “card charged” lands. “At 205 ms we told the customer it failed. At 1,812 ms we charged the card.”',
          tip='Point at the caller track: the handler itself was stuck until 1,812 ms, because closing the executor waits for the task. With a shared executor it would return at 200 ms and the charge would happen where nobody is looking.'),
        S('“The customer does what we told them and presses retry. That is a second charge on its way.”'),
        S('“get with a timeout limits how long the caller waits. It says nothing to the task. CompletableFuture.orTimeout is the same, and on a CompletableFuture even cancel(true) interrupts nothing.”',
          more='The CompletableFuture documentation says the mayInterruptIfRunning argument “has no effect in this implementation”.'),
    ]),
    ('demo3-fix', 'The fix: cancel the work', 45, 'One line stops the work, when the work cooperates.', [
        S('“The fix is one line in the catch block.”',
          tip='Type it live in TimeoutLeak.java if you like. TimeoutCancel.java is the answer key.'),
        S('“reservation.cancel(true). The true means: interrupt the thread that is running it.”'),
        S('“It works when the task is blocked in something interruptible: a sleep, a socket read, a lock wait. It fails when the task swallows InterruptedException and carries on, or burns CPU and never checks.”',
          run='./run.sh cancel',
          tip='If time: delete throw e; in reserve() and run again. It prints payment cancelled, then card charged in the same millisecond. Put the line back.'),
    ]),
    ('demo3-cancel', 'Cancelled at 209 ms', 46, 'Show what was saved, and the two ways this fix still fails.', [
        S('Plays. “Timed out at 209 ms, cancelled at 209 ms, handler returned at 209 ms. The faint bar is the 1.6 seconds of work we no longer do.”'),
        S('“Two catches. Interruption is a request: the bottom row is the same task with the exception swallowed, and the card is charged anyway. And you have to remember to cancel on every path: every timeout, every early return, every exception.”'),
    ]),
    ('demo3-scope', 'Better: the scope owns the deadline', 48, 'Structured concurrency makes forgetting impossible.', [
        S('“Structured concurrency takes the remembering away. The work is forked inside a scope, and you cannot leave the scope while the work is still running.”'),
        S('“The deadline is a property of the scope: withTimeout, 200 ms.”'),
        S('“fork starts the task in its own virtual thread, join waits for it. If the deadline passes, the scope interrupts everything it forked, and it does not let you out of the try block until that work has actually stopped.”'),
        S('“It is a preview API in JDK 25, JEP 505, the fifth preview, and its shape changed in this release. So you need --enable-preview, and you should expect to touch this code again.”',
          run='./run.sh structured',
          more='Up to JDK 24 this was new StructuredTaskScope.ShutdownOnFailure(). JDK 25 uses open() with a Joiner.'),
    ]),
    ('demo3-order', 'Cancelled first, reported second', 49, 'The order of events is the guarantee.', [
        S('Plays. “The same timeline, with the scope drawn around both tracks.”'),
        S('“Read the order. One: payment cancelled, at 207. Two: timeout reported, at 208. Three: handler returned. With the future we told the customer first and cancelled second, if we remembered. Here the work is already gone when our catch block runs. Fork three tasks instead of one and all three are cancelled.”'),
    ]),
    ('demo3-tieback', 'The callers left. The work stayed.', 50, 'Tie the three demos together.', [
        S('“Remember the 322 requests in flight in demo one?”'),
        S('“Their callers had timeouts too. Browsers, gateways, other services.”'),
        S('“The callers left. The work stayed. A lot of that backlog was work nobody was waiting for any more. The three demos are one problem seen from three sides.”'),
    ]),
    ('check3', 'Check 3', 50.5, 'Third take-home question.', [
        S('“Third check.” Read it out. “Find every get with a timeout and every orTimeout, and ask what stops the work.”'),
    ]),
    ('jobs', 'Threads got free. Nothing else did.', 51, 'The whole talk in one slide.', [
        S('“Here is the whole talk in one slide. Virtual threads made threads free. Nothing else got cheaper: not database connections, not locks, not the payment provider. And the thread pool was quietly doing three jobs nobody gave it.”'),
        S('“It limited the load on the database.” That was demo one.'),
        S('“It hid wide locks, because the pool was the bigger queue.” Demo two.'),
        S('“It capped how much abandoned work could pile up.” Demo three.'),
        S('“Those jobs are yours now. That is not an argument against virtual threads. It is the list of things to do when you turn them on.”'),
    ]),
    ('checks', 'Three checks to take home', 52, 'Leave them with something to do on Monday.', [
        S('“Three checks for Monday morning.” Read them. Leave the slide up long enough for photos.'),
    ]),
    ('thanks', 'Thank you', 54, 'Close, point at the code, open the floor.', [
        S('“Every demo is one file, and the address is on the slide. Thank you. Questions?”',
          tip='One more click: the last slide has the book and your links. Leave it up for the questions.',
          more='Short answers to the likely questions are at the end of the phone cue sheet, under “Questions you may get”.'),
    ]),
    ('links', 'The long version', 55, 'Leave this up during questions: the book, and where to find you.', [
        S('“Today was three demos. The long version is this book: Modern Concurrency in Java, from O’Reilly. The QR code on the left takes you to it. The demos are on GitHub, and this is where to find me. I will leave this up while we take questions.”',
          tip='Stay on this slide for the whole Q&A so people can photograph it.',
          more='The QR code opens the book on learning.oreilly.com, the same link bazlur.com uses.'),
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
