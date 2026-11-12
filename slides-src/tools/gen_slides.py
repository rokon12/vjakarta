#!/usr/bin/env python3
"""Writes the typographic slides (everything that is not a scene host) into slides/."""
import html
import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parent.parent / 'slides'

TOKEN = re.compile(
    r'(?P<s>"[^"]*")'
    r'|(?P<c>//.*$)'
    r'|(?P<k>\b(?:public|private|final|new|void|if|else|return|try|finally|catch|throw|throws|synchronized|boolean|var|this|class|extends|instanceof|int)\b)'
    r'|(?P<n>\b\d+\b)'
)


def paint(text):
    out, pos = [], 0
    for m in TOKEN.finditer(text):
        out.append(html.escape(text[pos:m.start()], quote=False))
        out.append(f'<span class="{m.lastgroup}">{html.escape(m.group(), quote=False)}</span>')
        pos = m.end()
    out.append(html.escape(text[pos:], quote=False))
    return ''.join(out)


def code(lines, style='', source=None):
    """lines: (text, options). options: step (whole line turns bold at that step),
    hl (substring to highlight, or True for the whole line), hlstep, free (outline, not marker)."""
    rows = []
    for n, entry in enumerate(lines, 1):
        text, opt = entry if isinstance(entry, tuple) else (entry, {})
        indent = len(text) - len(text.lstrip(' '))
        body = text[indent:]
        mark = opt.get('hl')
        if mark:
            target = body if mark is True else mark
            start = body.index(target)
            cls = 'hl free' if opt.get('free') else 'hl'
            step = f' data-step="{opt["hlstep"]}"' if 'hlstep' in opt else ''
            body_html = (paint(body[:start]) + f'<span class="{cls}"{step}>{paint(target)}</span>'
                         + paint(body[start + len(target):]))
        else:
            body_html = paint(body)
        step = f' data-step="{opt["step"]}"' if 'step' in opt else ''
        cls = 'ln add' if opt.get('add') else 'ln'
        gone = ' style="text-decoration:line-through;text-decoration-thickness:4px;color:var(--ink-2)"' if opt.get('gone') else ''
        rows.append(f'<div class="{cls}"{step}{gone}><i>{n}</i>{" " * indent}{body_html}</div>')
    attr = f' style="{style}"' if style else ''
    cited = f' data-source="{source}"' if source else ''
    return f'<div class="code"{attr}{cited}>' + ''.join(rows) + '</div>'


def cue(command, step=None, small=False):
    s = f' data-step="{step}"' if step is not None else ''
    cls = 'cue sm' if small else 'cue'
    return (f'<div class="{cls}"{s}><div class="h">Next · terminal</div>'
            f'<div class="c">$ {command}<span class="cur"></span></div></div>')


def slide(file, sid, layout, title, section, key, minute, body, steps=None):
    s = f' data-steps="{steps}"' if steps is not None else ''
    text = (f'<section class="slide" id="{sid}" data-layout="{layout}" data-title="{html.escape(title)}" '
            f'data-section="{section}" data-section-key="{key}" data-min="{minute}"{s}>\n{body.strip()}\n</section>\n')
    (OUT / file).write_text(text)


def circle(n, cx, cy, path, step):
    return (f'<g data-step="{step}"><g filter="url(#rough)"><path d="{path}"/><circle cx="{cx}" cy="{cy}" r="30"/></g>'
            f'<text x="{cx}" y="{cy + 15}">{n}</text></g>')


APP = 'src/main/java/ca/bazlur/tickets/'


def at(*refs):
    return ' '.join(f'{tag}:{APP}{file}' for tag, file in refs)


SWITCH = [
    '@ApplicationPath("/api")',
    ('@ManagedExecutorDefinition(name = "…", maxAsync = 16)', {'gone': True}),
    ('@ManagedExecutorDefinition(name = "…", virtual = true)', {'add': True, 'hl': 'virtual = true'}),
    'public class TicketsApplication extends Application {',
    '}',
]
SWITCH_SOURCE = at(('before', 'TicketsApplication.java'), ('switched', 'TicketsApplication.java'))

# ---------------------------------------------------------------- opening

slide('01-title.html', 'title', 'title', 'Virtual threads removed the thread limit', 'Opening', 'opening', 0, '''
  <h1 style="font-size:186px">Virtual threads removed<br>the thread limit.</h1>
  <p class="lede">What breaks next in Jakarta EE?</p>
  <div class="scene-box" style="left:110px;top:590px;width:1230px;height:380px" data-scene="titletrace"></div>
  <div class="tblock" style="left:1380px;top:618px;width:440px">
    <div><small>Presented by</small><b>Bazlur Rahman</b></div>
    <div><small>Conditions</small><b class="s">Jakarta EE 11 · live</b></div>
  </div>
''')

