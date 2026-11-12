#!/usr/bin/env python3
"""Lists every number on a slide that the numbers sheet does not contain."""
import html
import re
import sys

SECTION = re.compile(r'<section\b[^>]*\bid="([^"]+)"[^>]*>(.*?)</section>', re.S)
HIDDEN = re.compile(r'<(script|style)\b.*?</\1>', re.S)
TAG = re.compile(r'<[^>]+>')
NUMBER = re.compile(r'(?<![A-Za-z])\d[\d,]*(?:\.\d+)?(?![A-Za-z])')
FREE = {str(n) for n in range(11)} | {'2025', '2026'}


def numbers(text):
    return [match.rstrip(',') for match in NUMBER.findall(text)]


def visible(body):
    return html.unescape(TAG.sub(' ', HIDDEN.sub(' ', body)))


def missing(deck_html, sheet_text):
    known = set(numbers(sheet_text)) | FREE
    found = []
    for slide_id, body in SECTION.findall(deck_html):
        for number in numbers(visible(body)):
            if number not in known and (slide_id, number) not in found:
                found.append((slide_id, number))
    return found


def main(deck_path, sheet_path):
    with open(deck_path) as deck, open(sheet_path) as sheet:
        found = missing(deck.read(), sheet.read())
    for slide_id, number in found:
        print(f'{slide_id}: {number}')
    print('NUMBERS OK' if not found else f'{len(found)} number(s) not in the sheet')
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main(*sys.argv[1:3]))
