"""Driver checks use fake processes/results. They never call an LLM."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[1] / 'claude-prototype-overnight.py'
spec = importlib.util.spec_from_file_location('overnight', source)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class DriverTests(unittest.TestCase):
    def test_usage_separates_cache_reads(self):
        counts = runner.usage_of({'usage': {'input_tokens': 10, 'output_tokens': 20,
                                  'cache_creation_input_tokens': 30, 'cache_read_input_tokens': 500}})
        self.assertEqual(counts['working_tokens'], 60)
        self.assertEqual(counts['cache_read_input_tokens'], 500)

    def test_missing_usage_fails_closed(self):
        with self.assertRaises(ValueError):
            runner.usage_of({'usage': {'output_tokens': 20}})

    def simulate(self, status='complete', browser=True, alter_spec=False, token_budget=200000):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path in [runner.SPEC, runner.BRIEF]:
                (root / path).parent.mkdir(parents=True, exist_ok=True)
                (root / path).write_text('Pinned user decisions\n')
            (root / 'prototype').mkdir()
            (root / 'prototype/package.json').write_text(json.dumps({'scripts': {'test:browser': 'fake'} if browser else {}}))
            calls = []

            def fake_command(command, stdout, stderr, timeout, prompt=None):
                calls.append(command)
                stderr.write_text('')
                if prompt:
                    self.assertIn('Verbatim governing specification', prompt)
                    stdout.write_text(json.dumps({'usage': {'input_tokens': 100, 'output_tokens': 200},
                        'total_cost_usd': 0.1, 'structured_output': {'status': status, 'summary': 'Fixture', 'remaining': [], 'blockers': []}}))
                    if alter_spec:
                        (root / runner.SPEC).write_text('Changed\n')
                else:
                    stdout.write_text('Fake verification passed\n')
                return 0

            with patch.object(runner, 'ROOT', root), patch.object(runner, 'baseline'), \
                 patch.object(runner, 'run_command', side_effect=fake_command), \
                 patch.object(runner.shutil, 'which', return_value='/fake/claude'), \
                 patch.dict(runner.os.environ, {'CLAUDECODE': ''}), \
                 patch('sys.argv', [str(source), '--iterations', '4', '--token-budget', str(token_budget)]):
                code = runner.main()
            run_dir = Path((root / '.prototype-overnight/latest.txt').read_text().strip())
            ledger = json.loads((run_dir / 'summary.json').read_text())
            self.assertFalse((root / '.prototype-overnight/active.lock').exists())
            return code, ledger, calls

    def test_completion_requires_independent_normal_and_browser_checks(self):
        code, ledger, calls = self.simulate()
        self.assertEqual(code, 0)
        self.assertEqual(ledger['status'], 'complete')
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[-1], ['npm', '--prefix', 'prototype', 'run', 'test:browser'])

    def test_missing_browser_command_cannot_complete(self):
        code, ledger, calls = self.simulate(browser=False)
        self.assertEqual(code, 2)
        self.assertEqual(ledger['status'], 'repeated_failure')
        self.assertEqual(len(ledger['passes']), 3)

    def test_spec_change_stops_without_another_model_call(self):
        code, ledger, calls = self.simulate(alter_spec=True)
        self.assertEqual(ledger['status'], 'spec_or_brief_changed')
        self.assertEqual(code, 2)
        self.assertEqual(len(calls), 1)

    def test_token_allowance_stops_between_passes(self):
        code, ledger, calls = self.simulate(status='continue', token_budget=200)
        self.assertEqual(code, 2)
        self.assertEqual(ledger['status'], 'limit_reached')
        self.assertEqual(ledger['working_tokens'], 300)
        self.assertEqual(len(calls), 2)

    def test_blocker_stops_with_a_distinct_incomplete_status(self):
        code, ledger, _ = self.simulate(status='blocked')
        self.assertEqual(code, 2)
        self.assertEqual(ledger['status'], 'blocked')


if __name__ == '__main__':
    unittest.main()
