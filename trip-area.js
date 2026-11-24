import './account-ui.js?v=3';

const $ = (selector) => document.querySelector(selector);
const button = $('#findPharmacies');
const status = $('#pharmacyStatus');
const list = $('#pharmacyList');

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000
    });
  });
}

function distanceInKm(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latDelta = radians(lat2 - lat1);
  const lonDelta = radians(lon2 - lon1);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function appendMapSearch(latitude, longitude) {
  const link = document.createElement('a');
  link.className = 'button button-outline button-small';
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`pharmacy near ${latitude},${longitude}`)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Search pharmacies on map';
  list.append(link);
}

function renderPharmacies(elements, latitude, longitude) {
  list.replaceChildren();
  const pharmacies = elements.map((element) => {
    const lat = Number(element.lat ?? element.center?.lat);
    const lon = Number(element.lon ?? element.center?.lon);
    return {
      tags: element.tags || {},
      lat,
      lon,
      distance: distanceInKm(latitude, longitude, lat, lon)
    };
  }).filter((pharmacy) => Number.isFinite(pharmacy.lat) && Number.isFinite(pharmacy.lon))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5);

  if (!pharmacies.length) {
    showStatus('No pharmacy listings were found within 10 km. Try a map search or contact a local medical service.', true);
    appendMapSearch(latitude, longitude);
    return;
  }

  showStatus('Closest public pharmacy listings · within 10 km · OpenStreetMap');
  pharmacies.forEach((pharmacy) => {
    const name = pharmacy.tags.name || pharmacy.tags['name:en'] || 'Medical store';
    const address = [
      pharmacy.tags['addr:street'],
      pharmacy.tags['addr:suburb'] || pharmacy.tags['addr:city']
    ].filter(Boolean).join(', ');
    const row = document.createElement('article');
    row.className = 'station-item';

    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = name;
    details.append(title);
    if (address) {
      const location = document.createElement('span');
      location.textContent = address;
      details.append(location);
    }
    const distance = document.createElement('span');
    distance.className = 'station-distance';
    distance.textContent = `${pharmacy.distance < 10 ? pharmacy.distance.toFixed(1) : Math.round(pharmacy.distance)} km`;

    const links = document.createElement('div');
    links.className = 'station-links';
    const directions = document.createElement('a');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lon}`;
    directions.target = '_blank';
    directions.rel = 'noopener noreferrer';
    directions.textContent = 'Directions';
    links.append(directions);
    const phone = pharmacy.tags.phone || pharmacy.tags['contact:phone'];
    if (phone) {
      const call = document.createElement('a');
      call.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
      call.textContent = `Call ${phone}`;
      links.append(call);
    }
    row.append(details, distance, links);
    list.append(row);
  });
}

button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Finding medical stores…';
  list.replaceChildren();
  showStatus('Requesting your location. Coordinates will be used to search public pharmacy listings.');

  let position;
  try {
    position = await getPosition();
  } catch (error) {
    console.error('Could not get the device location for the pharmacy search:', error);
    const messages = {
      1: 'Location permission was denied. Allow location access in your browser settings, or search on your map.',
      2: 'Your location could not be determined. Try again outside or use your map app.',
      3: 'Location request timed out. Try again or search on your map.'
    };
    showStatus(messages[error.code] || error.message || 'Could not access your location. Try again or use your map app.', true);
    button.disabled = false;
    button.textContent = 'Find nearby medical stores';
    return;
  }

  const { latitude, longitude } = position.coords;
  const query = `[out:json][timeout:20];(nwr(around:10000,${latitude},${longitude})[amenity=pharmacy];nwr(around:10000,${latitude},${longitude})[shop=chemist];);out center tags;`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`The public map service responded with ${response.status}.`);
    }
    const data = await response.json();
    if (!Array.isArray(data.elements)) {
      throw new Error('The public map service returned an unexpected response.');
    }
    renderPharmacies(data.elements, latitude, longitude);
  } catch (error) {
    console.error('Could not search public pharmacy listings:', error);
    const message = error.name === 'AbortError'
      ? 'The nearby pharmacy search timed out. You can try the map search below.'
      : 'Could not load nearby pharmacy listings. You can try the map search below.';
    showStatus(message, true);
    appendMapSearch(latitude, longitude);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    button.textContent = 'Find nearby medical stores';
  }
});