slide('02-hands.html', 'hands', 'ask', 'Type in chat', 'Opening', 'opening', 0.5, '''
  <h2 class="headline">Type in chat</h2>
  <ol class="rows" style="top:240px">
    <li><b>1</b><span>if you run Java 21 or later in production</span></li>
    <li data-step="1"><b>2</b><span>if virtual threads are switched on</span></li>
    <li data-step="2"><b>3</b><span>if you changed anything else when you switched them on</span></li>
  </ol>
  <div class="note" style="left:1010px;top:760px;--tilt:-3deg" data-step="2">that last one is this talk</div>
  <svg class="pen" data-step="2"><path filter="url(#rough)" d="M1000 790 C 930 800, 880 770, 850 716" marker-end="url(#arrow-red)"/></svg>
''')

slide('03-one-line.html', 'one-line', 'code', 'Turning them on is one line', 'Opening', 'opening', 1, f'''
  <h2 class="headline">Turning them on is one line</h2>
  {code(SWITCH, source=SWITCH_SOURCE)}
  <div class="cond" style="left:110px;top:600px" data-step="1"><span>Jakarta Concurrency 3.1</span><b>Jakarta EE 11 · Java 21 or later</b></div>
  <p class="body lg" style="top:720px" data-step="2">Nothing in this diff looks like <span class="scrib" data-bleed>a bug in code review<svg viewBox="0 0 300 26" preserveAspectRatio="none"><path d="M3 15 C 50 4, 96 24, 150 12 S 250 6, 297 16" fill="none" stroke="#d31f2b" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></span>.</p>
''')

slide('04-plan.html', 'plan', 'rows', 'One service, two sales, one rebuild', 'Opening', 'opening', 2, '''
  <h2 class="headline sm">One service, two sales, one rebuild</h2>
  <ol class="rows" style="top:226px">
    <li><b>1</b><span>The small sale<small>Sixteen platform threads struggle. Virtual threads fix it.</small></span></li>
    <li data-step="1"><b>2</b><span>The big sale<small>700 reservations a second. Now it breaks.</small></span></li>
    <li data-step="2"><b>3</b><span>The rebuild<small>Write the limits down.</small></span></li>
    <li data-step="3"><b>4</b><span>Deadlines<small>The customer gave up. Stop the work, and don’t charge twice.</small></span></li>
  </ol>
  <div class="cond" style="left:110px;top:900px" data-step="4"><span>Every run</span><b>k6 · the same load · the same laptop · measured, not drawn</b></div>
''')

# ---------------------------------------------------------------- the switch

slide('09-before-run.html', 'before-run', 'say', 'The small sale on sixteen threads', 'The switch', 'switch', 7.5, f'''
  <p class="say">A small sale.<br>Sixteen platform threads.</p>
  <p class="body lg" style="top:420px">60 reservations a second, then 120 more a second for 6 seconds.</p>
  <p class="say md" style="top:580px" data-step="1"><em>Watch p99.</em></p>
  {cue('./run.sh load before small', step=1)}
''')

slide('10-switch.html', 'switch', 'code', 'The switch', 'The switch', 'switch', 9, f'''
  <h2 class="headline">The switch</h2>
  {code(SWITCH, source=SWITCH_SOURCE)}
  <div class="note" style="left:1000px;top:590px;--tilt:-2deg" data-step="1">the advice:<br>never pool virtual threads</div>
  <div class="cond" style="left:110px;top:620px" data-step="2"><span>Then</span><b>the same small sale</b></div>
  {cue('./run.sh state switched', step=2)}
''')

slide('12-big-ask.html', 'big-ask', 'say', 'The launch', 'The switch', 'switch', 12, f'''
  <p class="say">The launch.<br>700 a second.</p>
  <p class="body lg" style="top:420px">The same service, the same switch. For three seconds.</p>
  <p class="say md" style="top:580px" data-step="1"><em>What happens to p99?</em></p>
  {cue('./run.sh load switched big', step=1)}
''')

# ---------------------------------------------------------------- where it moved

