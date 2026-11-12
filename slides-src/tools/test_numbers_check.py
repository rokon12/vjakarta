import unittest

import numbers_check

DECK = '''<html><body>
<section class="slide" id="a" data-title="A" style="top:580px"><h2>p99 2,325 ms and 9 retries</h2></section>
<section class="slide" id="b"><p>1,234 people, in 2026</p></section>
<script>const notes = {"a": "4,567 words"};</script>
</body></html>'''

SHEET = "Big sale: p99 2,325 ms (2,325–3,741)."


class NumbersCheckTest(unittest.TestCase):

    def test_reports_numbers_missing_from_the_sheet(self):
        self.assertEqual(numbers_check.missing(DECK, SHEET), [("b", "1,234")])

    def test_small_numbers_and_years_need_no_entry(self):
        deck = '<section class="slide" id="c"><p>9 retries in 2025, 10 times</p></section>'
        self.assertEqual(numbers_check.missing(deck, ""), [])

    def test_numbers_must_match_whole_not_inside_another(self):
        deck = '<section class="slide" id="d"><p>18 ms</p></section>'
        self.assertEqual(numbers_check.missing(deck, "1,018 ms"), [("d", "18")])

    def test_digits_inside_a_word_are_not_numbers(self):
        deck = '<section class="slide" id="f"><p>github.com/rokon12/vjakarta and p99</p></section>'
        self.assertEqual(numbers_check.missing(deck, ""), [])

    def test_attributes_scripts_and_notes_are_ignored(self):
        deck = ('<section class="slide" id="e" data-args=\'{"limit": 777}\'>'
                '<script>let x = 888;</script><p>ok</p></section><script>{"e": "999"}</script>')
        self.assertEqual(numbers_check.missing(deck, ""), [])


if __name__ == "__main__":
    unittest.main()
