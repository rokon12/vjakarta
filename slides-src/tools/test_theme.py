import json
import pathlib
import subprocess
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
DECK = HERE.parent / 'slides.html'
BLUEPRINT = HERE / 'tmp' / 'blueprint.html'


def probe(deck, mode, *args):
    run = subprocess.run(['node', 'tools/style_probe.mjs', str(deck), mode, *map(str, args)],
                         cwd=HERE, capture_output=True, text=True, timeout=600)
    if run.returncode:
        raise AssertionError(run.stderr or run.stdout)
    return json.loads(run.stdout)


def style(state, selector, *props, pseudo=None, deck=DECK):
    path = HERE / 'tmp' / 'theme-spec.json'
    path.write_text(json.dumps([{'state': state, 'selector': selector, 'pseudo': pseudo, 'props': list(props)}]))
    values = probe(deck, 'styles', path)[0]['values']
    if values is None:
        raise AssertionError(f'{selector} not found in {state}')
    return tuple(values[p] for p in props)


class JakartaLightTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        subprocess.run(['node', 'build.mjs', '--out', str(DECK)], cwd=HERE, check=True, capture_output=True)
        subprocess.run(['node', 'build.mjs', '--theme', 'blueprint', '--out', str(BLUEPRINT)],
                       cwd=HERE, check=True, capture_output=True)

    def test_the_stage_is_white_without_graph_paper(self):
        self.assertEqual(('rgb(255, 255, 255)', 'none'), style('title.0', '#stage', 'background-color', 'background-image'))

    def test_headlines_are_dark_purple_inter_800(self):
        color, family, weight = style('big.0', '.headline', 'color', 'font-family', 'font-weight')
        self.assertEqual('rgb(27, 32, 139)', color)
        self.assertTrue(family.startswith('Inter'), family)
        self.assertEqual('800', weight)

    def test_the_title_is_dark_purple_inter(self):
        color, family = style('title.0', '[data-layout="title"] h1', 'color', 'font-family')
        self.assertEqual('rgb(27, 32, 139)', color)
        self.assertTrue(family.startswith('Inter'), family)

    def test_captions_are_grey_inter(self):
        color, family = style('big.1', '.caption', 'color', 'font-family')
        self.assertEqual('rgb(47, 74, 96)', color)
        self.assertTrue(family.startswith('Inter'), family)

    def test_the_terminal_cue_is_orange(self):
        self.assertEqual('rgb(255, 113, 16)', style('before-run.1', '.cue', 'background-color')[0])

    def test_code_sits_on_a_pale_panel_in_dark_purple(self):
        panel, = style('budgets-code.0', '.code', 'background-color')
        line, = style('budgets-code.0', '.code .ln:not([data-step])', 'color')
        keyword, = style('budgets-code.0', '.code .k', 'color')
        self.assertEqual(('rgb(243, 245, 255)', 'rgb(27, 32, 139)', 'rgb(24, 44, 185)'), (panel, line, keyword))

    def test_the_highlighter_is_orange_not_yellow(self):
        image, color = style('budgets-code.1', '.code .hl', 'background-image', 'color')
        self.assertIn('rgba(255, 113, 16, 0.18)', image)
        self.assertEqual('rgb(208, 87, 0)', color)

    def test_the_left_stripe_has_the_three_colors(self):
        image, width = style('title.0', '#stage', 'background-image', 'width', pseudo='::before')
        for rgb in ('rgb(27, 32, 139)', 'rgb(24, 44, 185)', 'rgb(255, 113, 16)'):
            self.assertIn(rgb, image)
        self.assertEqual('12px', width)

    def test_scene_text_keeps_its_face(self):
        for state, selector in [('big.1', 'svg text'), ('flood.1', 'svg .lbl'), ('service.1', 'svg .val')]:
            self.assertEqual(style(state, selector, 'font-family', deck=BLUEPRINT),
                             style(state, selector, 'font-family'), selector)

    def test_stamps_and_handwriting_keep_their_faces(self):
        for state, selector in [('door.2', '.stamp'), ('switch.0', '.note')]:
            self.assertEqual(style(state, selector, 'font-family', deck=BLUEPRINT),
                             style(state, selector, 'font-family'), selector)

    def test_inter_is_embedded_and_loaded(self):
        families = probe(DECK, 'fonts')['families']
        self.assertIn({'family': 'Inter', 'status': 'loaded'}, families)
        self.assertIn('url("data:font/woff2;base64,', DECK.read_text())

    def test_switching_back_is_one_constant(self):
        self.assertIn("const DEFAULT_THEME = 'jakarta-light';", (HERE / 'build.mjs').read_text())


if __name__ == '__main__':
    unittest.main()
