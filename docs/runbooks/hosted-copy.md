# The hosted test copy: setting it up (for Jack)

This guide sets up the online test copy of Wheelhouse on DigitalOcean, in
London. You do it yourself, with Mark on hand if anything looks odd. It
takes about 30 minutes, most of it waiting.

**What it costs:** about £20 a month with VAT, charged by DigitalOcean to
your card until you delete it. Nothing is charged until step 4.

**What you'll end up with:** a web address you can open on any device, and
a private sign-up code for your test login. Test data only: it never sends
real texts or takes real money. Photos and attachments aren't kept for now.

## Before you start

You need your Mac, this repository on it (the folder you run Wheelhouse
from), and the Terminal app.

## 1. Create your DigitalOcean account

1. Go to digitalocean.com and sign up with your email.
2. Add your card when it asks. Nothing is charged yet.
3. Invite Mark, so he can help and check things: in DigitalOcean, open
   **Settings → Team → Invite Members** and use Mark's usual email.

## 2. Make an API token (the key the setup script uses)

1. In DigitalOcean, open **API** in the left-hand menu, then **Generate New
   Token**.
2. Name it `wheelhouse-setup`, set it to expire in **30 days**, and choose
   **Full Access**.
3. Click **Generate Token** and copy it. It's shown only once. Don't paste it
   anywhere else, especially not on GitHub or in a chat.

## 3. Install DigitalOcean's tool and sign in

In Terminal, run these one at a time:

```
brew install doctl
doctl auth init
```

When `doctl auth init` asks for a token, paste the one from step 2 and press
Enter. It should say "Validating token... OK".

(If `brew` isn't found, ask Mark: it's Homebrew, the usual way to install
tools on a Mac.)

## 4. Run the setup script

In Terminal, go to the Wheelhouse folder and run:

```
cd ~/Documents/GitHub/wheelhouse-epos
git checkout main
git pull
scripts/hosting/setup.sh
```

(If your Wheelhouse folder is somewhere else, use that folder in the first
line instead.)

It needs GitHub's `gh` tool, signed in as you (`brew install gh`, then
`gh auth login`). It checks your setup, tells you what it's about to create and what it costs,
and asks you to type `yes`. Then it:

1. adds your Mac's SSH key (it makes one if you don't have one), and makes
   a second key just for GitHub's automatic updates
   (`~/.ssh/wheelhouse-deploy`);
2. creates the server, about a minute;
3. creates the firewall;
4. creates the database, **5 to 10 minutes**, the longest wait;
5. installs and starts Wheelhouse on the server, **several more minutes**
   while it builds;
6. sets up automatic updates on GitHub (see "Automatic updates" below).

When it finishes, it shows the **web address** and your **sign-up code**.
Keep the code private: it's what stops strangers making accounts.

If it stops part way with an error, copy the message to Mark. Running it
again is safe: it carries on from where it stopped and doesn't create
anything twice.

## 5. Sign up and try it

1. Open the web address on your phone or laptop.
2. Sign up as a new shop, using the sign-up code.
3. That's your test shop. Try anything: it's test data only.

Later, Mark will load the drawings' own test shop (North Street Cycles,
from #216) and give you a login to it. That needs an empty database, so the
shop you make here will be cleared then. Don't keep anything in it you'll
miss.

## Automatic updates

Every merge to `main` goes onto the test copy by itself, once its tests
have passed: GitHub builds it, starts it on the server, and checks the
health check shows the new version. If that doesn't happen within 5
minutes, it puts the version before back and the run shows as failed, in
red, in the repository's **Actions** tab, under "Deploy the hosted copy".
Pull requests and other branches never go on the test copy.

**Setting it up (once).** The setup script does most of it: it makes the
deploy-only key, lets it run the update script on the server and nothing
else, and gives GitHub the key, the server's address and the server's
fingerprint (so GitHub only ever talks to your server). Your part:

1. After this change is merged, run the setup script again (step 4, with
   `git pull` first). Type `yes`; it reuses everything that exists.
2. The server downloads each update from GitHub without a password, so the
   app's package on GitHub must be public. The code already is, so this
   shows nothing new. The package appears after the first automatic update
   has run, even a failed one. If the script printed "One more thing, once":
   1. Open the address it printed (your GitHub packages, then
      `wheelhouse-epos`, then **Package settings**).
   2. Under **Danger Zone**, choose **Change visibility**, then **Public**,
      and type the name to confirm.
