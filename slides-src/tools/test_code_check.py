import pathlib
import unittest

import code_check

REPO = pathlib.Path(__file__).resolve().parents[2]
APP = "src/main/java/ca/bazlur/tickets/TicketsApplication.java"


def deck(source, *lines):
    rows = "".join(f'<div class="ln"><i>{n}</i>{line}</div>' for n, line in enumerate(lines, 1))
    return f'<section class="slide" id="s"><div class="code" data-source="{source}">{rows}</div></section>'


class CodeCheckTest(unittest.TestCase):

    def test_reports_a_line_the_tag_does_not_have(self):
        html = deck(f"switched:{APP}",
                    '@ManagedExecutorDefinition(name = <span class="s">&quot;java:app/concurrent/reservations&quot;</span>, virtual = true)',
                    'invented();',
                    '…',
                    '')
        self.assertEqual(code_check.missing(html, REPO), [("s", "invented();")])

    def test_a_line_may_come_from_any_listed_source(self):
        html = deck(f"before:{APP} switched:{APP}",
                    '@ManagedExecutorDefinition(name = "java:app/concurrent/reservations", maxAsync = 16)',
                    '@ManagedExecutorDefinition(name = "java:app/concurrent/reservations", virtual = true)')
        self.assertEqual(code_check.missing(html, REPO), [])

    def test_an_ellipsis_inside_a_line_stands_for_any_text(self):
        html = deck(f"switched:{APP}",
                    '@ManagedExecutorDefinition(name = "…", virtual = true)',
                    '@ManagedExecutorDefinition(name = "…", maxAsync = 16)')
        self.assertEqual(code_check.missing(html, REPO),
                         [("s", '@ManagedExecutorDefinition(name = "…", maxAsync = 16)')])

    def test_the_wrong_tag_is_caught(self):
        html = deck(f"before:{APP}",
                    '@ManagedExecutorDefinition(name = "java:app/concurrent/reservations", virtual = true)')
        self.assertEqual(len(code_check.missing(html, REPO)), 1)


if __name__ == "__main__":
    unittest.main()
