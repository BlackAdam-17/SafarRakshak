# SafarRakshak

A browser-based travel safety companion for planning a trip, keeping trusted contact details close, and recording personal check-ins.

## Features

- Save a destination, travel dates, itinerary notes, and trusted contact on this device
- Add, schedule, complete, and remove personal check-ins
- Find public police station listings near your current location and open directions
- Create browser-local profiles with generated user IDs and separate trip plans/check-ins
- Search for nearby pharmacies on the Trip Area page when you choose to share your location
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