3. In the repository's **Actions** tab, open the latest "Deploy the hosted
   copy" run. If it failed, choose **Re-run jobs**. It's set up when it goes
   green.
4. Open `https://<your web address>/healthz`. It now shows
   `"commit"` too: the version running, which should match the latest
   commit on `main`.

The update is down for a moment while the new version starts, as by hand.

## Good to know

- **Updates are automatic** after every merge (above). Running
  `scripts/hosting/setup.sh` again still works too: it builds the latest
  `main` on the server (it keeps your sign-up code). See
  "Updating it, checking it, and undoing a bad update" below.
- **Photos and attachments disappear** when the copy is updated.
- **To stop paying,** delete the server (`wheelhouse-test`) and the database
  (`wheelhouse-test-db`) in DigitalOcean. That deletes everything on them.
  The firewall and your SSH key cost nothing and can stay or go.
- **Your token** expires after 30 days. It can be deleted in DigitalOcean
  (API) once setup is done; to run the script again later, make a new one and
  run `doctl auth init` again.

## Loading the test shop

The drawings' own test shop, North Street Cycles, with its staff, customers
and the drawn week of jobs, is loaded once, by hand. It only loads onto a
copy with no shops at all, so anything already made on the copy has to be
cleared first. That is its own decision, made at the time; this doesn't
clear anything.

On the server (see "Getting onto the server" below):

```
cd /opt/wheelhouse
docker compose exec app node scripts/dev/load-test-shop.mjs
```

It runs inside the app that's running, so it always matches it. It ends with
"Loaded North Street Cycles: 38 workshop jobs from the drawings' week." If it
says "Refused" instead, nothing was changed: it says whether the shop is
already there, or which other shops are in the way.

## Signing in with WorkOS

Staff sign in only on WorkOS's page (`openspec/specs/staff-sign-in`, Jack's
decision of 25 Oct, `docs/decisions/2026-10-25-workos-account.md`). Until
these three steps are done, nobody can sign in to the copy: it says "Signing
in isn't switched on yet". The pretend WorkOS used in tests never runs here.
Shop sign-up (step 5 above) still signs the new owner straight in, and
signing in after that needs these steps.

1. **The copy's settings.** On the server ("Getting onto the server"
   below), add these four lines to `/opt/wheelhouse/.env`, with the copy's
   web address in the last one. The keys are the WorkOS test keys from
   Jack's own `.env`. Pass them privately; never put them in the
   repository, an issue or a chat.
   ```
   STAFF_SIGNIN_PROVIDER=workos
   WORKOS_API_KEY=sk_test_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=https://<your web address>/api/auth/workos/callback
   ```
   Then restart the app: `cd /opt/wheelhouse && docker compose up -d app`.
   The copy refuses to start with a live (`sk_live_`) key; test keys are
   fine.
2. **The copy's addresses in WorkOS.** In WorkOS's dashboard (Staging →
   Applications → Redirects), add these beside the `localhost:8080` ones:
   - Redirect URI: `https://<your web address>/api/auth/workos/callback`
   - Initiate login URI: `https://<your web address>/api/auth/workos/start`
   - Sign-out URI: `https://<your web address>/workshop/signed-out`
3. **A login with your email.** Wheelhouse only lets in an email that is
   on a shop's staff list. The login made for Jack on the test shop
   (add-hosted-copy task 3.6) has to use the email he signs in to WorkOS
   with.

**Check it:** open `https://<your web address>/workshop`. It should go
straight to WorkOS's sign-in page. Sign in, and you should be back in the
staff app. Sign out, and you should land on "You've signed out".

This is WorkOS's **Staging** environment, for testing only. A copy for real
shops uses WorkOS's Production environment, with its own keys and
addresses.

## Updating it, checking it, and undoing a bad update

This part is the way back (design Decision 8). Mark normally does it, but
it's written so you can follow it too. Where something hasn't been tried
on the real copy yet, it says so, and anything not known yet is in
brackets like `[n]`.

**How it works:** each merge to `main` updates the copy by itself
("Automatic updates" above). Each update keeps the version before ready to
start again, and writes down the time and both versions before it changes
anything, in `/opt/wheelhouse/deploys.log` on the server. The health check
shows the version running.

