import './account-ui.js?v=4';

const $ = (selector) => document.querySelector(selector);
const form = $('#routeForm');
const originInput = $('#routeOrigin');
const destinationInput = $('#routeDestination');
const status = $('#routeStatus');
const results = $('#routeResults');
const summary = $('#routeSummary');
const findButton = $('#findRoutes');
const locationButton = $('#useLocation');
const mapElement = $('#routeMap');

let currentOrigin = null;
let routes = [];
let map = null;
let routeLayers = [];
let selectedRoute = 0;

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000
    });
  });
}

locationButton.addEventListener('click', async () => {
  locationButton.disabled = true;
  showStatus('Requesting your location from the browser…');
  try {
    const position = await getPosition();
    const { latitude, longitude } = position.coords;
    currentOrigin = { lat: latitude, lon: longitude, label: 'Your current location' };
    originInput.value = currentOrigin.label;
    showStatus('Current location selected as your starting point. Coordinates are used only for this route request.');
  } catch (error) {
    const messages = {
      1: 'Location permission was denied. Enter your starting point manually or change browser location permissions.',
      2: 'Your location could not be determined. Enter your starting point manually and try again.',
      3: 'Location request timed out. Try again or enter your starting point manually.'
    };
    showStatus(messages[error.code] || error.message || 'Could not access your location.', true);
  } finally {
    locationButton.disabled = false;
  }
});

let lastNominatimRequestAt = 0;

async function geocodeWithPhoton(query) {
  const url = new URL('https://photon.komoot.io/api/');
  url.search = new URLSearchParams({ q: query, limit: '1', lang: 'en' }).toString();
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Photon place search returned HTTP ' + response.status);
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature?.geometry?.coordinates) return null;
  const [lon, lat] = feature.geometry.coordinates;
  const properties = feature.properties || {};
  const label = [
    properties.name,
    properties.street,
    properties.city || properties.locality,
    properties.state,
    properties.country
  ].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ');
  return { lat: Number(lat), lon: Number(lon), label: label || query };
}

async function geocodeWithNominatim(query) {
  // Public Nominatim usage is limited to one request per second.
  const wait = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimRequestAt = Date.now();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  }).toString();
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Backup place search returned HTTP ' + response.status);
  const places = await response.json();
  if (!places.length) return null;
  return {
    lat: Number(places[0].lat),
    lon: Number(places[0].lon),
    label: places[0].display_name
  };
}

async function geocode(query) {
  let photonError;
  try {
    const place = await geocodeWithPhoton(query);
    if (place) return place;
  } catch (error) {
    photonError = error;
    console.warn('Primary place search failed; trying backup:', error);
  }

  try {
    const place = await geocodeWithNominatim(query);
    if (place) return place;
  } catch (error) {
    console.error('Backup place search failed:', error);
    throw new Error('Place search is temporarily unavailable. Please try again in a moment, or enter a more specific location.');
  }

  if (photonError) {
    throw new Error('Could not find “' + query + '”. Check the spelling and include the city or area.');
  }
  throw new Error('Could not find “' + query + '”. Try a more specific place or address.');
}

function formatDistance(meters) {
  const km = meters / 1000;
  return km < 1 ? Math.round(meters) + ' m' : km.toFixed(1) + ' km';
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours + ' hr ' + (remaining ? remaining + ' min' : '');
}

function initializeMap() {
  if (map) return map;
  if (!window.L) throw new Error('The map library did not load. Check your internet connection and try again.');
  mapElement.replaceChildren();
  map = window.L.map(mapElement).setView([26.8467, 80.9462], 12);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  return map;
}

function clearMap() {
  routeLayers.forEach((layer) => layer.remove());
  routeLayers = [];
}

function renderMap(origin, destination) {
  const leafletMap = initializeMap();
  clearMap();
  const colors = ['#245c49', '#d28b32', '#5479a8'];
  routes.forEach((route, index) => {
    const coordinates = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const layer = window.L.polyline(coordinates, {
      color: colors[index % colors.length],
      weight: index === selectedRoute ? 6 : 4,
      opacity: index === selectedRoute ? 0.9 : 0.45
    }).addTo(leafletMap);
    layer.on('click', () => selectRoute(index));
    routeLayers.push(layer);
  });
  const points = [
    window.L.marker([origin.lat, origin.lon]).bindPopup('Starting point').addTo(leafletMap),
    window.L.marker([destination.lat, destination.lon]).bindPopup('Destination').addTo(leafletMap)
  ];
  routeLayers.push(...points);
  const bounds = window.L.latLngBounds(routes.flatMap((route) =>
    route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
  ));
  leafletMap.fitBounds(bounds.pad(0.12));
}

