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

## Good to know

- **Updates are by hand for now.** Mark is adding automatic updates after
  every finished change next. Until then, running `scripts/hosting/setup.sh`
  again picks up the latest version (it keeps your sign-up code).
- **Photos and attachments disappear** when the copy is updated.
- **To stop paying,** delete the server (`wheelhouse-test`) and the database
  (`wheelhouse-test-db`) in DigitalOcean. That deletes everything on them.
  The firewall and your SSH key cost nothing and can stay or go.
- **Your token** expires after 30 days. It can be deleted in DigitalOcean
  (API) once setup is done; to run the script again later, make a new one and
  run `doctl auth init` again.

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
