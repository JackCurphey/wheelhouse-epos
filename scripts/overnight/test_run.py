"""Tests for the overnight runner's safety rules (tests/overnight-runner.test.js runs them).

    python3 -m unittest scripts/overnight/test_run.py
"""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run  # noqa: E402


class SecretScan(unittest.TestCase):
    def test_a_value_copied_from_the_real_env_is_caught_wherever_it_lands(self):
        diff = '+++ b/notes.md\n+the database password is hunter2-hunter2-hunter2 ok\n'
        found = run.scan_for_secrets(diff, ['hunter2-hunter2-hunter2'])
        self.assertTrue(found, 'a secret value from .env in a committed line')

    def test_short_values_are_not_treated_as_secrets(self):
        self.assertEqual(run.scan_for_secrets('+port is 8080\n', ['8080', '1', 'true']), [])

    def test_private_keys_and_well_known_token_shapes(self):
        for line in ['-----BEGIN OPENSSH PRIVATE KEY-----', 'ghp_' + 'a' * 36, 'sk_live_' + 'b' * 24,
                     'AKIA' + 'C' * 16, 'xoxb-1234567890-abcdefghij', 'github_pat_' + 'd' * 30]:
            self.assertTrue(run.scan_for_secrets(f'+{line}\n', []), line)

    def test_a_key_secret_or_password_assigned_a_long_value(self):
        self.assertTrue(run.scan_for_secrets('+STRIPE_SECRET_KEY=abcdefghijklmnopqrstuvwx\n', []))
        self.assertTrue(run.scan_for_secrets('+  "password": "correct-horse-battery-staple-99"\n', []))

    def test_only_added_lines_count(self):
        self.assertEqual(run.scan_for_secrets('-ghp_' + 'a' * 36 + '\n context line\n', []), [])

    def test_ordinary_code_and_docs_pass(self):
        diff = '+const password = req.body.password;\n+Set TOKEN in the settings page.\n+export const SECRET_KEY_NAME = "WHEELHOUSE_SECRET";\n'
        self.assertEqual(run.scan_for_secrets(diff, []), [])

    def test_files_that_are_never_committed(self):
        for name in ['.env', '.env.bak', 'config/.env.local', 'id_ed25519', 'server.pem', 'keys/private.key', 'x.p12']:
            self.assertTrue(run.forbidden_file(name), name)
        for name in ['.env.example', 'src/environment.ts', 'docs/keys.md']:
            self.assertFalse(run.forbidden_file(name), name)


class WorktreeEnv(unittest.TestCase):
    TEXT = 'DATABASE_URL=postgres://u:p@localhost:5433/db\nPOSTGRES_SUPERUSER_PASSWORD=supersecret\nTWILIO_AUTH_TOKEN=abc\nPAYMENTS_PROVIDER=pretend\n# comment\nSIGNUP_CODE=letmein\n'

    def test_the_worktree_gets_only_what_the_tests_need(self):
        out = run.safe_env_text(self.TEXT)
        self.assertIn('DATABASE_URL=postgres://u:p@localhost:5433/db', out)
        self.assertIn('PAYMENTS_PROVIDER=pretend', out)
        for secret in ['supersecret', 'TWILIO', 'letmein', 'SIGNUP_CODE']:
            self.assertNotIn(secret, out)

    def test_secret_values_to_scan_for_include_everything_in_the_real_env(self):
        vals = run.secret_values(self.TEXT)
        self.assertIn('supersecret', vals)
        self.assertIn('abc', vals)  # short ones are filtered later, by the scanner
        self.assertIn('letmein', vals)


