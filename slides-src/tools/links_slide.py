#!/usr/bin/env python3
"""Writes slides/37-links.html: the book cover, a QR code to the book, and where to find the speaker.

It needs segno for the QR code:  pip install segno
The cover is assets/book-cover.jpg; it is embedded so the deck stays one file."""
import base64
import io
import pathlib

import segno

BUILD = pathlib.Path(__file__).resolve().parent.parent
BOOK_URL = 'https://learning.oreilly.com/library/view/modern-concurrency-in/9781098165406/'
LINKS = [
    ('Web', 'bazlur.com'),
    ('GitHub', 'rokon12/vfun'),
    ('X', '@bazlur_rahman'),
    ('Bluesky', '@bazlur.ca'),
    ('LinkedIn', 'in/bazlur'),
]

cover = base64.b64encode((BUILD / 'assets' / 'book-cover.jpg').read_bytes()).decode('ascii')

out = io.BytesIO()
segno.make(BOOK_URL, error='m').save(out, kind='svg', border=4, dark='#0e1b2c', light='#ffffff',
                                     xmldecl=False, svgns=False, nl=False, omitsize=True)
qr = out.getvalue().decode('utf-8')

rows = '\n'.join(f'    <div class="cond"><span>{label}</span><b class="mono">{value}</b></div>' for label, value in LINKS)

(BUILD / 'slides' / '37-links.html').write_text(f'''<section class="slide" id="links" data-layout="links" data-title="The long version" data-section="Wrap" data-section-key="wrap" data-min="43">
  <h2 class="headline">The long version</h2>
  <p class="book-title"><b>Modern Concurrency in Java</b><small>Virtual threads, structured concurrency, and beyond</small></p>
  <div class="qr">{qr}<small>The book · O’Reilly</small></div>
  <div class="links">
{rows}
  </div>
  <div class="note" style="left:156px;top:826px;--tilt:-2deg">scan for the book</div>
  <svg class="pen"><path filter="url(#rough)" d="M144 868 C 108 866, 96 846, 110 820" marker-end="url(#arrow-red)"/></svg>
  <figure class="book"><img alt="Modern Concurrency in Java, O’Reilly, by A N M Bazlur Rahman" src="data:image/jpeg;base64,{cover}"></figure>
</section>
''', encoding='utf-8')
print('wrote slides/37-links.html,', len(cover) * 3 // 4 // 1024, 'KB cover,', len(qr), 'bytes of QR')
