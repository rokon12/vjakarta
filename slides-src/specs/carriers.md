# Scene `carriers`: what a platform thread costs, and what a virtual thread does instead

Two slides host this scene, each with a different `mode` argument. It is the primer for people
who have never used virtual threads, so clarity beats cleverness: someone who has never seen the
word "carrier" must understand it from the picture.

Files you own: `scenes/carriers.js`, `scenes/carriers.css`, `slides/05-platform.html`, `slides/06-virtual.html`.

## Mode `platform` (slide `platform`, steps 0..2)
The picture: a pool of platform threads (draw 6 lanes that stand for 200) between incoming
requests on the left and the database on the right.

- Step 0, "one request, one OS thread": requests arrive continuously. Each takes a free thread.
  Inside its thread a request does a short burst of work, then waits on the database for a long
  time, then a short burst, then leaves. The thread is occupied the whole time. When all six
  threads are busy, new requests queue on the left. Keep this running as a loop.
- Step 1, the cost: make it obvious that most of each thread's time is waiting, and that the
  thread is held while it waits. Label: "about 1 MB of stack, working or waiting".
- Step 2, the consequence: label the pool "Tomcat's default: 200" and the queue on the left
  "waiting for a thread". The queue should be visibly non-empty.

## Mode `virtual` (slide `virtual`, steps 0..3)
The picture: 4 carriers (platform threads, one per core), a heap area where parked virtual
threads live, and the database.

- Step 0: a virtual thread is mounted on a carrier and runs.
- Step 1: it blocks on the database. It unmounts and is parked on the heap; label "parked: a few
  kilobytes". The carrier immediately mounts the next runnable virtual thread. Loop this so the
  room sees the hop on, hop off rhythm with a handful of threads.
- Step 2: the database answers. The parked thread becomes runnable and mounts on whichever
  carrier is free (not necessarily the one it left), finishes, and disappears.
- Step 3, scale: hundreds of parked virtual threads on the heap at once, the same 4 carriers.
  Readouts: "1,000 waiting" and "4 carriers". Line: "Waiting costs kilobytes, not a thread."

## Notes
- Use the same token for a request/virtual thread in both modes, so the room sees it is the
  same work, scheduled differently.
- The waiting state must look different from the running state at a glance, in colour and in
  form, and the same waiting colour must mean waiting in every scene of the deck.
- In still mode each step must render a representative frozen frame (step 3 shows the heap full).