slide('15-why.html', 'why', 'rows', 'Sixteen threads were your limit', 'Where it moved', 'moved', 17, '''
  <h2 class="headline">Sixteen threads were your limit</h2>
  <ol class="rows tight" style="top:226px">
    <li><b>16</b><span>platform threads: at most 16 seat holds and payments at once<small>An accident, but a limit.</small></span></li>
    <li data-step="1"><b class="da" style="font-size:150px;padding-top:0">∞</b><span>virtual threads: every reservation starts all five at once<small>Parked threads are almost free, so nothing pushes back.</small></span></li>
  </ol>
  <div class="cond" style="left:110px;top:600px" data-step="2"><span>20 connections</span><b>829 reservations in flight queue for them</b></div>
  <p class="say sm" style="top:712px" data-step="3">The limit protected the database and the provider.<br>Nobody wrote it down.</p>
''')

slide('16-storm.html', 'storm', 'rows', '@Retry was always there', 'Where it moved', 'moved', 18.5, '''
  <h2 class="headline">@Retry was always there</h2>
  <ol class="rows tight" style="top:226px">
    <li style="grid-template-columns:300px 1fr"><b>4,939</b><span>charges the provider refused<small>It takes 20 at a time.</small></span></li>
    <li data-step="1" style="grid-template-columns:300px 1fr"><b>4,000</b><span>retries, each one more load on it<small>The MicroProfile defaults: 3 retries.</small></span></li>
    <li data-step="2" style="grid-template-columns:300px 1fr"><b class="red">939</b><span>customers whose payment failed anyway</span></li>
  </ol>
  <div class="note" style="left:1260px;top:300px;--tilt:-3deg" data-step="3">it never fired<br>before the switch</div>
''')

slide('17-check1.html', 'check1', 'check', 'Check 1', 'Where it moved', 'moved', 20, '''
  <div class="stamp blue" style="left:110px;top:110px;--tilt:-3deg">Check 1</div>
  <p class="q">For every pool, quota or downstream call: what limits how many requests can <em>wait</em> for it?</p>
''')

# ---------------------------------------------------------------- the rebuild

slide('18-rebuild.html', 'rebuild', 'section', 'The rebuild', 'The rebuild', 'rebuild', 21, '''
  <div class="exp"><small>Part</small>2</div>
  <h2>The rebuild</h2>
  <p class="body" style="top:560px;width:1080px">Write the limits down.<br>A door in front.<br>A budget behind it for each dependency.</p>
''')

slide('19-door-code.html', 'door-code', 'code', 'A door: at most 24 inside', 'The rebuild', 'rebuild', 21.5, f'''
  <h2 class="headline">A door: at most 24 inside</h2>
  {code([
      ('@ConfigProperty(name = "door.limit")', {'hl': '"door.limit"', 'hlstep': 1, 'step': 1}),
      'int limit;',
      '…',
      'public void filter(ContainerRequestContext request) {',
      ('    if (inside.tryAcquire()) {', {'hl': 'inside.tryAcquire()', 'hlstep': 2, 'step': 2}),
      '        request.setProperty("inside", true);',
      '    } else {',
      '        refused.inc();',
      ('        request.abortWith(Response.status(SERVICE_UNAVAILABLE)…);', {'hl': True, 'hlstep': 2, 'step': 2}),
      '    }',
      '}',
      '…',
      ('        inside.release();', {'hl': True, 'hlstep': 3, 'step': 3}),
  ], source=at(('budgeted', 'Door.java')))}
  <div class="note" style="left:1240px;top:236px;--tilt:-2deg" data-step="1">24, from config</div>
  <div class="note" style="left:1420px;top:770px;--tilt:-2deg" data-step="2">no room?<br>503, at once</div>
  <div class="note" style="left:1010px;top:900px;--tilt:-2deg" data-step="3">on the way out</div>
  <div class="note" style="left:1395px;top:410px;--tilt:-2deg" data-step="4">why 24? 360 a second<br>× 52 ms ≈ 19 inside</div>
''', steps=4)

slide('21-budgets-code.html', 'budgets-code', 'code', 'maxAsync is back, as a budget', 'The rebuild', 'rebuild', 26, f'''
  <h2 class="headline">maxAsync is back, as a budget</h2>
  {code([
      ('@ManagedExecutorDefinition(name = "…/seat-holds", …, maxAsync = 20)', {'hl': 'maxAsync = 20', 'hlstep': 1, 'step': 1}),
      ('@ManagedExecutorDefinition(name = "…/payments", …, maxAsync = 20)', {'hl': 'maxAsync = 20', 'hlstep': 2, 'step': 2}),
      'public class TicketsApplication extends Application {',
      '…',
      '        .mapToObj(seat -> seatHoldExecutor.runAsync(…));',
      'var payment = paymentExecutor.runAsync(…);',
  ], source=at(('budgeted', 'TicketsApplication.java'), ('budgeted', 'Reservations.java')))}
  <div class="note" style="left:1150px;top:640px;--tilt:-2deg" data-step="1">seat holds:<br>the pool has 20</div>
  <div class="note" style="left:1500px;top:640px;--tilt:-2deg" data-step="2">payments:<br>provider takes 20</div>
  <div class="cond" style="left:110px;top:600px" data-step="3"><span>Same attribute</span><b>now it is a budget, not a thread count</b></div>
  {cue('./run.sh state budgeted', step=3)}
''')

