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

It checks your setup, tells you what it's about to create and what it costs,
and asks you to type `yes`. Then it:

1. adds your Mac's SSH key (it makes one if you don't have one);
2. creates the server, about a minute;
3. creates the firewall;
4. creates the database, **5 to 10 minutes**, the longest wait;
5. installs and starts Wheelhouse on the server, **several more minutes**
   while it builds.

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

## Good to know

- **Updates are by hand for now.** Mark is adding automatic updates after
  every finished change next. Until then, running `scripts/hosting/setup.sh`
  again picks up the latest version (it keeps your sign-up code). See
  "Updating it, checking it, and undoing a bad update" below.
- **Photos and attachments disappear** when the copy is updated.
- **To stop paying,** delete the server (`wheelhouse-test`) and the database
  (`wheelhouse-test-db`) in DigitalOcean. That deletes everything on them.
  The firewall and your SSH key cost nothing and can stay or go.
- **Your token** expires after 30 days. It can be deleted in DigitalOcean
  (API) once setup is done; to run the script again later, make a new one and
  run `doctl auth init` again.

## Updating it, checking it, and undoing a bad update

This part is the way back (design Decision 8). Mark normally does it, but
it's written so you can follow it too. Where something hasn't been tried
on the real copy yet, it says so, and anything not known yet is in
brackets like `[n]`.

**How it works today:** updates are by hand (re-running the setup script).
The automatic update after every merge (task 3.4) isn't built yet. When it
is, this section changes: it will keep the previous version ready to start
again, write down the time before each update, and show the running commit
in the health check. Until then, the steps below do those things by hand.

### Getting onto the server

Some steps run on the server itself. Your web address has the server's
address in it: `https://1-2-3-4.sslip.io` means the server is `1.2.3.4`.
In Terminal, on your Mac:

```
ssh root@1.2.3.4
```

(Use your own numbers.) When you're done on the server, type `exit`.

### A. Updating to the latest version

1. **Write down the time and the version that's running now.** On the
   server:

   ```
   date -u
   git -C /opt/wheelhouse/app rev-parse HEAD
   ```

   The first line is the time in UTC (what DigitalOcean uses, so there's
   no summer-time confusion). The second is a long code of 40 letters and
   numbers (the commit). Keep both. If the update
   goes wrong, this is the moment the database goes back to and the
   version that comes back.
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
2. **It's the version you expect.** On the server:

   ```
   git -C /opt/wheelhouse/app rev-parse HEAD
   ```

   It should match the latest commit on `main` on GitHub (GitHub shows
   the first 7 characters). This shows the code the server fetched, so it
   only counts once the setup script ended with "All done". (The health
   check will show this itself once the automatic update passes it in.)
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

1. Find the version to go back to: the long code you wrote down in A
   step 1, or the full commit before the bad one on GitHub. It must be
   the whole 40-character code, not the short one.
2. On the server, put that version back and rebuild it (replace
   `<code>` with your code, both times):

   ```
   cd /opt/wheelhouse
   git -C app fetch --quiet --depth 1 origin <code>
   git -C app checkout --quiet --force <code>
   docker compose up -d --build
   ```

   The rebuild takes several minutes, as in the first setup: the setup
   script doesn't keep the previous version's image, so it's built again.
   (The fetch is needed because the server keeps only the latest version
   of the code.)
3. Do the checks in B. In step 2 the code should be the one you went
   back to, not the latest `main`.
4. **Don't run the setup script again** until the fix is merged: it
   always puts the latest `main` back.

Time it took on the hosted copy: `[n]` minutes (not tried yet).

### D. Undoing a bad update that changed the database

Use this when the bad update added a database change (a new file in
`server/migrations/`). The old version may not work with the changed
database, so the database goes back too, to the moment written down in A
step 1. **Anything made on the copy after that moment is lost.** Do the
steps in this order:

1. **Stop the bad version**, so its database change can't run again. On
   the server:

   ```
   cd /opt/wheelhouse
   docker compose stop app
   ```

   The web address shows an error page until step 4.
2. **Restore the database to the moment before the update.** DigitalOcean
   restores into a *new* database with a new address; the old one is left
   as it is. In DigitalOcean, open **Databases → wheelhouse-test-db** and
   restore it to the UTC date and time from A step 1. The exact menu and the new
   database's name are `[to confirm on the first practice run]`: that
   point-in-time restore is offered on this plan is still to be checked
   (task 3.3). It takes `[n]` minutes.
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
4. **Start the previous version** on the server, exactly as C step 2,
   using the code written down in A step 1. Then do the checks in B. The
   health check showing `ok` means the app reaches the database it's
   set to. To be sure it's the restored one, open the copy and check that
   something you made after the moment in A step 1 is gone.
5. **Tell Jack** (or, if you're Jack, tell Mark) that anything made on the
   copy after the moment in A step 1 is gone, and photos and attachments
   with it.

Afterwards:
- **Don't run the setup script again** yet. It looks for the database by
  its old name, so it would point the app back at the old, broken one.
  Mark changes it to use the new database first (not written yet).
- The old database keeps costing money until it's deleted. Deleting it is
  your decision, and only once the restored one is working.

Time it took on the hosted copy: `[n]` minutes (not tried yet).

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
  `docker compose up -d --build`.
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
