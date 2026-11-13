import json
import pathlib
import subprocess
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
BLUEPRINT = HERE / 'tmp' / 'blueprint.html'


def probe(deck, mode, *args):
    run = subprocess.run(['node', 'tools/style_probe.mjs', str(deck), mode, *map(str, args)],
                         cwd=HERE, capture_output=True, text=True, timeout=300)
    if run.returncode:
        raise AssertionError(run.stderr or run.stdout)
    return json.loads(run.stdout)


def probe_styles(deck, spec):
    path = HERE / 'tmp' / 'probe-spec.json'
    path.write_text(json.dumps(spec))
    return probe(deck, 'styles', path)


class StyleProbeTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        subprocess.run(['node', 'build.mjs', '--theme', 'blueprint', '--out', str(BLUEPRINT)],
                       cwd=HERE, check=True, capture_output=True)

    def test_reads_the_blueprint_paper(self):
        values = probe_styles(BLUEPRINT, [{'state': 'title.0', 'selector': '#stage', 'props': ['background-color']}])
        self.assertEqual('rgb(238, 242, 243)', values[0]['values']['background-color'])

    def test_finds_the_blueprint_yellow(self):
        self.assertIn('rgb(255, 196, 0)', [c['value'] for c in probe(BLUEPRINT, 'colors')])

    def test_reports_low_contrast_text(self):
        found = probe(HERE / 'tools' / 'fixtures' / 'contrast.html', 'contrast')
        self.assertEqual(['light blue on white'], [f['text'] for f in found])

    def test_lists_every_state_the_engine_has(self):
        self.assertEqual(102, len(probe(BLUEPRINT, 'states')))


if __name__ == '__main__':
    unittest.main()
