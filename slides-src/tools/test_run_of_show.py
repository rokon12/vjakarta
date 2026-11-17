import json
import pathlib
import subprocess
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
PAGE = HERE / 'run-of-show.html'
PHONES = {'small upright': (375, 667), 'upright': (390, 844), 'sideways': (844, 390)}


def measure(width, height):
    run = subprocess.run(['node', 'tools/page_probe.mjs', str(PAGE), str(width), str(height)],
                         cwd=HERE, capture_output=True, text=True, timeout=120)
    if run.returncode:
        raise AssertionError(run.stderr or run.stdout)
    return json.loads(run.stdout)


class RunOfShowOnAPhoneTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.pages = {phone: measure(*size) for phone, size in PHONES.items()}

    def test_no_text_is_smaller_than_16px(self):
        for phone, page in self.pages.items():
            with self.subTest(phone):
                self.assertEqual([], page['smallText'][:5])

    def test_every_tap_target_is_at_least_44px(self):
        for phone, page in self.pages.items():
            with self.subTest(phone):
                self.assertEqual([], page['smallTaps'])

    def test_no_timeline_label_is_cut_off(self):
        for phone, page in self.pages.items():
            with self.subTest(phone):
                self.assertEqual([], page['clipped'])

    def test_the_page_never_scrolls_sideways(self):
        for phone, page in self.pages.items():
            with self.subTest(phone):
                self.assertLessEqual(page['scrollWidth'], page['innerWidth'])

    def test_the_page_runs_without_script_errors(self):
        for phone, page in self.pages.items():
            with self.subTest(phone):
                self.assertNotIn('errors', page)


if __name__ == '__main__':
    unittest.main()