class AgentEnv(unittest.TestCase):
    def setUp(self):
        self.env = run.agent_env({'PATH': os.environ['PATH'], 'HOME': '/Users/x', 'SSH_AUTH_SOCK': '/tmp/agent', 'GH_TOKEN': 'real',
                                  'TWILIO_AUTH_TOKEN': 't', 'DIGITALOCEAN_TOKEN': 'd', 'EMAIL_API_KEY': 'e'},
                                 Path('/tmp/empty-gitconfig'))

    def test_git_has_no_way_to_authenticate(self):
        e = self.env
        self.assertEqual(e['GIT_SSH_COMMAND'], 'false')
        self.assertEqual(e['GIT_TERMINAL_PROMPT'], '0')
        self.assertEqual(e['GIT_ASKPASS'], 'false')
        self.assertEqual(e['GIT_CONFIG_GLOBAL'], '/tmp/empty-gitconfig')
        self.assertEqual(e['GIT_CONFIG_NOSYSTEM'], '1')
        self.assertNotIn('SSH_AUTH_SOCK', e)
        self.assertEqual(e['GH_TOKEN'], 'x')
        self.assertEqual(e['GH_CONFIG_DIR'], '/nonexistent')

    def test_no_credential_helper_and_no_origin_to_push_to(self):
        keys = {e[f'GIT_CONFIG_KEY_{i}']: e[f'GIT_CONFIG_VALUE_{i}'] for e in [self.env] for i in range(int(e['GIT_CONFIG_COUNT']))}
        self.assertEqual(keys['credential.helper'], '')
        self.assertEqual(keys['remote.origin.pushurl'], 'disabled://overnight-no-push')
        self.assertEqual(keys['commit.gpgsign'], 'false')

    def test_commits_can_still_be_made(self):
        self.assertTrue(self.env['GIT_AUTHOR_NAME'] and self.env['GIT_COMMITTER_EMAIL'])

    def test_git_over_ssh_cannot_even_try(self):
        import subprocess
        r = subprocess.run(['git', 'ls-remote', 'ssh://git@github.com/JackCurphey/wheelhouse-epos.git'], env=self.env,
                           capture_output=True, text=True, timeout=20)
        self.assertNotEqual(r.returncode, 0, 'ssh is replaced by `false`, so nothing connects or authenticates')

    def test_outside_services_keys_are_removed(self):
        for k in ['TWILIO_AUTH_TOKEN', 'DIGITALOCEAN_TOKEN', 'EMAIL_API_KEY']:
            self.assertNotIn(k, self.env)
        self.assertEqual(self.env['HOME'], '/Users/x', 'the CLI keeps its own login')


class Push(unittest.TestCase):
    def test_pushes_one_named_overnight_branch_to_the_recorded_address_with_no_hooks(self):
        cmd = run.push_command('git@github.com:JackCurphey/wheelhouse-epos.git', 'overnight/20261026-0100-foo')
        self.assertEqual(cmd, ['git', 'push', '--no-verify', '-u', 'git@github.com:JackCurphey/wheelhouse-epos.git',
                               'HEAD:refs/heads/overnight/20261026-0100-foo'])

    def test_refuses_any_other_branch_name(self):
        for bad in ['main', 'master', 'fix/x', 'overnight/../main', 'overnight/', '', 'overnight/a b']:
            with self.assertRaises(ValueError, msg=bad):
                run.push_command('git@github.com:x/y.git', bad)


class StackedPullRequests(unittest.TestCase):
    def test_a_red_branch_is_not_built_on_and_not_a_base(self):
        base = run.next_bases(prev_branch='b1', prev_pr_base='b1', branch='b2', green=False, pushed=True)
        self.assertEqual(base, ('b1', 'b1'))

    def test_a_green_pushed_branch_is_both(self):
        self.assertEqual(run.next_bases('b1', 'b1', 'b2', green=True, pushed=True), ('b2', 'b2'))

    def test_a_green_branch_that_failed_to_push_is_built_on_but_not_a_pull_request_base(self):
        self.assertEqual(run.next_bases('b1', 'b1', 'b2', green=True, pushed=False), ('b2', 'b1'))


class Branches(unittest.TestCase):
    def test_a_run_never_reuses_a_branch_name(self):
        self.assertEqual(run.branch_name('20261026-0130', 'foo'), 'overnight/20261026-0130-foo')


if __name__ == '__main__':
    unittest.main()
