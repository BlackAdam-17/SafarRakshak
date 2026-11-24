# SafarRakshak

A travel safety companion for planning trips, keeping trusted contact details close, and recording personal check-ins.

## Features

- Server-backed registration with generated user IDs and individual accounts
- Encrypted trip plans, profiles, and check-ins saved in SQLite
- Passwords stored as scrypt hashes; sessions use secure, HTTP-only cookies
- Nearby police and pharmacy searches, initiated only when requested
- Call India's emergency number, 112, from a compatible device
- Responsive layout, keyboard focus styles, and reduced-motion support

## Run locally

Requires Node.js 22 or later.

```powershell
npm install
npm start
```

Open <http://localhost:8080>. The local database is created under `data/`; a local encryption key is generated there on first start. Keep both files private and backed up together. To run with automatic restarts, use `npm run dev`. Run the API tests with `npm test`.

The registration prompt appears 10 seconds after the account session is checked and can be dismissed. Passwords must be at least 12 characters. Existing accounts and trip data created by the old browser-only prototype are not imported; those accounts must register again. Old prototype data remains in that browser's local storage unless you remove it.

## Deploy to Railway

1. Connect this repository to a Railway project and deploy the `main` branch.
2. Add a Railway volume mounted at `/data`. Configure one running application instance; SQLite is not intended for multiple replicas.
3. Set these service variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_PATH` | `/data/safar-rakshak.sqlite` |
   | `PROFILE_ENCRYPTION_KEY` | A new, random 64-character hexadecimal secret |
   | `APP_ORIGIN` | The exact public origin, such as `https://your-service.up.railway.app` |

   Generate the encryption key locally with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Enter the value as a Railway secret; never commit it, put it in a build argument, or share it. Railway supplies `PORT` automatically.
4. Wait for the deployment health check at `/health` to return `{"status":"ok"}`. Keep the volume attached across deploys. Back up the SQLite database and encryption key separately and securely; losing the key makes encrypted profile and trip data unrecoverable.

Railway account access and repository deployment permissions are required to complete the hosted deployment. Do not scale this SQLite service horizontally. For roughly 200 users, this is a small single-instance setup, not a measured capacity guarantee.

## Data and safety notes

Profile details and saved trip/check-in content are encrypted with AES-256-GCM before being written to SQLite. The encryption key is stored outside the database. Passwords are processed using scrypt and are not recoverable. Session cookies are HTTP-only and same-site; state-changing API requests are origin- and CSRF-checked and authentication endpoints are rate-limited.

This app stores sensitive personal information, including address, mobile number, and age. Use a unique password, restrict access to the Railway project, and maintain protected backups. The application does not currently provide self-service account deletion or password recovery.

Nearby searches request location only after you press the corresponding button. Coordinates are sent to the public OpenStreetMap Overpass service for listings and are not saved to your profile. Listings may be incomplete or out of date. The app does not dispatch emergency alerts or guarantee station listing accuracy or availability. In an emergency, contact local emergency services directly.
