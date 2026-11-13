import pathlib
import subprocess
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent


def build(*args):
    return subprocess.run(['node', 'build.mjs', *args], cwd=HERE, capture_output=True, text=True)


class BuildTest(unittest.TestCase):

    def tearDown(self):
        (HERE / 'themes' / 'zz-missing.css').unlink(missing_ok=True)

    def test_unknown_theme_fails_and_names_the_themes(self):
        run = build('--theme', 'nope', '--out', 'tmp/nope.html')
        self.assertEqual(1, run.returncode)
        self.assertIn('unknown theme: nope (have: blueprint', run.stderr)

    def test_a_missing_font_fails_the_build(self):
        (HERE / 'themes' / 'zz-missing.css').write_text(
            '@font-face { font-family: X; src: url("font:Missing.woff2") format("woff2"); }\n')
        run = build('--theme', 'zz-missing', '--out', 'tmp/missing.html')
        self.assertEqual(1, run.returncode)
        self.assertIn('missing font: assets/fonts/Missing.woff2', run.stderr)


if __name__ == '__main__':
    unittest.main()
