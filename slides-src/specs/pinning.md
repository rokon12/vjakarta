# Scene `pinning`: the question every experienced developer in the room is about to ask

Right after the wide-lock demo someone thinks "that's the pinning problem". This scene shows what
pinning was, that JDK 24 fixed it, and therefore that the wide lock is a different problem.

Files you own: `scenes/pinning.js`, `scenes/pinning.css`, `slides/22-pinning.html`.

## The experiment (it is a real program the speaker runs: `./run.sh pinning`)
20 tasks on 2 carrier threads. Each task sleeps 100 ms inside its own `synchronized` block, so no
two tasks ever compete for the same lock.

## The picture
Two carriers, a queue of runnable virtual threads, a heap for parked ones, a clock in
milliseconds. Use the same visual words for carrier, mounted, parked as the `carriers` scene in
this deck (its spec: carriers are platform threads; a parked virtual thread sits on the heap).
Since both scenes are built at the same time, follow the shared design system closely so they
match: same token for a virtual thread, same colour for running and for waiting.

## Slide `pinning`, steps 0..2
- Step 0, JDK 21: play IN REAL TIME, about one second. A task mounts on a carrier, enters its
  `synchronized` block and sleeps. Because it holds a monitor it cannot unmount: the carrier is
  pinned, stuck with a sleeping thread for 100 ms. Two carriers, so two tasks at a time; the
  other 18 wait in the runnable queue. Ten rounds. The clock stops on 1,037 ms. Label the run
  "JDK 21".
- Step 1, JDK 25: keep the JDK 21 result on screen (final time 1,037 ms) and play the same 20
  tasks again beside or below it. A sleeping task now unmounts and parks on the heap even though
  it holds its monitor, so the carriers are free at once and all 20 tasks sleep at the same time.
  The clock stops on 108 ms. Label the run "JDK 25" and credit "JEP 491, since JDK 24".
- Step 2: both results stay. The host slide reveals "Pinning was the JVM's problem. The wide
  lock is ours."

## Notes
- The word "pinned" should be on screen while a carrier is pinned.
- Make the difference between the two runs visible as a difference in what the carriers are
  doing, not only as two numbers.
- In still mode step 0 shows the JDK 21 run finished; steps 1 and 2 show both finished.
