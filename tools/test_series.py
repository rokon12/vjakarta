import pathlib
import unittest

import series

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "small.csv"


class SeriesTest(unittest.TestCase):

    def setUp(self):
        self.requests, self.dropped = series.load(FIXTURE)

    def test_per_second_counts(self):
        rows = series.per_second(self.requests)
        self.assertEqual([row["requests"] for row in rows], [6, 4])
        self.assertEqual([(row["201"], row["503"], row["other"]) for row in rows], [(4, 1, 1), (3, 1, 0)])

    def test_p99_uses_nearest_rank(self):
        self.assertEqual(series.percentile(list(range(10, 101, 10)), 99), 100)
        self.assertEqual(series.percentile(list(range(10, 101, 10)), 50), 50)
        rows = series.per_second(self.requests)
        self.assertEqual([(row["p50"], row["p99"]) for row in rows], [(30, 600), (60, 700)])

    def test_summary_counts_status_and_drops(self):
        summary = series.summary(self.requests, self.dropped)
        self.assertEqual(summary, {
            "requests": 10, "p50": 50, "p99": 700,
            "on time": 5, "late": 2, "refused": 2, "failed": 1, "dropped": 2,
        })


if __name__ == "__main__":
    unittest.main()