function renderResults() {
  results.replaceChildren();
  summary.replaceChildren();
  routes.forEach((route, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-option';
    button.setAttribute('aria-pressed', String(index === selectedRoute));
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Route option ' + (index + 1) + (index === 0 ? ' · Recommended by routing service' : '');
    const detail = document.createElement('span');
    detail.textContent = formatDistance(route.distance) + ' · ' + formatDuration(route.duration);
    copy.append(title, detail);
    const choose = document.createElement('span');
    choose.textContent = index === selectedRoute ? 'Selected' : 'View route';
    button.append(copy, choose);
    button.addEventListener('click', () => selectRoute(index));
    results.append(button);
  });

  const route = routes[selectedRoute];
  if (!route) return;
  const distance = document.createElement('span');
  distance.className = 'meta-chip';
  distance.textContent = 'Distance · ' + formatDistance(route.distance);
  const duration = document.createElement('span');
  duration.className = 'meta-chip';
  duration.textContent = 'Estimated time · ' + formatDuration(route.duration);
  summary.append(distance, duration);

  const mapsLink = document.createElement('a');
  mapsLink.className = 'button button-outline button-small';
  mapsLink.href = 'https://www.google.com/maps/dir/?api=1&origin='
    + encodeURIComponent(originLabelForMaps) + '&destination='
    + encodeURIComponent(destinationLabelForMaps) + '&travelmode=driving';
  mapsLink.target = '_blank';
  mapsLink.rel = 'noopener noreferrer';
  mapsLink.textContent = 'Open directions in Google Maps';
  summary.append(mapsLink);
}

let originLabelForMaps = '';
let destinationLabelForMaps = '';

function selectRoute(index) {
  selectedRoute = index;
  renderResults();
  if (map && routeLayers.length) {
    routeLayers.forEach((layer, layerIndex) => {
      if (layer.setStyle) {
        layer.setStyle({
          color: ['#245c49', '#d28b32', '#5479a8'][layerIndex % 3],
          weight: layerIndex === index ? 6 : 4,
          opacity: layerIndex === index ? 0.9 : 0.45
        });
      }
    });
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const originText = originInput.value.trim();
  const destinationText = destinationInput.value.trim();
  if (!originText || !destinationText) return;
  findButton.disabled = true;
  findButton.textContent = 'Finding routes…';
  results.replaceChildren();
  summary.replaceChildren();
  showStatus('Finding the starting point and destination…');
  try {
    const origin = currentOrigin && originText === currentOrigin.label
      ? currentOrigin
      : await geocode(originText);
    const destination = await geocode(destinationText);
    originLabelForMaps = originText === 'Your current location'
      ? origin.lat + ',' + origin.lon
      : originText;
    destinationLabelForMaps = destinationText;
    const url = 'https://router.project-osrm.org/route/v1/driving/'
      + origin.lon + ',' + origin.lat + ';' + destination.lon + ',' + destination.lat
      + '?overview=full&geometries=geojson&alternatives=true&steps=false';
    showStatus('Calculating available driving route options…');
    const response = await fetch(url);
    if (!response.ok) throw new Error('The routing service is temporarily unavailable.');
    const data = await response.json();
    if (data.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes.length) {
      throw new Error('No driving route was found between these places. Try more specific locations.');
    }
    routes = data.routes.slice(0, 3);
    selectedRoute = 0;
    renderResults();
    try {
      renderMap(origin, destination);
      showStatus('Route options loaded. Compare the estimates and choose a route to preview.');
    } catch (mapError) {
      console.warn('Map preview is unavailable; keeping route details available:', mapError);
      mapElement.innerHTML = '<div class="route-map-placeholder">The interactive map could not load. Your route estimates are still available above; use Google Maps for turn-by-turn directions.</div>';
      showStatus('Route options found. The map preview did not load, but route estimates and Google Maps directions are available.');
    }
  } catch (error) {
    console.error('Route search failed:', error);
    showStatus(error.message || 'Could not calculate route options. Please try again.', true);
    routes = [];
    results.replaceChildren();
    summary.replaceChildren();
    clearMap();
    if (map) {
      map.remove();
      map = null;
    }
    mapElement.innerHTML = '<div class="route-map-placeholder">No route preview is available. Check the place names or try again later.</div>';
  } finally {
    findButton.disabled = false;
    findButton.textContent = 'Find route options';
  }
});

form.addEventListener('reset', () => {
  currentOrigin = null;
  routes = [];
  selectedRoute = 0;
  results.replaceChildren();
  summary.replaceChildren();
  clearMap();
  if (map) {
    map.remove();
    map = null;
  }
  mapElement.innerHTML = '<div class="route-map-placeholder">Enter a starting point and destination to preview route options.</div>';
  showStatus('Route details cleared.');
});
