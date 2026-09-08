# InTime Attendance Management Portal

A full-stack attendance management system with employee self-check-in
(WebAuthn passkey + geolocation) and an enterprise admin dashboard.

## Overview

- **Employee portal** — sign in, register a passkey once, then mark
  attendance from the office (30m geofence) or remotely (with a reason),
  view attendance history, and manage your profile.
- **Admin portal** — dashboard with live stats and charts, employee
  management, full attendance browsing, and Excel/PDF report export.

No IP or Wi-Fi verification is used anywhere. Office attendance is
authorized purely by **passkey + 30 meter office geofence**, both
re-validated on the server.

## Technology Stack

**Frontend:** React 19 + Vite, React Router, Axios, Recharts, Lucide icons,
`@simplewebauthn/browser`, plain CSS (mobile-first, light/dark themes).

**Backend:** Node.js + Express, MongoDB + Mongoose, JWT (HTTP-only cookies),
`@simplewebauthn/server`, bcryptjs, Multer, ExcelJS, PDFKit, Helmet,
express-rate-limit, express-validator, Morgan.

## Folder Structure

```
Attendance-Management-Portal/
├── Frontend/     React app (Vite)
├── Backend/      Express API
├── package.json  Root dev orchestration
└── README.md
```

See `Frontend/src` and `Backend/src` for the detailed internal structure
(Components/Pages/Routes/Services/Context/Utils on the frontend;
config/controllers/middleware/models/routes/services/utils on the backend).

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (or any MongoDB instance) and its connection string

## Installation

```bash
npm install
npm run install:all
```

## Environment Setup

Copy the example env files and fill in real values:

```bash
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

`Backend/.env` — at minimum, set:

```env
MONGODB_URI=<your MongoDB Atlas connection string>
JWT_ACCESS_SECRET=<random string, e.g. `openssl rand -hex 48`>
JWT_REFRESH_SECRET=<a different random string>
SEED_ADMIN_EMAIL=<the first admin's email>
SEED_ADMIN_PASSWORD=<the first admin's password>
```

Everything else (office coordinates, radius, attendance timing rules,
token lifetimes, WebAuthn RP config) has sensible defaults matching the
spec and can be left as-is for local development.

`Frontend/.env` defaults to `VITE_API_URL=/api`, which relies on the Vite
dev server's proxy (configured in `Frontend/vite.config.js`) to forward
`/api` and `/uploads` to the backend on port 5055. This means the browser
always talks to a single origin — whatever host is serving the frontend
(`localhost`, or a LAN IP when using `--host`) — so cookies work as
same-origin with no CORS complications. Only change `VITE_API_URL` to an
absolute URL for a production build served from a different origin than
the API.

## MongoDB Setup

1. Create a free cluster on MongoDB Atlas (or use any MongoDB 6+ instance).
2. Create a database user and allow network access from your IP (or
   `0.0.0.0/0` for local development).
3. Copy the connection string into `Backend/.env` as `MONGODB_URI`. The
   database name `InTimeAttendance` is set in code
   (`Backend/src/config/db.js`) — you don't need to include it in the URI.

## Running the App

From the repository root:

```bash
npm run dev
```

This starts:
1. **Backend API** (`http://localhost:5055`)
2. **Frontend App** (`https://localhost:5173`)
3. **Phone Tunnel** via Cloudflare Tunnel (`https://*.trycloudflare.com`)

The terminal will automatically display the phone/tunnel link, local link, and demo credentials.

- To skip the phone tunnel and only run Frontend + Backend:
  ```bash
  npm run dev -- --no-tunnel
  ```
- To make the frontend reachable on your local LAN IP:
  ```bash
  npm run dev -- --host
  ```
- To run only the phone tunnel on its own:
  ```bash
  npm run tunnel
  ```

## Creating the First Admin

```bash
npm run seed:admin
```

Reads `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from
`Backend/.env` and creates the admin account if it doesn't already exist.
Sign in at `/admin/login`.

## WebAuthn / Passkey Setup — read this before testing on a phone

WebAuthn (passkeys) only works in a **secure context**: `https://`, or the
special case of `http://localhost`. A LAN IP like `http://192.168.1.23:5173`
is **not** secure and passkeys will simply fail to appear, in any browser.

