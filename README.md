# SafarRakshak

A browser-based travel safety companion for planning a trip, keeping trusted contact details close, and recording personal check-ins.

## Features

- Save a destination, travel dates, itinerary notes, and trusted contact on this device
- Add, schedule, complete, and remove personal check-ins
- Find public police station listings near your current location and open directions
- Create browser-local profiles with generated user IDs and separate trip plans/check-ins
- Search for nearby pharmacies on the Trip Area page when you choose to share your location
- Compare driving route options, preview routes on a map, and open directions in Google Maps
- Call India's emergency number, 112, from a compatible device
- Responsive layout, keyboard focus styles, and reduced-motion support

## Run locally

Install Node.js 22 or later, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create the production website build, run `npm run build`; generated files are placed in `dist/`.

## GitHub Pages

The GitHub Actions workflow deploys the static frontend from `main`. In repository Settings → Pages, set the build and deployment source to **GitHub Actions**.

## Safety Route Navigator

Open **Route Navigator** to enter a starting point and destination or use your current location. The page geocodes place names with OpenStreetMap Nominatim and requests driving route options from the public OSRM demo service. Route estimates and map data depend on third-party availability and may be incomplete.

These are routing options, not safety scores. The application does not verify crime rates, lighting, traffic, road closures, or emergency response, and it must not be used as a guarantee that a route is safe. Location access is requested only after the user selects the location button.

## React and Tailwind CSS

The homepage includes a React-powered travel toolkit section styled with Tailwind CSS v4. Trip Area and Route Navigator layouts are rendered by React while existing scripts are retained to preserve current workflows during the gradual migration.

## Node.js API (Express + MongoDB)

The API in `server/` provides registration/login with bcrypt password hashing and short-lived JWTs, authenticated trip CRUD endpoints, MongoDB models, Zod request validation, Helmet security headers, CORS allow-list, JSON size limits, rate limiting, and `/api/health`.

### Local API setup

```bash
npm install
cp .env.example .env
# Configure MONGODB_URI and a unique JWT_SECRET (at least 32 characters).
npm run server:dev
```

Run the frontend in a second terminal with `npm run dev`. The API listens on port 4000 by default.

### Deploy the API to Render

A Render Blueprint is included at the repository root as `render.yaml`.

1. Create or sign in to a Render account and connect your GitHub account.
2. Create a MongoDB database in MongoDB Atlas. Create a database user, allow network access from Render (for a simple student deployment you can initially allow `0.0.0.0/0`, while keeping strong database credentials), and copy the MongoDB connection string.
3. In Render, choose **New → Blueprint**, select `BlackAdam-17/SafarRakshak`, and select the `main` branch.
4. Render reads `render.yaml` and proposes a web service named `safarrakshak-api` in Singapore on the Free plan.
5. When prompted, provide `MONGODB_URI` using the Atlas connection string. Render generates `JWT_SECRET`; keep it private. `CLIENT_ORIGIN` is set to `https://blackadam-17.github.io`.
6. Deploy and wait for the service health check to pass. Verify `https://YOUR-SERVICE.onrender.com/api/health` returns JSON with `status: "ok"`.

The service is configured to deploy from `main` after GitHub checks pass. The Free web service may spin down after inactivity and take time to wake on its next request.

**Important current limitation:** the existing browser-local account, trip, and check-in UI is not yet connected to this API. Deploying the API does not automatically migrate local browser data or activate server-backed login/trips in the website. The GitHub Pages frontend remains a separate static deployment. Never commit MongoDB credentials or JWT secrets.
