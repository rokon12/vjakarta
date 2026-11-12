#!/usr/bin/env python3
"""Checks that every line of code on a slide is in the tagged source it cites."""
import html
import re
import subprocess
import sys
from functools import cache

SECTION = re.compile(r'<section\b[^>]*\bid="([^"]+)"[^>]*>(.*?)</section>', re.S)
BLOCK = re.compile(r'<div class="code"[^>]*\bdata-source="([^"]+)"[^>]*>((?:<div class="ln[^"]*"[^>]*>.*?</div>)*)</div>', re.S)
LINE = re.compile(r'<div class="ln[^"]*"[^>]*>(.*?)</div>', re.S)
NUMBER = re.compile(r'^<i>\d+</i>')
TAG = re.compile(r'<[^>]+>')


@cache
def source_lines(repo, ref):
    text = subprocess.run(['git', '-C', str(repo), 'show', ref], capture_output=True, text=True, check=True).stdout
    return {line.strip() for line in text.splitlines()}


def found_in(line, known):
    if '…' not in line:
        return line in known
    pattern = re.compile('.*'.join(re.escape(part) for part in line.split('…')))
    return any(pattern.fullmatch(candidate) for candidate in known)


def shown(row):
    return html.unescape(TAG.sub('', NUMBER.sub('', row))).strip()


def missing(deck_html, repo):
    found = []
    for slide_id, body in SECTION.findall(deck_html):
        for sources, rows in BLOCK.findall(body):
            known = set().union(*(source_lines(repo, ref) for ref in sources.split()))
            for row in LINE.findall(rows):
                line = shown(row)
                if line and line != '…' and not found_in(line, known):
                    found.append((slide_id, line))
    return found


def main(deck_path, repo):
    with open(deck_path) as deck:
        found = missing(deck.read(), repo)
    for slide_id, line in found:
        print(f'{slide_id}: {line}')
    print('CODE OK' if not found else f'{len(found)} line(s) not in their tagged source')
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main(*sys.argv[1:3]))
