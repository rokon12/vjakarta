import json
import pathlib
import re
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
DECK = (HERE.parent / 'slides.html').read_text()
NOTES = json.loads((HERE / 'core' / 'notes.json').read_text())


def said(slide_id):
    return ' '.join(click['say'] for click in NOTES[slide_id]['clicks'])


def slide_text(slide_id):
    body = re.search(rf'<section class="slide" id="{slide_id}"[^>]*>(.*?)</section>', DECK, re.S).group(1)
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', body))


class StoryTest(unittest.TestCase):

    def test_the_speaker_says_sixteen_threads_would_have_been_worse(self):
        self.assertIn('11.7', said('why') + said('big'))

    def test_the_door_notes_admit_the_failed_payments(self):
        self.assertNotIn('nobody inside waits', said('door'))
        self.assertIn('50 payments', said('door'))

    def test_the_budget_slide_shows_virtual_threads_stay_on(self):
        self.assertIn('virtual = true', slide_text('budgets-code'))

    def test_the_notes_say_what_is_recorded_and_what_is_simulated(self):
        self.assertIn('pg_sleep', said('service'))
        self.assertIn('recorded', said('small') + said('big'))
        self.assertIn('simulation', said('flood'))

    def test_the_small_sale_after_the_switch_has_a_cue_and_a_fallback(self):
        clicks = NOTES['switch']['clicks'] + NOTES['small']['clicks']
        self.assertIn('./run.sh load switched small', [click['run'] for click in clicks])
        self.assertIn('switched-small-7.html', ' '.join(click['tip'] or '' for click in clicks))

    def test_the_title_trace_does_not_label_an_overshoot_as_the_rebuild(self):
        self.assertNotIn('THE REBUILD', (HERE / 'scenes' / 'titletrace.js').read_text())

    def test_no_claim_that_every_jakarta_ee_11_server_has_concurrency(self):
        self.assertNotIn('any Jakarta EE 11 server', said('one-line'))

    def test_the_829_are_not_all_said_to_wait_for_connections(self):
        self.assertNotIn('829 reservations in flight queue for them', slide_text('why'))
        self.assertNotIn('829 reservations queued for them', said('why'))

    def test_the_door_traffic_label_is_no_longer_than_vfuns(self):
        overload = (HERE / 'scenes' / 'overload.js').read_text()
        label = re.search(r"class: 'sub', x: 0, y: 204, text: '([^']+)'", overload).group(1)
        self.assertLessEqual(len(label), len('requests / second'))

    def test_the_browser_tab_names_this_talk(self):
        title = re.search(r'<title>([^<]+)</title>', DECK).group(1)
        self.assertEqual('Virtual Threads Removed the Thread Limit. What Breaks Next in Jakarta EE?', title)


if __name__ == '__main__':
    unittest.main()