### Getting onto the server

Some steps run on the server itself. Your web address has the server's
address in it: `https://1-2-3-4.sslip.io` means the server is `1.2.3.4`.
In Terminal, on your Mac:

```
ssh root@1.2.3.4
```

(Use your own numbers.) When you're done on the server, type `exit`.

### A. Updating to the latest version

Normally there's nothing to do: merging to `main` updates the copy. Each
update writes a line in `/opt/wheelhouse/deploys.log` first. On the server:

```
tail -n 5 /opt/wheelhouse/deploys.log
```

Each line is the time in UTC (what DigitalOcean uses, so there's no
summer-time confusion), then `deploy`, the new version's long code of 40
letters and numbers (the commit), and `(was …)`, the version before. If an
update goes wrong, that time is the moment the database goes back to (D),
and the `was` code is the version that comes back.

To update by hand instead (for example, if GitHub's automatic update isn't
working):

1. **Write down the time and the version that's running now.** On the
   server:

   ```
   date -u
   grep '^WHEELHOUSE_COMMIT=' /opt/wheelhouse/.env
   ```

   Keep both, as above.
2. On your Mac, in the Wheelhouse folder, run the setup script again:

   ```
   git checkout main
   git pull
   scripts/hosting/setup.sh
   ```

   If `git checkout` or `git pull` complains, stop and tell Mark. If your
   DigitalOcean token has expired or been deleted, the script stops and
   says so: make a new one (step 2 near the top) and run `doctl auth init`
   first. Type `yes` when it asks. It reuses everything that exists, fetches the latest `main` onto the
   server, rebuilds the app and restarts it. The copy is down for a
   moment while the new version starts. It ends with "All done" and the
   web address. Any database changes in the new version are made as it
   starts, before it answers. If it stops with an error instead, copy the
   message to Mark, and don't try C or D on your own.
3. Do the checks in B.

### B. Checking it's right

1. **It answers.** Open `https://<your web address>/healthz`. It should
   show `{"status":"ok"}`. `"status":"error"` means the app can't reach
   its database; a blank or "502" error page means the app isn't running
   at all. Either way, tell Mark.
2. **It's the version you expect.** The health check in step 1 shows
   `"commit"`: it should match the latest commit on `main` on GitHub
   (GitHub shows the first 7 characters). An automatic update only goes
   green once it does.
3. **It knows it's a test copy.** On the server:

   ```
   cd /opt/wheelhouse
   grep '^WHEELHOUSE_HOSTED_COPY=' .env
   docker compose exec app printenv WHEELHOUSE_HOSTED_COPY
   ```

   Both lines must say `1` (the first prints
   `WHEELHOUSE_HOSTED_COPY=1`, the second just `1`). This setting is what
   makes the app refuse real texting and email keys and refuse to connect
   Shopify. If either is missing or different, don't use the copy: tell
   Mark. Running the setup script again writes it back.
4. **No real keys.** Still on the server:

   ```
   grep -E '^(TWILIO_|EMAIL_|WHATSAPP_)' .env
   ```

   This should print nothing. (The app wouldn't start with one of these
   anyway: it refuses, naming the setting.)

### C. Undoing a bad update that didn't change the database

Use this when an update broke something and it added no database change.
To tell, on your Mac in the Wheelhouse folder (with the two long codes:
the one from A step 1, then the bad one):

```
git diff --stat <old code> <bad code> -- server/migrations/
```

