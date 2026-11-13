import json
import pathlib
import re
import subprocess
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
DECK = HERE.parent / 'slides.html'
HINT = 'Turn your phone sideways for a bigger slide · swipe to move'


def probe(mode, *args, device):
    run = subprocess.run(['node', 'tools/style_probe.mjs', str(DECK), mode, *map(str, args), '--device', device],
                         cwd=HERE, capture_output=True, text=True, timeout=300)
    if run.returncode:
        raise AssertionError(run.stderr or run.stdout)
    return json.loads(run.stdout)


def style(state, selector, *props, device):
    path = HERE / 'tmp' / 'phone-spec.json'
    path.write_text(json.dumps([{'state': state, 'selector': selector, 'props': list(props)}]))
    values = probe('styles', path, device=device)[0]['values']
    return tuple(values[p] for p in props)


def ratio(a, b):
    def lum(rgb):
        r, g, b = (int(v) / 255 for v in re.findall(r'[\d.]+', rgb)[:3])
        ch = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)


class PhoneTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        subprocess.run(['node', 'build.mjs', '--out', str(DECK)], cwd=HERE, check=True, capture_output=True)

    def test_upright_phone_shows_the_hint_under_the_slide(self):
        page = probe('page', device='phone-upright')
        self.assertEqual(f'"{HINT}"', page['hint']['content'])
        self.assertGreaterEqual(page['hint']['rect']['top'], page['stage']['bottom'])
        self.assertLessEqual(page['hint']['rect']['bottom'], page['innerHeight'])
        self.assertLessEqual(page['scrollWidth'], page['innerWidth'])

    def test_sideways_phone_has_no_hint(self):
        self.assertEqual('none', probe('page', device='phone-sideways')['hint']['display'])

    def test_desktop_has_no_hint(self):
        self.assertEqual('none', probe('page', device='desktop')['hint']['display'])

    def test_no_fullscreen_button_on_touch_screens(self):
        self.assertEqual(('none',), style('title.0', '#deck-fs', 'display', device='phone-sideways'))

    def test_taps_are_not_eaten_by_double_tap_zoom(self):
        self.assertEqual(('manipulation',), style('title.0', '#viewport', 'touch-action', device='phone-upright'))

    def test_hint_is_readable(self):
        page = probe('page', device='phone-upright')
        self.assertGreaterEqual(float(page['hint']['fontSize'].rstrip('px')), 16)
        self.assertGreaterEqual(ratio(page['hint']['color'], page['background']), 4.5)

    def test_swiping_left_moves_forward(self):   # guard: the engine already swipes; it must keep working
        self.assertEqual('#hands', probe('swipe', 'title.0', 'left', device='phone-sideways')['hash'].split('.')[0])

    def test_swiping_right_moves_back(self):   # guard: a tap would go forward, so this proves it was a swipe
        self.assertEqual('#title', probe('swipe', 'hands.0', 'right', device='phone-sideways')['hash'].split('.')[0])


if __name__ == '__main__':
    unittest.main()