- **Testing on your laptop:** works out of the box at `http://localhost:5173`.
- **Testing on your phone:** you need a real HTTPS origin. The easiest way
  is a tunnel (e.g. `ngrok http 5173`, or a Cloudflare Tunnel) pointed at
  your Vite dev server. Once you have a tunnel URL like
  `https://abcd1234.ngrok-free.app`, add it to `Backend/.env`:

  ```env
  WEBAUTHN_RP_ID=localhost,abcd1234.ngrok-free.app
  WEBAUTHN_ORIGIN=http://localhost:5173,https://abcd1234.ngrok-free.app
  CLIENT_URL=https://abcd1234.ngrok-free.app
  ```

  Both variables accept comma-separated lists, so localhost keeps working
  for laptop testing while the tunnel domain enables phone testing. Restart
  the backend after changing `.env`.
- In production, set `WEBAUTHN_RP_ID` to your real domain (no scheme, no
  port) and `WEBAUTHN_ORIGIN`/`CLIENT_URL` to the full `https://` URL.

### First-time passkey registration flow

The first time an employee taps **Give Attendance** (Office or Distance)
without a passkey on file, they see a **Register your Passkey** prompt
instead of the attendance flow. Registering triggers the browser's native
platform authenticator prompt — Face ID / Touch ID on iPhone and Mac,
Windows Hello on a PC, fingerprint/face unlock on Android. Once
registration succeeds, the app immediately continues into the attendance
flow they originally asked for. From then on, every check-in on that
device just asks for the passkey (no re-registration needed). An employee
can register additional passkeys later (e.g. one on their phone, one on
their laptop) from **Profile**.

The server never sees or stores any biometric data — only a WebAuthn
public key and credential ID (`Backend/src/models/PasskeyCredential.js`).

## Local HTTPS Considerations

For a fully local HTTPS setup instead of a tunnel, tools like `mkcert` can
generate a locally-trusted certificate for Vite's dev server. Configure
`server.https` in `Frontend/vite.config.js` with the generated cert/key,
and update `WEBAUTHN_ORIGIN`/`WEBAUTHN_RP_ID` to match.

## Production Deployment Notes

- Set `NODE_ENV=production` on the backend — this enables `secure` and
  `sameSite=none` cookies (required if frontend and backend are on
  different domains) and disables verbose request logging.
- Serve the frontend build (`npm run build` → `Frontend/dist`) from a
  static host or CDN, and point `VITE_API_URL` at the real backend origin.
- Set `CLIENT_URL`, `WEBAUTHN_ORIGIN`, and `WEBAUTHN_RP_ID` to your real
  production domain.
- Use strong, unique values for `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.

## API Overview

All endpoints are namespaced under `/api`. See `Backend/src/routes/` for
the full list; the main groups are:

- `POST /api/auth/employee/login`, `/api/auth/admin/login`, `/api/auth/refresh`,
  `/api/auth/logout`, `GET /api/auth/me`
- `POST /api/passkeys/register/options|verify`, `/api/passkeys/auth/options|verify`
- `GET/PUT /api/employees/me`, `/api/employees/me/change-password`,
  `/api/employees/me/profile-photo`
- `POST /api/attendance/office`, `/api/attendance/distance`,
  `POST /api/attendance/checkout`, `GET /api/attendance/my-records`,
  `GET /api/attendance/today`
- `GET /api/admin/dashboard`, employee CRUD under `/api/admin/employees`,
  `GET /api/admin/attendance`
- `GET /api/reports/attendance`, `/api/reports/attendance/excel`,
  `/api/reports/attendance/pdf`

Responses follow `{ success, message, data? }` on success and
`{ success: false, message, code }` on error.

## Business Rules Implemented

- **Office hours:** 9:30 AM – 5:30 PM · **On Time** ≤ 9:30, **Slight Late**
  9:30–9:45, **Very Late** > 9:45 (server time, `APP_TIMEZONE`).
- **Minimum working hours:** 8 hours; falling short flags
  `insufficientHours` without overwriting the lateness classification.
- **One attendance record per employee per working day**, enforced by a
  unique database index in addition to application checks.
- **Employee weekly re-authentication:** the refresh token is valid
  Monday–Saturday of the week it was issued; Sunday is a reset day where
  no refresh token is considered valid; every Monday requires a fresh
  login (`Backend/src/utils/authWeek.js`).
- **Office geofence (30m) and passkey verification are always re-checked
  server-side** — the client's readings are for UX only.

## Development Commands

```bash
npm install          # root dev tooling (concurrently)
npm run install:all  # installs Backend + Frontend dependencies
npm run dev          # runs Backend + Frontend together
npm run dev -- --host  # same, with the frontend bound to the LAN
npm run build         # builds the Frontend for production
npm run seed:admin    # creates the first admin account
```