If it prints nothing, use C. If it lists a file, use D. Nothing made on
the copy is lost, except photos and attachments, which go whenever the
app is rebuilt (they aren't kept on the test copy yet).

1. **Stop automatic updates for now,** so the next merge doesn't put a
   broken version back on. On your Mac, in the Wheelhouse folder:

   ```
   gh workflow disable "Deploy the hosted copy"
   ```
2. **Go back to the version before.** On the server:

   ```
   /opt/wheelhouse/deploy.sh rollback
   ```

   It starts the version before the last update again, which the server
   kept. It takes under a minute. To go back further, use
   `/opt/wheelhouse/deploy.sh deploy <code>` with a version's whole
   40-character code from `deploys.log` or GitHub (every merged version
   is kept on GitHub).
3. Do the checks in B. In step 2 the code should be the one you went
   back to, not the latest `main`.
4. **Once the fix is merged,** turn automatic updates back on:
   `gh workflow enable "Deploy the hosted copy"`. The next merge goes on
   by itself (or re-run its update from the Actions tab). Don't run the
   setup script before then: it always puts the latest `main` back.

Time it took on the hosted copy: `[n]` minutes (not tried yet).

### D. Undoing a bad update that changed the database

Use this when the bad update added a database change (a new file in
`server/migrations/`). The old version may not work with the changed
database, so the database goes back too, to the moment written down in A
step 1. **Anything made on the copy after that moment is lost.** Do the
steps in this order:

1. **Stop automatic updates and the bad version**, so its database change
   can't run again. On your Mac, in the Wheelhouse folder, run
   `gh workflow disable "Deploy the hosted copy"`. Then on the server:

   ```
   cd /opt/wheelhouse
   docker compose stop app
   ```

   The web address shows an error page until step 4.
2. **Restore the database to the moment before the update.** DigitalOcean
   restores into a *new* database with a new address; the old one is left
   as it is. It can go back to any moment in the last 7 days, not only to
   a daily backup (checked 24 Oct: DigitalOcean's PostgreSQL limits page
   says point-in-time recovery covers the last 7 days, and the database has
   kept a backup every day since 16 Oct). On your Mac, with the UTC date and
   time from A step 1 in place of the example:

   ```
   doctl databases create wheelhouse-test-restored --restore-from-cluster-name wheelhouse-test-db --restore-from-timestamp "2026-10-24 18:00:00 +0000 UTC" --region lon1 --size db-s-1vcpu-1gb --version 16 --num-nodes 1 --wait
   ```

   The new database costs the same as the first, about \$15 a month,
   charged by the hour while it exists. It takes `[n]` minutes.
3. **Point the app at the restored database.**
   1. Let the server reach it: in the new database's settings, add the
      server `wheelhouse-test` to its trusted sources, as setup did for
      the first one.
   2. On the server, open the settings file with
      `nano /opt/wheelhouse/.env` and change the database
      address in the `DATABASE_URL` line (the part between `@` and
      `:25060`) to the new database's host. Keep port **25060** (the
      direct connection, never 25061). Save with Ctrl-O, Enter, then
      Ctrl-X. Whether the app's login (`epos_app`) keeps the same
      password in the restored database is
      `[to confirm on the first practice run]`. If it doesn't, ask Mark to
      write that line: the password has to be written in a special form
      there.
   3. Whether the new database has a different certificate is
      `[to confirm on the first practice run]`. If it does, replace the
      server's copy. On your Mac, in the Wheelhouse folder (with the new
      database's id from DigitalOcean, and the server's address):

      ```
      doctl databases certificate get-ca <new database id> -o json | jq -r '(if type == "array" then .[] else . end) | .certificate' | base64 --decode > /tmp/ca.crt
      scp /tmp/ca.crt root@1.2.3.4:/opt/wheelhouse/ca.crt
      ```
4. **Start the previous version** on the server, exactly as C step 2
   (`/opt/wheelhouse/deploy.sh rollback`), or with the `was` code from
   `deploys.log` (A). Then do the checks in B. The
   health check showing `ok` means the app reaches the database it's
   set to. To be sure it's the restored one, open the copy and check that
   something you made after the moment in A step 1 is gone.
5. **Tell Jack** (or, if you're Jack, tell Mark) that anything made on the
   copy after the moment in A step 1 is gone, and photos and attachments
   with it.

Afterwards:
- **Leave automatic updates off** until Mark has changed them and the setup
  script to use the restored database.
- **Don't run the setup script again** yet. It looks for the database by
  its old name, so it would point the app back at the old, broken one.
  Mark changes it to use the new database first (not written yet).
- The old database keeps costing money until it's deleted. Deleting it is
  your decision, and only once the restored one is working.

Time it took on the hosted copy: `[n]` minutes (not tried yet).

### E. The restore rehearsal (practising D)

Practising D once, on purpose, so a real restore isn't the first one (design
Decision 8, tasks group 5). Your hands; someone watching each step, Mark or
Claude. It costs a few pence: the restored database exists for an hour or
so, then is deleted. The copy is down for a few minutes while it's pointed
across and back.

