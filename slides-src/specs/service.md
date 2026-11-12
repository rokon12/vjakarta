# Scene `service`: what one reservation does

A plotted block diagram of the demo service, in the contract's vocabulary. No animation: each
step reveals more of the numbers. Files you own: `scenes/service.js`, `scenes/service.css`,
`slides/08-service.html`.

## The picture

- Left: one reservation (a `rect.box` with five `tok is-run` squares) fanning out on `.wire`s:
  four seat holds on the upper lane, one payment on the lower lane.
- Middle: the executor, one tall `rect.box is-heavy` across both lanes.
- Upper lane: the connection pool (20 small slot boxes) and the database.
- Lower lane: the payment provider.
- Labels in `text.lbl.sm` over `.rule` lines; numbers in `text.val` with a `text.sub` line.

## Steps

- 0: the shape, with names only.
- 1: the numbers: `20 CONNECTIONS` on the pool, database `10 ms` "a seat hold", provider `20`
  "at a time · 50 ms each".
- 2: the executor shows `16` "platform threads".
- 3: a tag on the payment wire: `@Retry` "3 retries · never needed so far".

Every step renders synchronously from `setStep`; nothing moves.
