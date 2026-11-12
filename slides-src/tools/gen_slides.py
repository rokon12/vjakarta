#!/usr/bin/env python3
"""Writes the typographic slides (everything that is not a scene host) into slides/."""
import html
import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parent.parent / 'slides'

TOKEN = re.compile(
    r'(?P<s>"[^"]*")'
    r'|(?P<c>//.*$)'
    r'|(?P<k>\b(?:private|final|new|void|if|return|try|finally|catch|throw|throws|synchronized|boolean|var|this)\b)'
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


def code(lines, style=''):
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
        rows.append(f'<div class="{cls}"{step}><i>{n}</i>{" " * indent}{body_html}</div>')
    attr = f' style="{style}"' if style else ''
    return f'<div class="code"{attr}>' + ''.join(rows) + '</div>'


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


# ---------------------------------------------------------------- opening

slide('01-title.html', 'title', 'title', 'The chaos and fun of virtual threads', 'Intro', 'intro', 0, '''
  <h1>The chaos and fun<br>of virtual threads</h1>
  <p class="lede">What actually breaks when you push the limits</p>
  <div class="scene-box" style="left:110px;top:590px;width:1230px;height:380px" data-scene="titletrace"></div>
  <div class="tblock" style="left:1380px;top:618px;width:440px">
    <div><small>Presented by</small><b>Bazlur Rahman</b></div>
    <div><small>Conditions</small><b class="s">JDK 25 · three live demos</b></div>
  </div>
''')

slide('02-hands.html', 'hands', 'ask', 'Hands up if', 'Intro', 'intro', 0, '''
  <h2 class="headline">Hands up if</h2>
  <ol class="rows" style="top:240px">
    <li><b>1</b><span>you run Java 21 or later in production</span></li>
    <li data-step="1"><b>2</b><span>virtual threads are switched on</span></li>
    <li data-step="2"><b>3</b><span>you changed anything else when you switched them on</span></li>
  </ol>
  <div class="note" style="left:1010px;top:760px;--tilt:-3deg" data-step="2">that last one is this talk</div>
  <svg class="pen" data-step="2"><path filter="url(#rough)" d="M1000 790 C 930 800, 880 770, 850 716" marker-end="url(#arrow-red)"/></svg>
''')

slide('03-one-line.html', 'one-line', 'say', 'Turning them on is one line', 'Intro', 'intro', 1, '''
  <p class="say">Turning them on<br>is one line.</p>
  <div class="cond" style="left:110px;top:420px"><span>application.properties</span><b class="mono">spring.threads.virtual.enabled=true</b></div>
  <p class="body lg" style="top:590px" data-step="1">Three things can go wrong afterwards.</p>
  <p class="body lg" style="top:690px" data-step="2">None of them looks like <span class="scrib" data-bleed>a bug in code review<svg viewBox="0 0 300 26" preserveAspectRatio="none"><path d="M3 15 C 50 4, 96 24, 150 12 S 250 6, 297 16" fill="none" stroke="#d31f2b" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></span>.</p>
''')

slide('04-plan.html', 'plan', 'rows', 'One service, three ways to break it', 'Intro', 'intro', 2, '''
  <h2 class="headline sm">One small service, three ways to break it</h2>
  <ol class="rows" style="top:226px">
    <li><b>1</b><span>The database slows down<small>Every request gets a thread. The pool behind them has eight connections.</small></span></li>
    <li data-step="1"><b>2</b><span>Requests run one at a time<small>A card is charged while a lock is held.</small></span></li>
    <li data-step="2"><b>3</b><span>Work continues after a timeout<small>The customer is told it failed. The work carries on.</small></span></li>
  </ol>
  <div class="cond" style="left:110px;top:760px" data-step="3"><span>Method</span><b>break it · read what it prints · fix it</b></div>
  <div class="cond" style="left:110px;top:856px" data-step="3"><span>Every demo</span><b><span class="mono">java File.java</span> · no build, no framework</b></div>
''')

# ---------------------------------------------------------------- primer

slide('07-intro-ask.html', 'intro-ask', 'say', 'A thousand requests', 'Primer', 'primer', 6, f'''
  <p class="say">1,000 requests.<br>Each waits 100 ms.</p>
  <div class="tblock meter" style="left:110px;top:440px;width:800px">
    <div><small>50 platform threads</small><b><span class="q">?</span> ms</b></div>
  </div>
  <div class="tblock meter" style="left:1020px;top:440px;width:800px" data-step="1">
    <div><small>One virtual thread each</small><b><span class="q">?</span> ms</b></div>
  </div>
  {cue('./run.sh intro', step=1)}
''')

slide('09-cheated.html', 'cheated', 'say', 'And I cheated', 'Primer', 'primer', 9, '''
  <p class="say xl">And I cheated.</p>
  <p class="body lg" style="top:330px;width:1500px" data-step="1">My database took a thousand queries at once without blinking.</p>
  <p class="say" style="top:560px" data-step="1"><em>Yours won’t.</em></p>
''')

# ---------------------------------------------------------------- demo 1

slide('10-demo1.html', 'demo1', 'section', 'Demo 1: the database slows down', 'Demo 1', 'demo1', 10, '''
  <div class="exp"><small>Demo</small>1</div>
  <h2>The database<br>slows down</h2>
  <p class="body" style="top:560px;width:1080px">200 requests a second.<br>8 database connections.<br>20 ms a query.</p>
''')

slide('12-demo1-ask.html', 'demo1-ask', 'say', 'How long is the service slow?', 'Demo 1', 'demo1', 12, f'''
  <p class="say">The database gets<br>four times slower<br>for three seconds.</p>
  <p class="say md" style="top:580px" data-step="1"><em>How long is the service slow?</em></p>
  {cue('./run.sh overload', step=1)}
''')

slide('14-demo1-why.html', 'demo1-why', 'rows', 'The pool was your limit', 'Demo 1', 'demo1', 16, '''
  <h2 class="headline">The pool was your limit</h2>
  <ol class="rows tight" style="top:226px">
    <li><b>200</b><span>platform threads: at most 200 requests inside<small>An accident, but a limit.</small></span></li>
    <li data-step="1"><b class="da" style="font-size:150px;padding-top:0">∞</b><span>virtual threads: every request gets in and parks on the pool<small>Parked threads are almost free, so nothing pushes back.</small></span></li>
  </ol>
  <div class="cond" style="left:110px;top:560px" data-step="2"><span>HikariCP</span><b>a request waits up to 30 s for a free connection</b></div>
  <p class="say sm" style="top:672px" data-step="3">A semaphore limits how many run.<br>It does not limit how many <em>wait</em>.</p>
''')

slide('15-demo1-fix.html', 'demo1-fix', 'code', 'The fix: say no at the door', 'Demo 1', 'demo1', 19, f'''
  <h2 class="headline">The fix: say no at the door</h2>
  {code([
      ('private final Semaphore admission = new Semaphore(32);', {'hl': True, 'hlstep': 1, 'step': 1}),
      '',
      'private void handle() {',
      ('    if (!admission.tryAcquire()) {', {'hl': True, 'hlstep': 2, 'step': 2}),
      ('        rejected.incrementAndGet();', {'hl': True, 'hlstep': 2, 'step': 2}),
      ('        return;', {'hl': True, 'hlstep': 2, 'step': 2}),
      ('    }', {'hl': True, 'hlstep': 2, 'step': 2}),
      '    try {',
      '        reserve();',
      '    } finally {',
      ('        admission.release();', {'hl': True, 'hlstep': 3, 'step': 3}),
      '    }',
      '}',
  ])}
  <svg class="pen">
    {circle(1, 1484, 264, 'M1406 264 H1450', 1)}
    {circle(2, 1104, 513, 'M1010 410 h18 v206 h-18 M1028 513 H1070', 2)}
    {circle(3, 934, 824, 'M854 824 H900', 3)}
  </svg>
  <div class="note" style="left:1530px;top:240px;--tilt:-2deg" data-step="1">32 inside,<br>no more</div>
  <div class="note" style="left:1150px;top:466px;--tilt:-2deg" data-step="2">no permit?<br>turn it away, fast</div>
  <div class="note" style="left:980px;top:776px;--tilt:-2deg" data-step="3">always<br>hand it back</div>
  <div class="cond" style="left:760px;top:632px" data-step="4"><span>Why 32</span><b>8 running + 24 waiting ≈ 330 ms</b></div>
  {cue('./run.sh bounded', step=4)}
''', steps=4)

slide('18-check1.html', 'check1', 'check', 'Check 1', 'Demo 1', 'demo1', 23.5, '''
  <div class="stamp blue" style="left:110px;top:110px;--tilt:-3deg">Check 1</div>
  <p class="q">For every pool, quota or downstream call: what limits how many requests can <em>wait</em> for it?</p>
''')

# ---------------------------------------------------------------- demo 2

slide('19-demo2.html', 'demo2', 'section', 'Demo 2: requests run one at a time', 'Demo 2', 'demo2', 24, '''
  <div class="exp"><small>Demo</small>2</div>
  <h2>Requests run<br>one at a time</h2>
  <p class="body" style="top:560px;width:1080px">40 seats.<br>50 customers at the same moment.<br>80 ms to charge a card.</p>
''')

slide('20-demo2-ask.html', 'demo2-ask', 'code', 'One lock around everything', 'Demo 2', 'demo2', 26, f'''
  <h2 class="headline">It must never oversell</h2>
  {code([
      ('synchronized boolean reserve() {', {'hl': 'synchronized'}),
      '    if (seats == 0) return false;',
      ('    chargeCard();', {'hl': True, 'free': True}),
      '    seats--;',
      '    return true;',
      '}',
  ])}
  <svg class="pen"><path filter="url(#rough)" d="M560 376 H640"/></svg>
  <div class="note" style="left:660px;top:346px;--tilt:-2deg">80 ms at the payment provider</div>
  <p class="say md" style="top:640px" data-step="1">50 virtual threads, 80 ms each.<br><em>How long?</em></p>
  {cue('./run.sh wide', step=1)}
''')

slide('23-demo2-fix.html', 'demo2-fix', 'code', 'The fix: charge outside the lock', 'Demo 2', 'demo2', 32, f'''
  <h2 class="headline sm">The fix: charge outside the lock</h2>
  {code([
      'boolean reserve() throws InterruptedException {',
      ('    synchronized (this) {', {'hl': True, 'hlstep': 1, 'step': 1}),
      ('        if (seats == 0) return false;', {'hl': True, 'hlstep': 1, 'step': 1}),
      ('        seats--;', {'hl': True, 'hlstep': 1, 'step': 1}),
      ('    }', {'hl': True, 'hlstep': 1, 'step': 1}),
      '    try {',
      ('        chargeCard();', {'hl': True, 'hlstep': 2, 'step': 2, 'free': True}),
      '    } catch (Exception e) {',
      ('        synchronized (this) { seats++; }', {'hl': True, 'hlstep': 3, 'step': 3}),
      ('        throw e;', {'step': 3}),
      '    }',
      '    return true;',
      '}',
  ])}
  <svg class="pen">
    {circle(1, 1142, 403, 'M1048 300 h18 v206 h-18 M1066 403 H1108', 1)}
    {circle(2, 780, 600, 'M700 600 H746', 2)}
    {circle(3, 1186, 712, 'M1110 712 H1152', 3)}
  </svg>
  <div class="note" style="left:1190px;top:356px;--tilt:-2deg" data-step="1">take the seat:<br>microseconds under a lock</div>
  <div class="note" style="left:828px;top:574px;--tilt:-2deg" data-step="2">80 ms, no lock held</div>
  <div class="note" style="left:1234px;top:664px;--tilt:-2deg" data-step="3">a narrow lock<br>needs an undo</div>
  {cue('./run.sh narrow', step=4)}
''', steps=4)

slide('25-demo2-hides.html', 'demo2-hides', 'rows', 'Where it hides', 'Demo 2', 'demo2', 36, '''
  <h2 class="headline">Where it hides</h2>
  <ol class="rows tight" style="top:226px">
    <li><b>1</b><span>a <code>synchronized</code> cache loader that calls the database</span></li>
    <li data-step="1"><b>2</b><span>a token refresh under a lock</span></li>
    <li data-step="2"><b>3</b><span>a row lock held across an HTTP call</span></li>
  </ol>
  <p class="body" style="top:650px;width:1700px" data-step="3">With 200 threads you may never have noticed.<br>With a thread per request, <span class="red">the lock is the only queue left</span>.</p>
''')

slide('26-check2.html', 'check2', 'check', 'Check 2', 'Demo 2', 'demo2', 37, '''
  <div class="stamp blue" style="left:110px;top:110px;--tilt:-3deg">Check 2</div>
  <p class="q">Is any lock held across a <em>database or network call</em>?</p>
''')

# ---------------------------------------------------------------- demo 3

slide('27-demo3.html', 'demo3', 'section', 'Demo 3: work continues after a timeout', 'Demo 3', 'demo3', 38, '''
  <div class="exp"><small>Demo</small>3</div>
  <h2>Work continues<br>after a timeout</h2>
  <p class="body" style="top:560px;width:1080px">The payment provider has a bad day:<br>1,800 ms an answer.<br>We wait 200.</p>
''')

slide('28-demo3-ask.html', 'demo3-ask', 'code', 'We wait 200 ms', 'Demo 3', 'demo3', 40, f'''
  <h2 class="headline">We won’t make them wait</h2>
  {code([
      'Future<String> reservation = executor.submit(this::reserve);',
      'try {',
      ('    log(reservation.get(200, MILLISECONDS));', {'hl': 'get(200, MILLISECONDS)'}),
      '} catch (TimeoutException e) {',
      '    log("timed out, customer told to try again");',
      '}',
  ])}
  <p class="say md" style="top:652px" data-step="1"><em>What happens to the payment?</em></p>
  {cue('./run.sh leak', step=1)}
''')

slide('30-demo3-fix.html', 'demo3-fix', 'code', 'The fix: cancel the work', 'Demo 3', 'demo3', 45, f'''
  <h2 class="headline">The fix: cancel the work</h2>
  {code([
      'try {',
      '    log(reservation.get(200, MILLISECONDS));',
      '} catch (TimeoutException e) {',
      '    log("timed out, customer told to try again");',
      ('    reservation.cancel(true);', {'hl': True, 'hlstep': 1, 'step': 1}),
      '}',
  ])}
  <svg class="pen">{circle(1, 950, 488, 'M874 488 H916', 1)}</svg>
  <div class="note" style="left:998px;top:462px;--tilt:-2deg" data-step="1">one line: interrupt the task</div>
  <div class="cond" style="left:110px;top:640px" data-step="2"><span>Works when</span><b>the task is blocked: a sleep, a socket read, a lock wait</b></div>
  <div class="cond" style="left:110px;top:736px" data-step="2"><span>Fails when</span><b>the task swallows the interrupt, or never blocks</b></div>
  {cue('./run.sh cancel', step=2)}
''')

slide('32-demo3-scope.html', 'demo3-scope', 'code', 'Better: the scope owns the deadline', 'Demo 3', 'demo3', 48, f'''
  <h2 class="headline sm">Better: the scope owns the deadline</h2>
  {code([
      'try (var scope = StructuredTaskScope.open(',
      '        Joiner.awaitAllSuccessfulOrThrow(),',
      ('        config -> config.withTimeout(Duration.ofMillis(200)))) {', {'hl': 'config.withTimeout(Duration.ofMillis(200))', 'hlstep': 1, 'step': 1}),
      ('    var reservation = scope.fork(this::reserve);', {'hl': 'scope.fork(this::reserve)', 'hlstep': 2, 'free': True, 'step': 2}),
      ('    scope.join();', {'hl': 'scope.join()', 'hlstep': 2, 'free': True, 'step': 2}),
      '    log(reservation.get());',
      '} catch (StructuredTaskScope.TimeoutException e) {',
      '    log("timed out, customer told to try again");',
      '}',
  ])}
  <div class="note" style="left:1250px;top:250px;--tilt:-2deg" data-step="1">the deadline lives<br>on the scope</div>
  <div class="note" style="left:1300px;top:476px;font-size:44px;--tilt:-2deg" data-step="2">nothing leaves the scope<br>while its work is running</div>
  <div class="cond" style="left:110px;top:800px" data-step="3"><span>Preview API</span><b>JDK 25 · JEP 505 · <span class="mono">--enable-preview</span></b></div>
  {cue('./run.sh structured', step=3)}
''')

slide('34-demo3-tieback.html', 'demo3-tieback', 'say', 'The callers left. The work stayed.', 'Demo 3', 'demo3', 50, '''
  <p class="say">Remember 322<br>requests in flight?</p>
  <p class="body lg" style="top:420px" data-step="1">Their callers had timeouts too.</p>
  <p class="say" style="top:560px" data-step="2">The callers left.<br>The work <em>stayed</em>.</p>
''')

slide('35-check3.html', 'check3', 'check', 'Check 3', 'Demo 3', 'demo3', 50.5, '''
  <div class="stamp blue" style="left:110px;top:110px;--tilt:-3deg">Check 3</div>
  <p class="q">When a timeout fires, does anything <em>stop the work</em>, and does the work respond to interruption?</p>
''')

# ---------------------------------------------------------------- wrap

slide('36-jobs.html', 'jobs', 'rows', 'Threads got free. Nothing else did.', 'Wrap', 'wrap', 51, '''
  <p class="say md">Threads got free.<br>Nothing else did.</p>
  <p class="body" style="top:372px">The thread pool was doing three jobs nobody gave it:</p>
  <ol class="rows tight" style="top:470px">
    <li data-step="1"><b>1</b><span>limiting load on the database</span></li>
    <li data-step="2"><b>2</b><span>hiding wide locks</span></li>
    <li data-step="3"><b>3</b><span>capping how much abandoned work could pile up</span></li>
  </ol>
  <div class="stamp red" style="right:150px;top:560px;--tilt:-7deg;font-size:110px" data-step="4">Yours now</div>
''')

slide('37-checks.html', 'checks', 'rows', 'Three checks to take home', 'Wrap', 'wrap', 52, '''
  <h2 class="headline">Three checks to take home</h2>
  <ol class="rows checks" style="top:226px">
    <li><b>1</b><span>For every pool, quota or downstream call: what limits how many requests can <em>wait</em> for it?</span></li>
    <li><b>2</b><span>Is any lock held across a <em>database or network call</em>?</span></li>
    <li><b>3</b><span>When a timeout fires, does anything <em>stop the work</em>, and does the work respond to interruption?</span></li>
  </ol>
''')

slide('38-thanks.html', 'thanks', 'say', 'Thank you', 'Wrap', 'wrap', 54, '''
  <p class="say xl">Thank you.</p>
  <p class="body lg" style="top:300px">Questions?</p>
  <div class="cond" style="left:110px;top:470px"><span>Code</span><b class="mono">github.com/rokon12/vfun</b></div>
  <div class="cond" style="left:110px;top:566px"><span>Every demo</span><b><span class="mono">java File.java</span> · JDK 25, no dependencies</b></div>
  <div class="tblock" style="left:110px;top:700px;width:560px">
    <div><small>Presented by</small><b>Bazlur Rahman</b></div>
  </div>
  <div class="stamp green" style="right:170px;top:330px;--tilt:-6deg;font-size:120px">All 3 fixed</div>
''')

print(f'wrote {len(list(OUT.glob("*.html")))} slide files in total')
