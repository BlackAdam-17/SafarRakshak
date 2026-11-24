# SafarRakshak

A browser-based travel safety companion for planning a trip, keeping trusted contact details close, and recording personal check-ins.

## Features

- Save a destination, travel dates, itinerary notes, and trusted contact on this device
- Add, schedule, complete, and remove personal check-ins
- Find public police station listings near your current location and open directions
- Call India's emergency number, 112, from a compatible device
- Responsive layout, keyboard focus styles, and reduced-motion support

## Run locally

Open a terminal in this folder and run:

```powershell
py -m http.server 8080
```

Then visit <http://localhost:8080>.

The app's trip details and check-ins are stored in the browser's local storage. Nearby station search requests location only after you press **Find nearby police**. The coordinates are sent to the public OpenStreetMap Overpass service to search nearby listings; no alert is sent to police. An internet connection is required for this search and for map directions.

SafarRakshak does not dispatch emergency alerts or guarantee station listing accuracy or availability. Confirm current local emergency numbers and official safety guidance before travel. In an emergency, contact local emergency services directly.
