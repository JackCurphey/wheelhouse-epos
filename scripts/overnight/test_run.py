"""Tests for the overnight runner's safety rules (tests/overnight-runner.test.js runs them).

    python3 -m unittest scripts/overnight/test_run.py
"""
import os
import shutil
import subprocess
import sys
import tempfile
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


SHA = 'a' * 40


class Push(unittest.TestCase):
    def test_pushes_one_scanned_commit_to_one_named_overnight_branch_at_the_recorded_address_with_no_hooks(self):
        cmd = run.push_command('git@github.com:JackCurphey/wheelhouse-epos.git', SHA, 'overnight/20261026-0100-foo')
        self.assertEqual(cmd, ['git', 'push', '--no-verify', '-u', 'git@github.com:JackCurphey/wheelhouse-epos.git',
                               f'{SHA}:refs/heads/overnight/20261026-0100-foo'])

    def test_refuses_any_other_branch_name(self):
        for bad in ['main', 'master', 'fix/x', 'overnight/../main', 'overnight/', '', 'overnight/a b']:
            with self.assertRaises(ValueError, msg=bad):
                run.push_command('git@github.com:x/y.git', SHA, bad)

    def test_refuses_anything_but_a_full_commit_id(self):
        for bad in ['HEAD', 'main', 'abc123', '', SHA + '0', 'g' * 40]:
            with self.assertRaises(ValueError, msg=bad):
                run.push_command('git@github.com:x/y.git', bad, 'overnight/ok')

    def test_the_repository_name_for_gh(self):
        self.assertEqual(run.repo_slug('git@github.com:JackCurphey/wheelhouse-epos.git'), 'JackCurphey/wheelhouse-epos')
        self.assertEqual(run.repo_slug('https://github.com/JackCurphey/wheelhouse-epos'), 'JackCurphey/wheelhouse-epos')
        with self.assertRaises(ValueError):
            run.repo_slug('https://example.com/x/y.git')

    def test_the_runners_own_git_keeps_your_login_and_drops_repository_and_service_settings(self):
        e = run.publish_env({'HOME': '/Users/x', 'SSH_AUTH_SOCK': '/tmp/a', 'PATH': '/bin', 'GIT_CONFIG_COUNT': '3',
                             'GIT_SSH_COMMAND': 'false', 'GIT_DIR': '/x', 'TWILIO_AUTH_TOKEN': 't'})
        self.assertEqual(e, {'HOME': '/Users/x', 'SSH_AUTH_SOCK': '/tmp/a', 'PATH': '/bin'})


