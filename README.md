# Safar Rakshak 1.0

A lightweight, browser-based travel planning companion.

## Features

- Trip planning for a custom destination or a suggested getaway
- Day-by-day starter itinerary and travel-style suggestions
- Daily budget target and editable budget allocation guide
- Adventure, family, solo, and comfort-first travel styles
- Packing checklist with progress saved on this device
- Save and restore a trip plan using browser storage
- Share a plan with the device share menu or copy it to the clipboard
- Download a plain-text trip plan
- Save one trusted travel contact locally for quick access
- Responsive layout, keyboard focus styles, and reduced-motion support

Trip ideas and budget allocations are planning aids. Confirm prices, bookings, opening times, weather, transport, and safety information with current local sources.

## Run locally

Open a terminal in this folder and run:

```powershell
py -m http.server 8080
```

Then visit <http://localhost:8080>.

The page uses Tailwind CSS's browser CDN, so an internet connection is needed to load the Tailwind utilities and web fonts. App plans and the saved contact remain in the browser's local storage.