slide('23-result.html', 'result', 'say', 'Saying no to 991 people', 'The rebuild', 'rebuild', 30.5, '''
  <p class="say">Saying no to 991 people<br>got 1,080 more a fast yes.</p>
  <p class="say md" style="top:520px" data-step="1"><em>And nobody’s payment failed.</em></p>
''')

slide('24-check2.html', 'check2', 'check', 'Check 2', 'The rebuild', 'rebuild', 32, '''
  <div class="stamp blue" style="left:110px;top:110px;--tilt:-3deg">Check 2</div>
  <p class="q">Is every limit a number you <em>chose from a dependency</em>, or one left over from a thread pool?</p>
''')

# ---------------------------------------------------------------- deadlines

slide('25-deadlines.html', 'deadlines', 'section', 'Deadlines', 'Deadlines', 'deadlines', 33, '''
  <div class="exp"><small>Part</small>3</div>
  <h2>Deadlines</h2>
  <p class="body" style="top:560px;width:1080px">The provider has a bad day:<br>1,800 ms a charge.<br>The customer waits 500.</p>
''')

slide('26-deadline-code.html', 'deadline-code', 'code', 'We answer at 500 ms', 'Deadlines', 'deadlines', 33.5, f'''
  <h2 class="headline">We answer at 500 ms</h2>
  {code([
      'return CompletableFuture.allOf(parts)',
      ('        .orTimeout(deadlineMillis, MILLISECONDS)', {'hl': 'orTimeout(deadlineMillis, MILLISECONDS)'}),
      '        .whenComplete((done, failure) -> {',
      '            if (failure instanceof TimeoutException) {',
      '                trace(started, "timed out, customer told to try again");',
      '            }',
      '        })',
      '        .thenApply(done -> new Reservation(id, request.seats()));',
  ], source=at(('leak', 'Reservations.java')))}
  <p class="say md" style="top:770px" data-step="1"><em>What happens to the payment?</em></p>
''')

slide('28-cancel-code.html', 'cancel-code', 'code', 'The fix: cancel the work', 'Deadlines', 'deadlines', 35.5, f'''
  <h2 class="headline">The fix: cancel the work</h2>
  {code([
      '        .whenComplete((done, failure) -> {',
      '            if (failure instanceof TimeoutException) {',
      '                trace(started, "timed out, customer told to try again");',
      ('                Stream.of(parts).forEach(part -> part.cancel(true));', {'add': True, 'hl': 'part.cancel(true)', 'hlstep': 1, 'step': 1}),
      '            }',
      '        })',
  ], source=at(('cancel', 'Reservations.java')))}
  <div class="note" style="left:1380px;top:470px;--tilt:-2deg" data-step="1">interrupt every part</div>
  <div class="cond" style="left:110px;top:600px" data-step="2"><span>On Liberty</span><b>cancel(true) on a managed CompletableFuture interrupts the task</b></div>
  <div class="cond" style="left:110px;top:696px" data-step="2"><span>Plain JDK</span><b>CompletableFuture.cancel does not interrupt anything</b></div>
''')

slide('30-key.html', 'key', 'code', 'Charge each reservation once', 'Deadlines', 'deadlines', 37, f'''
  <h2 class="headline">Charge each reservation once</h2>
  {code([
      ('…reserve(… request, @HeaderParam("Idempotency-Key") UUID key) {', {'hl': '@HeaderParam("Idempotency-Key")'}),
      '…',
      ('….header("Idempotency-Key", reservation);', {'hl': 'header("Idempotency-Key", reservation)'}),
  ], source=at(('deadlines', 'ReservationResource.java'), ('deadlines', 'Payments.java')))}
  <div class="cond" style="left:110px;top:460px"><span>No key</span><b>the retry is a new reservation: 2 charges, 8 seat holds</b></div>
  <div class="cond" style="left:110px;top:556px" data-step="1"><span>With the key</span><b>the retry finds the first charge: 201 in 0.026 s, 4 seat holds</b></div>
  <div class="stamp green" style="right:170px;top:700px;--tilt:-6deg;font-size:110px" data-step="2">Charged once</div>
''')