def git(*args, cwd, env=None):
    return subprocess.run(['git', *args], cwd=cwd, env=env or {**os.environ, 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1'},
                          capture_output=True, text=True, check=True).stdout.strip()


class CleanClonePush(unittest.TestCase):
    """What the agent writes into the shared .git must not act on the runner's push."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src = self.tmp / 'work'
        self.remote = self.tmp / 'remote.git'
        self.marker = self.tmp / 'hook-ran'
        git('init', '-q', '--bare', str(self.remote), cwd=self.tmp)
        git('init', '-q', '-b', 'main', str(self.src), cwd=self.tmp)
        for k, v in [('user.name', 't'), ('user.email', 't@example.test'), ('commit.gpgsign', 'false')]:
            git('config', k, v, cwd=self.src)
        (self.src / 'a.txt').write_text('one\n')
        git('add', '-A', cwd=self.src)
        git('commit', '-q', '-m', 'one', cwd=self.src)
        git('switch', '-q', '-c', 'overnight/20261026-0100-foo', cwd=self.src)
        (self.src / 'b.txt').write_text('two\n')
        git('add', '-A', cwd=self.src)
        git('commit', '-q', '-m', 'two', cwd=self.src)
        self.sha = git('rev-parse', 'HEAD', cwd=self.src)
        self.env = run.publish_env({'PATH': os.environ['PATH'], 'HOME': str(self.tmp),
                                    'GIT_CONFIG_GLOBAL': '/dev/null'})  # keep this test off the machine's own config

    def test_the_scanned_commit_arrives_on_the_named_branch(self):
        run.push_from_clean_clone(self.src, self.sha, 'overnight/20261026-0100-foo', str(self.remote), self.env)
        self.assertEqual(git('rev-parse', 'refs/heads/overnight/20261026-0100-foo', cwd=self.remote), self.sha)
        self.assertEqual(git('branch', '--list', cwd=self.remote).split(), ['overnight/20261026-0100-foo'], 'nothing else was pushed')

    def test_hooks_and_settings_planted_in_the_source_repository_do_nothing(self):
        hook = self.src / '.git' / 'hooks' / 'pre-push'
        hook.write_text(f'#!/bin/sh\ntouch {self.marker}\nexit 0\n')
        hook.chmod(0o755)
        git('config', 'core.hooksPath', str(self.src / '.git' / 'hooks'), cwd=self.src)
        git('config', 'core.sshCommand', f'touch {self.marker}; false', cwd=self.src)
        git('config', 'url.file:///nowhere.insteadOf', str(self.remote), cwd=self.src)
        git('config', 'remote.origin.pushurl', 'file:///nowhere', cwd=self.src)
        git('config', 'core.fsmonitor', f'touch {self.marker}', cwd=self.src)
        run.push_from_clean_clone(self.src, self.sha, 'overnight/20261026-0100-foo', str(self.remote), self.env)
        self.assertFalse(self.marker.exists(), 'something the agent planted ran')
        self.assertEqual(git('rev-parse', 'refs/heads/overnight/20261026-0100-foo', cwd=self.remote), self.sha)

    def test_it_refuses_when_the_branch_is_not_the_commit_that_was_scanned(self):
        (self.src / 'c.txt').write_text('sneaked in\n')
        git('add', '-A', cwd=self.src)
        git('commit', '-q', '-m', 'added after the scan', cwd=self.src)
        with self.assertRaises(RuntimeError):
            run.push_from_clean_clone(self.src, self.sha, 'overnight/20261026-0100-foo', str(self.remote), self.env)
        self.assertEqual(git('branch', '--list', cwd=self.remote), '', 'nothing was pushed')

    def test_a_secret_added_then_deleted_is_still_in_the_history_that_is_scanned(self):
        (self.src / 'oops.txt').write_text('TOKEN=ghp_' + 'a' * 36 + '\n')
        git('add', '-A', cwd=self.src)
        git('commit', '-q', '-m', 'add', cwd=self.src)
        git('rm', '-q', 'oops.txt', cwd=self.src)
        git('commit', '-q', '-m', 'remove', cwd=self.src)
        overall = git('diff', self.sha, 'HEAD', cwd=self.src)
        history = git('log', '-p', '--no-ext-diff', '--no-textconv', '--pretty=format:', f'{self.sha}..HEAD', cwd=self.src)
        self.assertEqual(run.scan_for_secrets(overall, []), [], 'the overall change looks clean')
        self.assertTrue(run.scan_for_secrets(history, []), 'but the history carries it')
        names = git('log', '--name-only', '--pretty=format:', f'{self.sha}..HEAD', cwd=self.src).split()
        self.assertIn('oops.txt', names)

    def test_binary_files_that_are_not_pictures_or_fonts_are_flagged(self):
        numstat = '-\t-\tdump.bin\n-\t-\tlogo.PNG\n-\t-\tfonts/a.woff2\n3\t1\tsrc/a.js\n-\t-\tsecrets.sqlite\n'
        self.assertEqual(run.binary_files_to_look_at(numstat), ['dump.bin', 'secrets.sqlite'])

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class StackedPullRequests(unittest.TestCase):
    def test_a_red_commit_is_not_built_on_and_its_branch_is_not_a_base(self):
        self.assertEqual(run.next_bases('c1', 'b1', 'b2', 'c2', green=False, pushed=True), ('c1', 'b1'))

    def test_a_green_pushed_branch_is_both(self):
        self.assertEqual(run.next_bases('c1', 'b1', 'b2', 'c2', green=True, pushed=True), ('c2', 'b2'))

    def test_a_green_branch_that_failed_to_push_is_built_on_but_not_a_pull_request_base(self):
        self.assertEqual(run.next_bases('c1', 'b1', 'b2', 'c2', green=True, pushed=False), ('c2', 'b1'))

    def test_what_is_built_on_is_a_commit_id_so_a_moved_branch_changes_nothing(self):
        prev_commit, _ = run.next_bases('c1', 'b1', 'overnight/x', 'c2', green=True, pushed=True)
        self.assertEqual(prev_commit, 'c2')


class EnvParsing(unittest.TestCase):
    def test_a_trailing_comment_is_not_part_of_the_value(self):
        self.assertIn(('KEY', 'abc123456'), list(run.env_pairs('KEY=abc123456 # a note\n')))
        self.assertIn(('KEY', 'abc # not a comment'), list(run.env_pairs('KEY="abc # not a comment"\n')))


class Branches(unittest.TestCase):
    def test_a_run_never_reuses_a_branch_name(self):
        self.assertEqual(run.branch_name('20261026-0130', 'foo'), 'overnight/20261026-0130-foo')


if __name__ == '__main__':
    unittest.main()
