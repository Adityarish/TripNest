# TripNest

TripNest is a private trip-media organizer built with Next.js App Router, Clerk, PostgreSQL/Prisma, and Google Drive API v3. Each trip records its storage root, so shared and personal Drive trips can coexist in one account while originals stay in their chosen Drive hierarchy.

The full product and engineering requirements are documented in [docs/requirements.md](docs/requirements.md).

## What is implemented

- Clerk email/Google authentication, protected pages and APIs, profile UI, sign-out, and signature-verified idempotent Clerk webhooks
- balanced assignment across up to five ordinary My Drive folders or Workspace Shared Drive roots
- encrypted OAuth refresh-token/service-account credential profiles and an admin-only setup console
- a personal Google Drive connection for non-admin users, with a private TripNest folder under their own My Drive and a per-trip storage choice
- recoverable first-login provisioning using private internal UUID folder names and Drive `appProperties`
- trip creation with dates, location, story, optional cover, and Photos/Videos/Documents/Other subfolders
- chunked Google resumable uploads proxied through Node routes; session URLs never reach browser storage
- IndexedDB resume metadata, multi-file selection, progress, retry, original preview/download, rename, move, and delete
- installable Serwist PWA and optional Manifest V3 Chrome launcher extension
- local credential-free provider, unit/integration tests, Playwright flows, Docker, health endpoint, and production configuration

## Local demo (no Clerk or Google credentials)

The local provider is intentionally obvious in the UI. It is for development only; it stores simulated Drive objects under `.tripnest-mock-drive/` and uses a fixed demo identity. Production mode never uses this directory.

With Docker installed and running, start the complete local stack using `python3 run.py`. On first run, this copies `.env.example` to a private `.env` file; it never overwrites an existing one. Open `http://localhost:3000` after the web service starts. Use `python3 run.py --detach` to run in the background, or `docker compose down` to stop it.

For a host-based Next.js development server instead:

1. Copy `.env.example` to `.env` and leave `TRIPNEST_PROVIDER_MODE=local`.
2. Start PostgreSQL: `docker compose up -d db`.
3. Install and prepare:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

4. Open `http://localhost:3000`. The first dashboard request provisions the demo user and root.

## Project structure

```text
app/          Next.js pages, layouts, API routes, manifest, and service worker source
components/   Reusable application and UI components
docs/         Product and engineering documentation
extension/    Optional Manifest V3 browser launcher
lib/          Authentication, database, Drive, storage, and shared utilities
prisma/       Database schema, migrations, and seed data
public/       Static icons and the offline fallback page
scripts/      Container entrypoint and maintenance scripts
tests/        Unit, integration, and Playwright end-to-end tests
```

Generated output such as `.next/`, `public/sw.js`, reports, coverage, and `tsconfig.tsbuildinfo` is intentionally excluded from Git. Dependencies in `node_modules/`, local mock Drive data, and all `.env` files are also ignored.

## Production setup

### Deploy on Render

The repository includes a Render Blueprint in `render.yaml`. Push the repository to GitHub, then choose **New → Blueprint** in Render and select the repository. The Blueprint provisions the Next.js web service and PostgreSQL database, runs Prisma migrations at startup, and sets `NEXT_PUBLIC_APP_URL` from the generated Render URL.

During Blueprint setup, provide the prompted Clerk publishable key, Clerk secret key, Clerk webhook signing secret, admin Clerk user IDs, Google OAuth client ID and secret, and a random 32-byte `APP_ENCRYPTION_KEY` encoded as 64 hexadecimal characters (`openssl rand -hex 32`). Keep these values in Render's environment settings. Do not put them in `render.yaml` or Git. Configure Clerk's webhook endpoint as `https://<your-render-host>/api/webhooks/clerk`, and add `https://<your-render-host>/api/auth/callback/google` as an authorized redirect URI in the Google OAuth client. In the app, connect the Google storage account and writable Drive root from `/admin/storage` after the first deploy.

If the dashboard says **Storage setup needed**, sign in with a Clerk user whose **user ID** is listed in Render's `ADMIN_CLERK_USER_IDS`, open `/admin/storage`, select **Connect Google Drive**, and add a folder URL under **Verify a Drive folder**. The root must show **healthy** and **On** before a new user's dashboard can provision its private folder. Your local `.env` is never copied to Render. For an existing Render Blueprint service, enter `GOOGLE_DRIVE_ROOT_1_URL` through `GOOGLE_DRIVE_ROOT_5_URL` manually in that service's **Environment** settings; adding `sync: false` keys to an existing Blueprint does not populate them. Redeploy, then revisit `/admin/storage` after connecting a Google account that can write to those folders. Newly created Blueprints prompt for the five URLs during setup.

If Google shows `redirect_uri_mismatch`, open the **Google Auth platform → Clients** page for the OAuth client whose ID is in Render's `GOOGLE_CLIENT_ID`. Add the exact redirect URI shown at the top of `/admin/storage` under **Authorized redirect URIs**. For the default Render hostname in this guide, it is `https://tripnest-iepj.onrender.com/api/auth/callback/google` with no trailing slash. It must be added to the Google Drive OAuth client, which is separate from Clerk's Google sign-in configuration.

