# TripNest product requirements

Build a production-ready application called **TripNest**.

TripNest is a private trip-media organizer. Users sign in using Clerk, create trips, and upload original-quality photos, videos, and documents. Files are stored inside one of five Google Drive root folders controlled by the application owner.

Implement the complete working application. Do not stop after creating a UI mockup. Build authentication, database models, Google Drive integration, folder provisioning, resumable uploads, authorization, PWA functionality, tests, documentation, and deployment configuration.

Make reasonable implementation decisions without repeatedly asking questions. If Google or Clerk credentials are unavailable, implement a clearly labelled local mock provider while keeping the real integration complete and ready to activate.

## 1. Product behaviour

A user must be able to:

1. Visit the landing page.
2. Sign up or sign in using Clerk.
3. Receive a private Google Drive folder automatically.
4. Create a trip with a name and date.
5. Upload any number of photos, videos, and supported documents.
6. Close the application and return later.
7. Add more files to an existing trip.
8. Browse, preview, download, rename, move, and delete their own files.
9. Download original files without quality loss.
10. Install the application as a PWA.
11. Open the application from an optional Chrome extension.

Do not add an application-level file-count limit or storage quota. Real Google Drive capacity, API quotas, infrastructure limits, and maximum supported file sizes still apply. Display clear errors when one of these limits is reached.

## 2. Technology stack

Use:

- Current stable Next.js with App Router
- TypeScript with strict mode
- React Server Components where appropriate
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Clerk using the current supported `@clerk/nextjs` SDK
- PostgreSQL
- Prisma ORM
- Google Drive API v3
- Zod for input and environment validation
- IndexedDB for resumable upload state
- A maintained PWA solution compatible with the selected Next.js version
- Vitest for unit and integration tests
- Playwright for critical end-to-end flows
- Docker and Docker Compose

Use Node.js runtime for Google Drive upload routes. Do not use Edge runtime for file streaming.

Do not use S3, Cloudinary, Firebase Storage, Supabase Storage, or local disk for permanent media storage.

## 3. Clerk authentication

Use Clerk for all user authentication.

Implement:

- `/sign-in`
- `/sign-up`
- Google sign-in through Clerk
- Email authentication through Clerk
- User profile management
- Sign-out
- Protected dashboard and application routes
- Server-side authentication for every protected API operation

Clerk Google sign-in identifies the application user only. It must not request access to the user’s personal Google Drive.

Use the verified Clerk `userId` as the permanent external identity.

Never accept the acting user ID from:

- Request bodies
- Query parameters
- Form values
- Client-controlled headers
- File metadata

Always obtain the user identity from the verified Clerk server session.

Synchronize essential Clerk user information through verified Clerk webhooks. Verify webhook signatures and make processing idempotent.

Do not delete Drive files automatically when a Clerk account is deleted. Mark the database user as deleted or inactive and provide an administrator-controlled cleanup workflow.

## 4. Five Google Drive storage roots

The application owner provides five Google Drive folder URLs.

Support configuration similar to:

```env
GOOGLE_DRIVE_ROOT_1_URL=
GOOGLE_DRIVE_ROOT_2_URL=
GOOGLE_DRIVE_ROOT_3_URL=
GOOGLE_DRIVE_ROOT_4_URL=
GOOGLE_DRIVE_ROOT_5_URL=
```

Extract and validate folder IDs from these URLs.

A configured root can be either:

1. A folder in an ordinary Google account’s My Drive that has been shared with the application’s storage account.
2. A folder inside a real Google Workspace Shared Drive.

Do not confuse an ordinary shared folder with a Google Workspace Shared Drive.

Model every root as a storage profile containing:

- Internal root ID
- Display name
- Google Drive folder ID
- Storage type
- Credential profile
- Enabled status
- Writable status
- Priority
- Current assigned-user count
- Last health-check status
- Last health-check timestamp

If all five folders are accessible through one authorized Google account, allow all five roots to use the same credential profile.

If folders require different Google accounts, support separate encrypted OAuth credential profiles for each root.

For folders in personal My Drive, use OAuth credentials belonging to an account that can write to the folder. Do not assume that sharing a folder with a service account gives the service account usable personal Drive storage.

For Workspace Shared Drives, support a service account or Workspace OAuth account only when it has the required Shared Drive membership and permissions. Use appropriate Drive API options such as `supportsAllDrives` when required.

Never expose Google client secrets, private keys, access tokens, refresh tokens, or resumable upload session URLs to unauthorized clients.

## 5. Owner Google Drive authorization

Build an administrator-only storage setup page.

Restrict it using:

```env
ADMIN_CLERK_USER_IDS=
```

The admin page must allow the owner to:

- Connect or reconnect a Google Drive credential profile
- Paste and validate each root-folder URL
- Test read and write access
- See whether it is My Drive or a Workspace Shared Drive
- Enable or disable a root for new users
- See storage health
- See assigned-user counts
- Inspect authorization errors
- Revoke a credential profile
- Start an explicit user migration between roots

Use server-side OAuth with offline access when OAuth credentials are required.

Encrypt stored refresh tokens and other credential material using an application encryption key.

Protect OAuth callback state, validate redirects, and prevent open redirects.

Do not place secrets in client components, browser storage, application logs, error messages, or database fields that are not encrypted.

## 6. User-folder allocation

When a Clerk user enters the application for the first time:

1. Create or retrieve the database user.
2. Select one enabled and writable Google Drive root.
3. Save the root assignment permanently.
4. Create the user’s private folder inside that root.
5. Save its Google Drive folder ID.
6. Open the user’s dashboard.

Use a server-generated internal UUID for folder identity.

Folder format:

```text
user_<internal-user-uuid>
```

Do not use the user’s email address, phone number, or full name as the folder name.

Default root-selection strategy:

- Choose the enabled healthy root with the lowest assigned-user count.
- Break ties using root priority and a deterministic rule.
- Once assigned, keep the user on the same root.
- Never silently split one user’s trips across different roots.

Make first-login provisioning:

- Transactional where possible
- Idempotent
- Safe against simultaneous requests
- Recoverable when Drive folder creation succeeds but the database transaction fails
- Protected against duplicate user folders

Use a provisioning state such as:

- `PENDING`
- `PROVISIONING`
- `READY`
- `FAILED`

Use an idempotency key or Drive `appProperties` containing the internal user UUID so an interrupted operation can locate and reuse the folder instead of creating another one.

Five folders in the same Google account do not create five separate storage quotas. Track and describe storage according to the actual Google account or Workspace storage pool.

## 7. Folder organization

Use this Google Drive structure:

```text
Storage Root 1/
  user_<internal-user-uuid>/
    Ooty — 2026-10-19/
      Photos/
      Videos/
      Documents/
      Other/

Storage Root 2/
  user_<another-internal-user-uuid>/
    Goa — 2026-12-10/
      Photos/
      Videos/
      Documents/
      Other/
```
When creating a trip, collect:

- Trip name
- Start date, defaulting to the user’s local date
- Optional end date
- Optional description
- Optional cover photo
- Optional location

Trip folder names should be human-readable, but database IDs and Drive IDs must remain authoritative.