slide('31-scope.html', 'scope', 'code', 'Where this is going: the scope owns the deadline', 'Deadlines', 'deadlines', 38, f'''
  <h2 class="headline sm">Where this is going: the scope owns the deadline</h2>
  {code([
      'try (var scope = StructuredTaskScope.open(',
      '        Joiner.awaitAllSuccessfulOrThrow(),',
      ('        config -> config.withTimeout(Duration.ofMillis(200)))) {', {'hl': 'config.withTimeout(Duration.ofMillis(200))'}),
      '    var reservation = scope.fork(this::reserve);',
      '    scope.join();',
      '    log(reservation.get());',
      '} catch (StructuredTaskScope.TimeoutException e) {',
      '    log("timed out, customer told to try again");',
      '}',
  ])}
  <div class="cond" style="left:110px;top:760px" data-step="1"><span>Preview API</span><b>JDK 25 · JEP 505 · plain Java, not in Liberty yet</b></div>
  <p class="caption" data-step="2">Cancelled at 207 ms, reported at 208 ms: the work stops before the customer is told.</p>
''')

slide('32-check3.html', 'check3', 'check', 'Check 3', 'Deadlines', 'deadlines', 38.5, '''
  <div class="stamp blue" style="left:110px;top:110px;--tilt:-3deg">Check 3</div>
  <p class="q">When a timeout fires, does anything <em>stop the work</em>, and is the retry <em>safe to run twice</em>?</p>
''')

# ---------------------------------------------------------------- wrap

slide('33-watch-list.html', 'watch-list', 'rows', 'What to watch', 'Wrap', 'wrap', 39, '''
  <h2 class="headline">What to watch</h2>
  <ol class="rows tight" style="top:200px">
    <li><b>1</b><span>Requests in flight<small>829 at the big sale. 24 behind the door.</small></span></li>
    <li data-step="1"><b>2</b><span>Waits for a connection<small>9,061 in one big sale.</small></span></li>
    <li data-step="2"><b>3</b><span>Retries<small>4,000: each one is more load.</small></span></li>
    <li data-step="3"><b>4</b><span>Refusals: the 429s you get, the 503s you give<small>4,939 from the provider. 991 from the door.</small></span></li>
    <li data-step="4"><b>5</b><span>p99, second by second<small>An average over the run hides a sale.</small></span></li>
  </ol>
''')

slide('34-checks.html', 'checks', 'rows', 'Three checks to take home', 'Wrap', 'wrap', 40.5, '''
  <h2 class="headline">Three checks to take home</h2>
  <ol class="rows checks" style="top:226px">
    <li><b>1</b><span>For every pool, quota or downstream call: what limits how many requests can <em>wait</em> for it?</span></li>
    <li><b>2</b><span>Is every limit a number you <em>chose from a dependency</em>, or one left over from a thread pool?</span></li>
    <li><b>3</b><span>When a timeout fires, does anything <em>stop the work</em>, and is the retry <em>safe to run twice</em>?</span></li>
  </ol>
''')

slide('35-jobs.html', 'jobs', 'rows', 'Threads got free. Nothing else did.', 'Wrap', 'wrap', 41.5, '''
  <p class="say md">Threads got free.<br>Nothing else did.</p>
  <p class="body" style="top:372px">Sixteen threads were doing three jobs nobody gave them:</p>
  <ol class="rows tight" style="top:470px">
    <li data-step="1"><b>1</b><span>keeping the database under its 20 connections</span></li>
    <li data-step="2"><b>2</b><span>keeping the provider under its limit, so @Retry never fired</span></li>
    <li data-step="3"><b>3</b><span>being the one number in the system that said “enough”</span></li>
  </ol>
  <div class="stamp red" style="right:150px;top:150px;--tilt:-7deg;font-size:110px" data-step="4">Yours now</div>
''')

slide('36-thanks.html', 'thanks', 'say', 'Thank you', 'Wrap', 'wrap', 42.5, '''
  <p class="say xl">Thank you.</p>
  <p class="body lg" style="top:300px">Questions?</p>
  <div class="cond" style="left:110px;top:470px"><span>Code</span><b class="mono">github.com/rokon12/vjakarta</b></div>
  <div class="cond" style="left:110px;top:566px"><span>Every state</span><b class="mono">./run.sh state before | switched | budgeted | deadlines</b></div>
  <div class="tblock" style="left:110px;top:700px;width:560px">
    <div><small>Presented by</small><b>Bazlur Rahman</b></div>
  </div>
  <div class="stamp green" style="right:150px;top:150px;--tilt:-6deg;font-size:100px">Limits written down</div>
''')

print(f'wrote {len(list(OUT.glob("*.html")))} slide files in total')