1. **Something to come back to.** Open a job on the copy and note its
   reference. Note the time in UTC (on the server: `date -u`). Wait a minute.
2. **Something to lose.** Add a note to that job: "made after the moment".
   A restore to the time in step 1 must bring the job back without it.
3. **Restore** to the time in step 1, as D step 2 (call the new database
   `wheelhouse-test-restored`). Write down how long it took.
4. **Point the copy at it**, as D step 3, and restart the app (on the
   server: `cd /opt/wheelhouse && docker compose up -d app`). Answer D's
   two `[to confirm]` questions as you go: whether `epos_app`'s password
   stayed the same, and whether the certificate changed. Write each answer
   in D in place of its `[to confirm]`.
5. **Open the job.** It's there, and the note from step 2 isn't. That's
   the proof. Write down the time from step 3 to here.
6. **Point the copy back** at `wheelhouse-test-db`: put the `DATABASE_URL`
   line (and the certificate, if it changed) back as they were, and restart
   the app. Check B.
7. **Delete the restored database** (`doctl databases delete
   wheelhouse-test-restored`, then `yes`). It holds only test data, and it
   keeps costing money until it's gone.
8. Record the run in `docs/runbooks/<date>-restore-drill.md`: each step,
   its time, and anything that surprised you.

## For Mark: what the script does, and where

- `scripts/hosting/setup.sh` (runs on Jack's Mac, `doctl`): SSH key, droplet
  `wheelhouse-test` (`s-1vcpu-1gb`, Ubuntu 24.04, `lon1`, tag
  `wheelhouse-test`), firewall `wheelhouse-test` (22, 80, 443 in), managed
  Postgres `wheelhouse-test-db` (16, `db-s-1vcpu-1gb`), database `epos`,
  user `epos_app`, trusted source = the droplet, and DigitalOcean's CA
  certificate.
- `scripts/hosting/cloud-init.yaml` (first boot): Docker, Compose, git,
  `psql`, automatic security updates, 2GB swap for the build.
- `scripts/hosting/remote-install.sh` (on the server, as root, read from
  stdin with the database details): grants `epos_app` the public schema (as
  `docker/init-db.sh` does) and checks it took, rewrites
  `/opt/wheelhouse/.env` keeping the two secrets, clones `main`, and runs
  `docker compose up -d --build`, recording the image and commit in `.env`
  (`WHEELHOUSE_IMAGE`, `WHEELHOUSE_COMMIT`) and the time in `deploys.log`.
  It also ties GitHub's deploy-only key to `deploy.sh`
  (`restrict,command="/opt/wheelhouse/deploy.sh"` in root's
  `authorized_keys`).
- `scripts/hosting/deploy.sh` (on the server; run by the deploy workflow over
  SSH, or by hand): `deploy <commit>` pulls
  `ghcr.io/jackcurphey/wheelhouse-epos:<commit>` before changing anything,
  writes the time and both commits to `deploys.log`, keeps the running
  image as `release.previous`, and starts the new one with
  `docker compose up -d --no-build app`, swapping straight back if it won't
  start. `rollback` starts `release.previous`. Only the running and previous
  images are kept on the server.
- `.github/workflows/deploy-hosted-copy.yml` (Decision 3): after `Tests`
  passes on a push to this repository's `main`; skips a commit older than
  the one running; builds and pushes the image; runs `deploy.sh` over SSH
  against the stored host key; waits 5 minutes for `/healthz` to show the
  commit, and runs `rollback` if it doesn't.
- **Database address:** the public host (its certificate is sure to cover
  it; access is limited to the droplet by the trusted-source rule), port
  **25060** (direct). Not the
  pools on 25061: the app's session-scoped tenancy needs a direct connection
  (`server/db.js`). SSL is verified against DigitalOcean's CA through
  `NODE_EXTRA_CA_CERTS`.
- **HTTPS:** Caddy, on `<ip-with-dashes>.sslip.io` until there's a real
  domain. Caddy overwrites `X-Forwarded-For` and `X-Forwarded-Proto`, which
  `TRUST_PROXY=1` relies on (`server/proxy-trust.js`).
- **Still to check on the real cluster** (task 3.3): point-in-time restore is
  offered on this plan; migrations and row-level security work as
  `epos_app`.
