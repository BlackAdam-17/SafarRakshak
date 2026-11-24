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

Open a terminal in this folder and run:

```powershell
py -m http.server 8080
```

Then visit <http://localhost:8080>.

Registration appears after 10 seconds and can be dismissed. Accounts, profile details, and trip plans are stored only in this browser; profiles do not sync between devices or browsers. Passwords are stored as salted PBKDF2 hashes, but this browser-only prototype is not a secure production account system. Other people with access to the same browser profile can access saved account details. Use test information and do not reuse an important password.

## GitHub Pages

The GitHub Actions workflow deploys the static site when `main` is pushed. In the repository settings, open **Pages** and set the build and deployment source to **GitHub Actions**. This browser-only version stores each profile and trip locally; it does not use a server or shared database.

Nearby police and pharmacy searches request location only after you press the corresponding button. Coordinates are sent to the public OpenStreetMap Overpass service for listings and are not saved to your profile. An internet connection is required. Listings may be incomplete or out of date. The app does not estimate crowd levels or identify routes as safe or unsafe.

SafarRakshak does not dispatch emergency alerts or guarantee station listing accuracy or availability. Confirm current local emergency numbers and official safety guidance before travel. In an emergency, contact local emergency services directly.


## Safety Route Navigator

Open **Route Navigator** to enter a starting point and destination or use your current location. The page geocodes place names with OpenStreetMap Nominatim and requests driving route options from the public OSRM demo service. Route estimates and map data depend on third-party availability and may be incomplete.

These are routing options, not safety scores. The application does not verify crime rates, lighting, traffic, road closures, or emergency response, and it must not be used as a guarantee that a route is safe. Location access is requested only after the user selects the location button. When current location is selected, its coordinates are sent to the geocoding/routing service only as needed for the route request.


## React.js and Tailwind CSS

The home page now includes a React-powered travel toolkit section styled with Tailwind CSS v4. Existing HTML/CSS/JavaScript trip planning, account, check-in, pharmacy and route navigator pages are retained during this gradual migration.

### Install and run locally

Install Node.js 22 or later, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create the production website build, run `npm run build`; the generated files are placed in `dist/`.

React and Tailwind CSS are open-source dependencies. This migration deliberately keeps the established pages and browser-local data workflows intact while introducing React/Tailwind incrementally.


## React migration and backend foundation

The Trip Area and Route Navigator layouts are rendered by React components. Their existing DOM IDs are retained so the location-search, map, and route scripts continue to work during migration. The homepage journey planner and check-in workflow remain compatible with the existing scripts.

### Node.js API (Express + MongoDB)

The API foundation in `server/` provides registration and login with bcrypt password hashing and short-lived JWTs, authenticated trip-plan read/create/update/delete endpoints, MongoDB user/trip/check-in models, request validation, security headers, CORS allow-list, JSON size limits, API rate limiting, and `/api/health`.

Local setup:

```bash
npm install
cp .env.example .env
# Configure MONGODB_URI and a unique JWT_SECRET of at least 32 characters.
npm run server:dev
```

Run the frontend in a second terminal with `npm run dev`. The API listens on port 4000 by default.

**Deployment note:** GitHub Pages hosts the static frontend only; it cannot run this Node.js API. Deploy the API to a Node-compatible hosting service and provision MongoDB. Set `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` as private environment variables on the API host. Never commit real credentials. Existing browser-local account and trip workflows have not yet been connected to the API, and local data is not automatically migrated to MongoDB.