Non-admin users can open **My Drive** in the navigation bar and choose **Connect Google Drive**. TripNest requests offline Drive access and creates and verifies a `TripNest` folder in that user's My Drive. On the new-trip form, **Universal Drive** is selected by default when available; a user with a connected personal Drive can instead choose **My Google Drive**. If shared storage is unavailable, the form selects the connected personal Drive. Existing trips remain on their original root, including trips created before personal Drive was connected. Reconnection must use the same Google account. Personal roots do not count toward the five administrator-managed roots and are never offered to other users. Files can move between trips on the same root; cross-root moves are blocked to avoid misplacing originals.

The Blueprint starts with Render's free web and database plans for a low-friction demo. Render's free PostgreSQL database is temporary and expires after 30 days; select a paid database plan in Render before storing data you need to keep. The free web service may sleep when idle.

To test Clerk authentication locally after pulling development keys, run `npm run dev:clerk` and open `/sign-in`. This command enables Clerk for the development server without changing the local demo settings in `.env`. A working dashboard also needs PostgreSQL and a configured writable Google Drive root.

Set both provider-mode variables to `clerk-google`, supply a PostgreSQL URL, Clerk keys/webhook secret, Google OAuth client, and a random 32-byte encryption key (`openssl rand -hex 32`). Use an HTTPS application URL when deployed; `http://localhost:3000` is accepted for local Docker testing. Set `ADMIN_CLERK_USER_IDS` to a comma-separated Clerk user-ID allowlist.

In Clerk, enable email and Google authentication, add `/sign-in` and `/sign-up`, and send user events to `/api/webhooks/clerk`. Clerk's Google login is identity-only and is deliberately unrelated to Drive storage authorization.

The owner then visits `/admin/storage`, connects an OAuth Drive account with offline access, and adds each folder URL. TripNest calls `files.get` to determine whether the folder is an ordinary My Drive folder or belongs to a real Workspace Shared Drive; it does not infer type from the URL. A root can be enabled only after write access succeeds.

`GOOGLE_DRIVE_ROOT_1_URL` through `_5_URL` are imported and write-tested when the storage console opens after a suitable credential is connected. `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is optional and must contain Base64-encoded service-account JSON when used. Leave it empty for OAuth storage accounts. Service accounts must be actual Shared Drive members. Personal My Drive storage should use OAuth from a storage account that owns or can write to the folder; merely sharing a personal folder with a service account does not provide that account personal storage quota.

One credential profile can serve all five roots when it has access. Distinct accounts can be connected as separate encrypted OAuth profiles. Each trip remains on the root selected at creation. Shared-root migrations are explicit: the app checks both credentials, moves the shared user folder in Drive, then updates the user assignment and affected trips in the database. If the database step fails, it attempts to move the folder back; an ambiguous result is held for administrator reconciliation in the storage console. For different accounts, share both roots with one connected storage account before migrating so Drive can move the originals without a lossy relay.

Docker Compose passes the public Clerk key, provider mode, and public app URL as build arguments because Next.js embeds public variables at build time. Set both provider-mode variables before building a production image; do not pass Clerk or Google secrets as build arguments. The Compose service receives private credentials only at runtime through `.env`.

## Security and operational notes

- User identity is obtained only from Clerk's server session; no route accepts an acting user ID.
- Drive tokens and resumable session URLs are AES-256-GCM encrypted. They are never returned to clients or logged.
- Protected content responses are private and use `nosniff`; permanent production media lives only in Google Drive.
- Account deletion marks the user inactive. Drive originals remain until an administrator chooses a cleanup policy.
- There is no application file-count or storage quota. Google capacity/API limits and the configured infrastructure's request limit still apply, and provider errors are surfaced without secrets.
- Multiple roots under one Google account share that account's actual quota. Assigned-user counts are load-balancing metadata, not independent capacity.
- Back up PostgreSQL and the encryption key together. Losing the key makes stored credential material unrecoverable.

## Quality gates

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
docker compose up --build
curl -f http://localhost:3000/api/health
```

Real Google Drive and Clerk verification requires owner credentials and should be completed in a staging environment before production rollout. Local tests exercise the same application-service contract through the mock provider.

## Installable web app

TripNest is installable from the public landing page and from the authenticated navigation bar. The app starts at `/dashboard`, uses the same Clerk session and backend as the website, and hides its install control while running in standalone mode. Chrome and Edge receive the browser-owned install prompt when available. Safari, iPhone, iPad, Android, and unsupported browsers receive instructions appropriate to their platform.

Serwist is enabled only in production builds. Its precache allowlist contains the branded offline document and public application icons. Runtime pages, API responses, Clerk traffic, Drive traffic, private media, and uploads are network-only and are never written to Cache Storage. The offline document explains that a connection is required and contains no account data.

Test the production PWA locally over the localhost secure context:

```bash
npm run build
npm start
```

Open `http://localhost:3000`, then use the Install app control. In Chromium DevTools, check **Application → Manifest** and **Application → Service workers**. Use **Clear site data** when repeating first-install tests. Installation on a deployed environment requires HTTPS and a valid certificate.

- macOS Chrome or Edge: choose **Install TripNest** from the address bar or browser menu.
- macOS Safari: choose **File → Add to Dock** when supported.
- Windows Chrome or Edge: use the address-bar install icon or the browser's app menu.
- Android Chrome: accept the native prompt, or choose **Install app / Add to Home screen** from the menu.
- iPhone or iPad: open the browser Share menu and choose **Add to Home Screen**. iOS does not expose the automatic install prompt.

## Chrome extension

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/`. Set the deployed TripNest address from the popup. The extension holds only the app URL; authentication stays in the normal Clerk session.
