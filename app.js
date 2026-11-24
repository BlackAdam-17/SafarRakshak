import { accountReady, apiRequest, getCurrentAccount } from './account-ui.js?v=3';
const $ = (selector) => document.querySelector(selector);
const tripForm = $('#tripForm');
const stationStatus = $('#stationStatus');
const stationList = $('#stationList');
const planStatus = $('#planStatus');

function emptyPlan() {
  return {
    destination: '',
    departDate: '',
    returnDate: '',
    contactName: '',
    contactPhone: '',
    itinerary: '',
    checkIns: []
  };
}

let plan = emptyPlan();
let currentAccount = null;
let accountGeneration = 0;

function showStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function setPlanFormsEnabled(enabled) {
  for (const form of [tripForm, $('#checkinForm')]) {
    form.querySelectorAll('input, textarea, button').forEach((control) => {
      control.disabled = !enabled;
    });
  }
}

async function applyAccountState(account) {
  const generation = ++accountGeneration;
  currentAccount = account;
  setPlanFormsEnabled(Boolean(account));

  if (!account) {
    plan = emptyPlan();
    renderPlan();
    showStatus(planStatus, 'Sign in or register to save a trip plan and check-ins.');
    return;
  }

  try {
    const response = await apiRequest('/api/plan');
    if (generation !== accountGeneration) return;
    if (!response.plan || typeof response.plan !== 'object') {
      throw new Error('The server returned an invalid safety plan.');
    }
    plan = {
      ...emptyPlan(),
      ...response.plan,
      checkIns: Array.isArray(response.plan.checkIns) ? response.plan.checkIns : []
    };
    renderPlan();
    showStatus(planStatus, 'Signed in. Your safety plan is loaded from your account.');
  } catch (error) {
    console.error('Could not load the account safety plan:', error);
    if (generation === accountGeneration) {
      showStatus(planStatus, error.message || 'Could not load your safety plan. Try again.', true);
    }
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderPlan() {
  $('#destination').value = plan.destination;
  $('#departDate').value = plan.departDate;
  $('#returnDate').value = plan.returnDate;
  $('#contactName').value = plan.contactName;
  $('#contactPhone').value = plan.contactPhone;
  $('#itinerary').value = plan.itinerary;

  const meta = $('#planMeta');
  meta.replaceChildren();
  if (plan.destination) {
    const destination = document.createElement('span');
    destination.className = 'meta-chip';
    destination.textContent = plan.destination;
    meta.append(destination);
  }
  if (plan.departDate || plan.returnDate) {
    const dates = document.createElement('span');
    dates.className = 'meta-chip';
    dates.textContent = [formatDate(plan.departDate), formatDate(plan.returnDate)].filter(Boolean).join(' – ');
    meta.append(dates);
  }

  const preview = $('#contactPreview');
  preview.replaceChildren();
  if (plan.contactName && plan.contactPhone) {
    preview.append(document.createTextNode(`Trusted contact: ${plan.contactName} · `));
    const callLink = document.createElement('a');
    callLink.href = `tel:${plan.contactPhone.replace(/[^\d+]/g, '')}`;
    callLink.textContent = plan.contactPhone;
    preview.append(callLink);
  } else {
    preview.textContent = 'Add a trusted contact above so their details are easy to find during your trip.';
  }
  renderCheckIns();
}

function formatCheckInTime(value) {
  if (!value) return 'No time set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time not recognized' : date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function renderCheckIns() {
  const list = $('#checkinList');
  list.replaceChildren();
  const completed = plan.checkIns.filter((item) => item.done).length;
  $('#checkinCount').textContent = `${completed}/${plan.checkIns.length} complete`;

  if (!plan.checkIns.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No check-ins yet. Add one above to create a reminder for your trip.';
    list.append(empty);
    return;
  }

  plan.checkIns.forEach((item) => {
    const row = document.createElement('li');
    row.className = `checkin-item${item.done ? ' is-done' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.done;
    checkbox.setAttribute('aria-label', `Mark ${item.label} as ${item.done ? 'not done' : 'done'}`);
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        const response = await apiRequest(`/api/check-ins/${encodeURIComponent(item.id)}`, {
          method: 'PATCH',
          body: { done: checkbox.checked }
        });
        plan.checkIns = plan.checkIns.map((checkIn) => checkIn.id === item.id ? response.checkIn : checkIn);
        renderCheckIns();
        showStatus(planStatus, 'Check-in saved to your account.');
      } catch (error) {
        console.error('Could not update the check-in:', error);
        checkbox.checked = item.done;
        checkbox.disabled = false;
        showStatus(planStatus, error.message || 'Could not update the check-in. Try again.', true);
      }
    });

    const copy = document.createElement('span');
    copy.className = 'checkin-copy';
    const label = document.createElement('strong');
    label.textContent = item.label;
    const time = document.createElement('span');
    time.textContent = formatCheckInTime(item.time);
    copy.append(label, time);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-checkin';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove check-in: ${item.label}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await apiRequest(`/api/check-ins/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        plan.checkIns = plan.checkIns.filter((checkIn) => checkIn.id !== item.id);
        renderCheckIns();
        showStatus(planStatus, 'Check-in removed.');
      } catch (error) {
        console.error('Could not remove the check-in:', error);
        remove.disabled = false;
        showStatus(planStatus, error.message || 'Could not remove the check-in. Try again.', true);
      }
    });

    row.append(checkbox, copy, remove);
    list.append(row);
  });
}

tripForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentAccount || !tripForm.reportValidity()) return;

  const contactName = $('#contactName').value.trim();
  const contactPhone = $('#contactPhone').value.trim();
  if (Boolean(contactName) !== Boolean(contactPhone)) {
    showStatus(planStatus, 'Enter both trusted contact fields, or leave both blank.', true);
    return;
  }
  if (contactPhone && !/^[+()0-9\s.-]{7,24}$/.test(contactPhone)) {
    showStatus(planStatus, 'Enter a valid phone number for your trusted contact.', true);
    return;
  }
  const departDate = $('#departDate').value;
  const returnDate = $('#returnDate').value;
  if (departDate && returnDate && returnDate < departDate) {
    showStatus(planStatus, 'Return date must be the same as or later than your departure date.', true);
    return;
  }

  const updatedPlan = {
    destination: $('#destination').value.trim(),
    departDate,
    returnDate,
    contactName,
    contactPhone,
    itinerary: $('#itinerary').value.trim()
  };
  const submit = tripForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const response = await apiRequest('/api/plan', { method: 'PUT', body: updatedPlan });
    plan = { ...response.plan, checkIns: plan.checkIns };
    renderPlan();
    showStatus(planStatus, 'Safety plan saved to your account.');
  } catch (error) {
    console.error('Could not save the safety plan:', error);
    showStatus(planStatus, error.message || 'Could not save your safety plan. Try again.', true);
  } finally {
    submit.disabled = !currentAccount;
  }
});

$('#checkinForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentAccount) return;
  const input = $('#checkinLabel');
  const label = input.value.trim();
  if (!label) {
    input.focus();
    return;
  }
  const time = $('#checkinTime').value;
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const response = await apiRequest('/api/check-ins', { method: 'POST', body: { label, time } });
    plan.checkIns.push(response.checkIn);
    renderCheckIns();
    form.reset();
    input.focus();
    showStatus(planStatus, 'Check-in saved to your account.');
  } catch (error) {
    console.error('Could not add the check-in:', error);
    showStatus(planStatus, error.message || 'Could not add the check-in. Try again.', true);
  } finally {
    submit.disabled = !currentAccount;
  }
});

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
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
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`police station near ${latitude},${longitude}`)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Search police stations on map';
  stationList.append(link);
}

function renderStations(elements, latitude, longitude) {
  stationList.replaceChildren();
  const stations = elements.map((element) => {
    const lat = Number(element.lat ?? element.center?.lat);
    const lon = Number(element.lon ?? element.center?.lon);
    return {
      tags: element.tags || {},
      lat,
      lon,
      distance: distanceInKm(latitude, longitude, lat, lon)
    };
  }).filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  if (!stations.length) {
    showStatus(stationStatus, 'No police station listings were found within 15 km. Check the map search below or contact local emergency services.', true);
    appendMapSearch(latitude, longitude);
    return;
  }

  showStatus(stationStatus, `Closest public listings · within 15 km · OpenStreetMap`);
  stations.forEach((station) => {
    const name = station.tags.name || station.tags['name:en'] || 'Police station';
    const address = [
      station.tags['addr:street'],
      station.tags['addr:suburb'] || station.tags['addr:city']
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
    distance.textContent = `${station.distance < 10 ? station.distance.toFixed(1) : Math.round(station.distance)} km`;

    const links = document.createElement('div');
    links.className = 'station-links';
    const directions = document.createElement('a');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
    directions.target = '_blank';
    directions.rel = 'noopener noreferrer';
    directions.textContent = 'Directions';
    links.append(directions);
    const phone = station.tags.phone || station.tags['contact:phone'];
    if (phone) {
      const call = document.createElement('a');
      call.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
      call.textContent = `Call ${phone}`;
      links.append(call);
    }
    row.append(details, distance, links);
    stationList.append(row);
  });
}

$('#findPolice').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Finding stations…';
  stationList.replaceChildren();
  showStatus(stationStatus, 'Requesting your location. Your coordinates will be used to search public map listings.');
  let position;
  try {
    position = await getPosition();
  } catch (error) {
    console.error('Could not get the device location:', error);
    const messages = {
      1: 'Location permission was denied. Allow location access in your browser settings, or call local emergency services.',
      2: 'Your location could not be determined. Try again outside or use your map app to search nearby.',
      3: 'Location request timed out. Try again, or call local emergency services.'
    };
    const message = messages[error.code] || error.message || 'Could not access your location. Try again or use your map app.';
    showStatus(stationStatus, message, true);
    button.disabled = false;
    button.textContent = 'Find nearby police';
    return;
  }

  const { latitude, longitude } = position.coords;
  const query = `[out:json][timeout:20];(nwr(around:15000,${latitude},${longitude})[amenity=police];nwr(around:15000,${latitude},${longitude})[police=station];);out center tags;`;
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
    renderStations(data.elements, latitude, longitude);
  } catch (error) {
    console.error('Could not search public police station listings:', error);
    const message = error.name === 'AbortError'
      ? 'The nearby station search timed out. You can try the map search below.'
      : 'Could not load nearby station listings. You can try the map search below.';
    showStatus(stationStatus, message, true);
    appendMapSearch(latitude, longitude);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    button.textContent = 'Find nearby police';
  }
});

window.addEventListener('safar-account-change', (event) => {
  void applyAccountState(event.detail?.account || null);
});

setPlanFormsEnabled(false);
renderPlan();
showStatus(planStatus, 'Sign in or register to save a trip plan and check-ins.');
accountReady.then(() => applyAccountState(getCurrentAccount()));
