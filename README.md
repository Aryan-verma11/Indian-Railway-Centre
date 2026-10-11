# Indian Railway Centre – User Information Portal

A private portal for about 50 users. Candidates log in with Registration Number and Date of Birth and see only their own record.
Administrators log in with Registration Number and Password from a separate admin login page. This is an independent application and is not an official Indian Railways or government website.

## Features
- **Candidates:** login with Registration Number + Date of Birth, view own details (Roll Number, Name, Father's Name, Gender, Date of Birth), sign out.
- **Admins:** separate password login, dashboard, user list with search, filters and pagination, add / view / edit / delete users, enable / disable accounts, change role, reset password, audit log, sign out of all devices.
- **Security:** bcrypt passwords, JWT with server-side session revocation (`token_version`), role checks against the database on every request, server-side validation, rate limiting, Helmet, strict CORS, audit logging.

## Tech stack
React + Vite + React Router + Axios (client) · Node.js + Express (server) · MySQL · bcrypt · JWT · Helmet · express-rate-limit.
Node.js 18 or newer is required.

## Folder structure
```
client/src/   components, pages (pages/admin for the Admin Panel), context, services
server/       config, controllers, middleware, routes, utils (migrate, importUsers, manageUsers), tests
database/     schema.sql, sample-users.json (fake demo data, local only)
```

## Local setup
1. Install MySQL 8 (or MariaDB 10.5+) and create the database. **The database name is `irc`.**
   ```
   mysql -u root -p -e "CREATE DATABASE irc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```
2. Configure the server: `cp server/.env.example server/.env`, then set `DB_PASSWORD` and `JWT_SECRET`
   (at least 32 characters): `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   ```
   PORT=5000  DB_HOST=localhost  DB_PORT=3306  DB_NAME=irc  DB_USER=root  DB_PASSWORD=...
   JWT_SECRET=...  JWT_EXPIRES_IN=2h  CLIENT_URL=http://localhost:5173
   ```
3. Create or upgrade the tables (safe to run repeatedly; it never drops anything and keeps existing data):
   ```
   cd server && npm install && npm run migrate
   ```
   `migrate` applies `database/schema.sql` (`CREATE TABLE IF NOT EXISTS`) and then adds any missing columns
   (`token_version`, `is_active`, `last_login_at`) to an existing `users` table. A fresh install can instead run
   `mysql -u root -p irc < database/schema.sql`.
4. Demo data (local development only): set `ALLOW_DEMO_DATA=true` in `server/.env`, then run `npm run seed` in `server/`. Demo data is refused when `NODE_ENV=production`, and it is recognised by the `--demo` flag, the real path of `database/sample-users.json`, or any row that reuses a demo password (renaming or copying the file does not bypass the check). Remove `ALLOW_DEMO_DATA` again afterwards.
5. Start: `cd server && npm run dev`, then `cd client && npm install && npm run dev`. Open http://localhost:5173.

### Demo accounts (fake, local only – never create these in production)
| Role | Roll Number | Password |
|---|---|---|
| Admin | IRCADMIN | Admin@12345 |
| User | IRC230001 / IRC230002 / IRC230003 | Test@12345 / Test@12346 / Test@12347 |

Users go to `/details` after login; administrators go to `/admin`.

## Creating the first real administrator
```
cd server
npm run users -- create-admin ADMIN001 "Full Name"        # prompts for a hidden password; leave empty for a random one (printed once)
npm run users -- list
npm run users -- reset-password IRCADMIN                  # administrator accounts only; candidates use DOB login
npm run users -- set-role IRC230001 admin
npm run users -- delete IRC230099
```
Passwords are never taken from the command line by default: you are prompted (hidden input), or you can set the
`IRC_PASSWORD` environment variable for one command. A password given as a trailing argument still works but prints a
warning because it stays in shell history. Like the Admin Panel, the CLI refuses to delete or demote the last active administrator.
CLI actions are recorded in the audit log with the actor `CLI`.

Real users: put them in `database/users.production.json` (git-ignored, same format as `sample-users.json`), then
`npm run import-users -- ../database/users.production.json`, and delete the file afterwards. Or add them in the Admin Panel.
**Import is insert-only:** a roll number that already exists (in the database or earlier in the file) is skipped and reported; its password, role,
status, token version and details are never changed. Every row is validated first; if any row is invalid nothing is imported.

## Admin Panel
`/admin` dashboard · `/admin/users` list, search, filters, pagination · `/admin/users/new` · `/admin/users/:id` details and actions
(enable/disable, change role, reset password, delete) · `/admin/users/:id/edit` · `/admin/audit` audit log · `/admin/settings`.
Deleting needs confirmation; disabling is preferred. The last active administrator cannot be deleted, disabled or demoted, and nobody can delete or disable their own account.
An admin-set temporary password is shown once on screen; share it privately.

## API
All admin endpoints require a valid token (401 otherwise) and the admin role (403 otherwise).
| Endpoint | Purpose |
|---|---|
| POST /api/auth/login · GET /api/auth/me · POST /api/auth/logout | Login (generic failure message), own record, logout |
| POST /api/auth/change-password · POST /api/auth/logout-all | Admin password change, end all own sessions; candidate password change is disabled |
| GET /api/admin/stats · GET /api/admin/audit-logs | Dashboard counts, audit log |
| GET/POST /api/admin/users · GET/PUT/DELETE /api/admin/users/:id | List/search, create, read, update, delete |
| PATCH /api/admin/users/:id/status · PATCH …/role · POST …/reset-password | Enable/disable, change role, reset administrator passwords (candidate password reset is disabled) |

## Security notes
- Passwords are bcrypt hashed (cost 12). `password_hash`, `token_version` and admin-only fields are never sent to normal users; `password_hash` is never sent to anyone.
- Every JWT carries `token_version`. On every request the server loads the user and checks `is_active`, `token_version` and the **current database role**. Password change/reset, role change and disabling increment `token_version`, so old tokens (including an old admin token after demotion) stop working immediately. Changing your own password returns a fresh token.
- All SQL is parameterized. Input is whitelisted and validated on the server (mass assignment is not possible: role, status and password cannot be set through the update endpoint).
- Login failures are identical for unknown roll numbers and wrong passwords. Disabled users get a clear message only after supplying the correct password.
- Rate limits (15 minutes): failed logins are limited per IP address (100) **and** per roll number (10), counted whether or not the roll number exists, so many users behind one institutional NAT are not locked out together while a single account still cannot be brute-forced from many addresses. Trade-off: someone who knows a roll number can block that account's logins for up to 15 minutes. Other limits per IP: admin change-password 10, admin reset-password 30, whole API 600. Tune with `LOGIN_IP_LIMIT` / `LOGIN_ACCOUNT_LIMIT`.
- `TRUST_PROXY` controls how the client IP is determined (rate limiting, audit log). Default: do not trust `X-Forwarded-For`. Behind one reverse proxy (Render, Railway) set `TRUST_PROXY=1`; `true` is rejected because it allows IP spoofing. Without it, a server behind a proxy sees every client as the proxy's IP.
- CORS allows only `CLIENT_URL` (comma-separated list supported). Helmet headers are enabled, API responses are `no-store`, request bodies are limited to 10 KB.
- The token is stored in `sessionStorage` and sent as a Bearer header (avoids cross-site cookie problems on iPhones). Like any browser-stored token it could be read by an XSS flaw, so keep dependencies updated. Tokens last 2 hours.
- Audit log records user create/update/delete, enable/disable, role changes, password resets/changes, and admin logins (including failed admin logins). It never stores passwords or tokens.
- Dependency audit: server has 0 known vulnerabilities. The client still reports advisories in the Vite/esbuild **development server** (not part of the production build) and in React Router features this app does not use (it only links to fixed internal paths). Fixing them needs major upgrades (Vite 7, React Router 7); plan these separately.

## Health checks
`GET /api/health` is liveness (the process is up; no database access). `GET /api/ready` is readiness: it returns 200 `{database:"up"}` or 503 `{database:"down"}` without exposing connection details. On startup the server checks the database: in production it exits if the database is unreachable, in development it logs a warning and keeps running. It shuts down gracefully on SIGTERM/SIGINT.

## Development commands
```
server:  npm run dev | npm start | npm run migrate | npm run seed | npm run users -- <cmd> | npm run test:unit | npm run test:api | npm test
client:  npm run dev | npm run build | npm run preview
```
`npm run test:unit` needs no server or database (it uses an in-memory SQLite database through Node's built-in `node:sqlite`, Node 22.5+; tests are skipped on older Node) and covers the CLI last-admin protection, the insert-only import, the demo-data guard and proxy configuration. It exercises the SQL on SQLite, not MySQL. `npm run test:api` (part of `npm test`) runs integration tests against a running server (`API_URL`, default http://localhost:5000/api) and a database that has the demo users. Run it only against a development database: it creates and removes its own `TESTQA01` user and changes demo-user state.

## Production deployment
1. Create a managed MySQL database named `irc` and a dedicated database user with rights only on it.
2. Backend (Render/Railway): root `server`, build `npm install`, start `npm start`. Environment variables: `NODE_ENV=production`, `TRUST_PROXY=1` (single reverse proxy), `DB_HOST`, `DB_PORT`, `DB_NAME=irc`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true` if required, `JWT_SECRET` (32+ random characters), `JWT_EXPIRES_IN=2h`, `CLIENT_URL=https://your-frontend-domain` (exact origin, no trailing slash; the server refuses to start with localhost when `NODE_ENV=production`).
3. Run `npm run migrate` once against the production database (locally with production values in `server/.env`, or in the host's shell), then create the first admin with `npm run users -- create-admin …`.
4. Frontend (Vercel): root `client`, build `npm run build`, output `dist`, environment variable `VITE_API_URL=https://your-backend-domain/api`. `vercel.json` rewrites all paths to `index.html`.
5. Test login as admin and user from a phone and a laptop. Add a custom domain in Vercel, then add it to `CLIENT_URL` and redeploy the backend.

## Troubleshooting
- **Server exits at start:** a required variable is missing or `JWT_SECRET` is shorter than 32 characters.
- **`ECONNREFUSED` / access denied:** MySQL is not running, or `DB_*` values are wrong.
- **`Unknown database 'irc'`:** run the `CREATE DATABASE irc` command above.
- **Login says too many attempts:** wait 15 minutes or restart the server (limits are in memory).
- **CORS error in the browser:** `CLIENT_URL` must exactly match the frontend origin.
- **Everyone is signed out after a role/password change:** expected; that is session revocation working.


## Candidate sign-in and student details UI update

- Candidate sign-in uses `roll_number` plus `date_of_birth` (`YYYY-MM-DD`) at `POST /api/auth/login`; it never accepts a password fallback.
- Administrator password sign-in remains separate at `POST /api/auth/admin-login`. Keep existing admin password hashes and secrets intact.
- Student details screen displays only roll number, name, father's name, gender, and DOB from the authenticated user's `/api/auth/me` response.
- The DOB dropdown form rejects incomplete, impossible, and future dates in the browser; the API repeats strict date validation and only authenticates active `user` role accounts.
- New candidate accounts must have a valid date_of_birth at creation/import; admin accounts may omit DOB. Candidate password change/reset is disabled because candidate sign-in uses DOB. Existing user records and the existing schema are preserved. Check which candidate DOBs need to be populated before enabling this sign-in method:

```sql
SELECT roll_number, name, date_of_birth, is_active
FROM users
WHERE role = 'user' AND (date_of_birth IS NULL OR date_of_birth < '1900-01-01' OR date_of_birth > CURRENT_DATE());
```

Update missing DOBs only from a trusted institutional source; do not infer them. No schema migration is required because `date_of_birth` already exists.

### Run on Windows

```powershell
cd server
npm install
npm run migrate
npm run dev
```

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

The existing `.env` values are not included in this documentation; configure local environment variables from `.env.example`. API integration tests require a running server and a reachable MySQL database. Candidate DOB login will fail for users whose stored DOB is missing or inaccurate.
