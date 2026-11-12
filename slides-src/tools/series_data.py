#!/usr/bin/env python3
"""Writes the measured per-second series from docs/series/ into scenes/p99.js."""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent.parent
SERIES = HERE.parent / 'docs' / 'series'
SCENE = HERE / 'scenes' / 'p99.js'
RUNS = ['before-small', 'switched-small', 'switched-big', 'budgeted-big', 'before-big', 'deadlines-big']


def run(name):
    data = json.loads((SERIES / f'{name}.json').read_text())
    seconds = data['seconds']
    entry = {
        'p99': [s['p99'] for s in seconds],
        'refused': [s['503'] for s in seconds],
        'failed': [s['other'] for s in seconds],
        'summary': data['summary'],
    }
    in_flight = SERIES / f'inflight-{name}.json'
    if in_flight.exists():
        entry['inFlight'] = json.loads(in_flight.read_text())
    return entry


def main():
    block = 'const SERIES = ' + json.dumps({name: run(name) for name in RUNS}, separators=(',', ':')) + ';'
    text = SCENE.read_text()
    text, count = re.subn(r'// @data\n.*?\n// @end', f'// @data\n{block}\n// @end', text, flags=re.S)
    if count != 1:
        raise SystemExit('scenes/p99.js needs one // @data ... // @end block')
    SCENE.write_text(text)
    print(f'wrote {len(RUNS)} runs into {SCENE.name}')


if __name__ == '__main__':
    main()
