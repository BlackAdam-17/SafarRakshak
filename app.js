const STORAGE_KEYS = { savedPlan: 'safar-rakshak.saved-plan.v1', packed: 'safar-rakshak.packing.v1', contact: 'safar-rakshak.contact.v1', budgetShares: 'safar-rakshak.budget-shares.v1' };
const $ = (selector) => document.querySelector(selector);

const form = $('#tripForm');
const destinationInput = $('#destination');
const daysInput = $('#days');
const budgetInput = $('#budget');
const styleInput = $('#style');
const destinationGrid = $('#destinationGrid');
const statusMessage = $('#statusMessage');
let activePlan = null;
let messageTimer;

const destinations = [
  { name: 'Manali', description: 'Pine forests, mountain air, and lively cafés.', colors: ['#bdd9c7', '#66927a'], bestTime: 'Start early', activities: ['Take a gentle walk through the old town', 'Explore a nearby nature trail', 'Try a local café and regional food', 'Find a quiet viewpoint before sunset'] },
  { name: 'Goa', description: 'Laid-back beaches, Portuguese lanes, and sunsets.', colors: ['#f5d7a0', '#dd9866'], bestTime: 'Late afternoon', activities: ['Explore a heritage lane at an easy pace', 'Spend time by the coast', 'Try a local seafood or vegetarian dish', 'Watch the sky change at sunset'] },
  { name: 'Jaipur', description: 'Pink city streets, craft, and royal history.', colors: ['#f4c8a7', '#c77965'], bestTime: 'Morning', activities: ['Visit a historic site early', 'Browse a local craft market', 'Take a break for Rajasthani food', 'Walk through the old city before dusk'] },
  { name: 'Rishikesh', description: 'River walks, foothill views, and a slower pace.', colors: ['#b8d8d1', '#599184'], bestTime: 'Early morning', activities: ['Walk along the riverfront', 'Explore a nearby hillside path', 'Take a quiet café break', 'Catch the evening riverfront atmosphere'] }
];

const styles = {
  adventure: { label: 'Adventure', tag: 'Active escape', highlights: ['A varied pace with room for outdoor exploration.', 'Local food and viewpoint ideas add variety to the day.', 'A little preparation helps keep plans flexible.'], packing: ['Comfortable walking shoes', 'Reusable water bottle', 'Day backpack', 'Power bank', 'Light rain layer', 'Sun protection'], safety: ['Check local weather and trail conditions before setting out.', 'Tell someone your route and expected return time.', 'Carry water and turn back if conditions change.'] },
  family: { label: 'Family', tag: 'Easy-going escape', highlights: ['A gentler pace leaves room for meals and rest.', 'A mix of simple activities keeps the days flexible.', 'Breaks can be adjusted to suit your group.'], packing: ['Comfortable clothes', 'Snacks and water', 'First-aid pouch', 'Sun protection', 'Any regular medicines', 'Copies of important details'], safety: ['Agree on a meeting point in busy places.', 'Plan regular rest, water, and meal breaks.', 'Keep essential medicines and caregiver contacts accessible.'] },
  solo: { label: 'Solo', tag: 'Independent escape', highlights: ['Flexible activities make it easy to change plans.', 'Time for neighborhood walks and local discovery.', 'A shared itinerary helps someone know your plans.'], packing: ['Portable charger', 'Photo ID and a backup copy', 'Reusable water bottle', 'Small first-aid kit', 'Safety whistle', 'Day bag'], safety: ['Share your itinerary and stay details with someone you trust.', 'Choose well-lit, populated routes after dark.', 'Keep your phone charged and local contacts saved.'] },
  luxury: { label: 'Comfort & luxury', tag: 'Comfort-first escape', highlights: ['A slower pace leaves time to unwind.', 'Plan key experiences ahead to protect your time.', 'Keep a little flexibility between bookings.'], packing: ['Booking confirmations', 'Comfortable outfits', 'Personal toiletries', 'Charging cable', 'Any regular medicines', 'A small day bag'], safety: ['Confirm reservations and transport before departure.', 'Use trusted transport and keep a backup option.', 'Store payment cards and valuables securely.'] }
};

const budgetCategories = [
  { name: 'Stay', share: 35, color: 'bg-forest-700' },
  { name: 'Food', share: 20, color: 'bg-amber-500' },
  { name: 'Transport', share: 25, color: 'bg-sky-600' },
  { name: 'Activities', share: 15, color: 'bg-violet-500' },
  { name: 'Flex buffer', share: 5, color: 'bg-slate-400' }
];
let budgetShares = readStorage(STORAGE_KEYS.budgetShares) || Object.fromEntries(budgetCategories.map((item) => [item.name, item.share]));

function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showMessage('Browser storage is unavailable. Your plan is still open for this session.', true);
    return false;
  }
}

function showMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `min-h-5 text-sm font-semibold ${isError ? 'text-rose-700' : 'text-forest-700'}`;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { statusMessage.textContent = ''; }, 4200);
}

function money(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function getTripFromForm() {
  const destination = destinationInput.value.trim();
  const days = Number(daysInput.value);
  const budget = Number(budgetInput.value);
  if (!destination || destination.length > 60 || !Number.isInteger(days) || days < 1 || days > 30 || !Number.isFinite(budget) || budget < 500 || budget > 10000000) return null;
  const place = destinations.find((item) => item.name.toLowerCase() === destination.toLowerCase());
  const styleKey = styles[styleInput.value] ? styleInput.value : 'adventure';
  const style = styles[styleKey];
  const activities = place?.activities ?? [
    `Explore a well-known local landmark in ${destination}`,
    `Take a relaxed neighborhood walk in ${destination}`,
    `Try a local meal and discover the regional food scene`,
    `Set aside time for an unhurried afternoon in ${destination}`
  ];
  const itinerary = Array.from({ length: days }, (_, index) => ({ day: index + 1, activity: activities[index % activities.length] }));
  const daily = Math.round(budget / days);
  const budgetFit = Math.max(40, Math.min(99, Math.round(55 + (daily / 1800) * 27)));
  return { destination: place?.name ?? destination, days, budget, daily, styleKey, style: style.label, tag: style.tag, bestTime: place?.bestTime ?? 'Choose a local daylight start', itinerary, packing: style.packing, safety: style.safety, budgetFit };
}

function createListItem(text, className = 'text-sm leading-6 text-slate-700') {
  const li = document.createElement('li');
  li.className = className;
  li.textContent = text;
  return li;
}

function renderDestinations() {
  const options = $('#destinationOptions');
  destinations.forEach((place) => {
    const option = document.createElement('option');
    option.value = place.name;
    options.append(option);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'group overflow-hidden rounded-3xl border border-forest-900/5 bg-white text-left shadow-soft transition hover:-translate-y-1 hover:shadow-lg';
    const art = document.createElement('span');
    art.className = 'destination-art relative block h-28 overflow-hidden sm:h-36';
    art.style.setProperty('--from', place.colors[0]);
    art.style.setProperty('--to', place.colors[1]);
    const icon = document.createElement('span');
    icon.className = 'absolute bottom-2 right-4 text-5xl drop-shadow-sm transition group-hover:-translate-y-1';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ({ Manali: '🏔️', Goa: '🌊', Jaipur: '🏰', Rishikesh: '🌿' })[place.name];
    art.append(icon);
    const copy = document.createElement('span');
    copy.className = 'block p-4';
    const title = document.createElement('span');
    title.className = 'block font-extrabold text-forest-900';
    title.textContent = place.name;
    const description = document.createElement('span');
    description.className = 'mt-1 block text-xs leading-5 text-slate-500';
    description.textContent = place.description;
    copy.append(title, description);
    card.append(art, copy);
    card.addEventListener('click', () => {
      destinationInput.value = place.name;
      destinationInput.focus({ preventScroll: true });
      showMessage(`${place.name} selected. Set your trip details, then create your journey.`);
      $('#planner').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    destinationGrid.append(card);
  });
}

function getPackedItems(plan) {
  const all = readStorage(STORAGE_KEYS.packed, {});
  return new Set(all[planKey(plan)] ?? []);
}

function planKey(plan) {
  return `${plan.destination.toLowerCase()}|${plan.days}|${plan.styleKey}`;
}

function savePackedItems(plan, packed) {
  const all = readStorage(STORAGE_KEYS.packed, {});
  all[planKey(plan)] = [...packed];
  writeStorage(STORAGE_KEYS.packed, all);
}

function renderPacking(plan) {
  const list = $('#packingList');
  const packed = getPackedItems(plan);
  list.replaceChildren();
  plan.packing.forEach((item) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'check-row flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'h-4 w-4 shrink-0 accent-forest-700';
    checkbox.checked = packed.has(item);
    checkbox.setAttribute('aria-label', `Packed: ${item}`);
    const text = document.createElement('span');
    text.className = 'check-text text-slate-700';
    text.textContent = item;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) packed.add(item); else packed.delete(item);
      savePackedItems(plan, packed);
      updatePackingProgress(plan, packed.size);
    });
    label.append(checkbox, text);
    li.append(label);
    list.append(li);
  });
  updatePackingProgress(plan, packed.size);
}

function updatePackingProgress(plan, count) {
  $('#packingProgress').textContent = `${count}/${plan.packing.length} packed`;
}

function renderBudget(plan) {
  const breakdown = $('#budgetBreakdown');
  breakdown.replaceChildren();
  let totalShare = 0;
  budgetCategories.forEach((category) => {
    const share = Number.isFinite(Number(budgetShares[category.name])) ? Math.max(0, Math.min(100, Number(budgetShares[category.name]))) : category.share;
    totalShare += share;
    const row = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'mb-1.5 flex items-center justify-between gap-2 text-sm';
    const name = document.createElement('span');
    name.className = 'font-semibold text-slate-700';
    name.textContent = category.name;
    const right = document.createElement('span');
    right.className = 'flex items-center gap-2';
    const input = document.createElement('input');
    input.className = 'w-14 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs font-bold text-slate-700';
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(share);
    input.setAttribute('aria-label', `${category.name} budget share percentage`);
    const percent = document.createElement('span');
    percent.textContent = '%';
    const amount = document.createElement('span');
    amount.className = 'min-w-20 text-right font-extrabold text-forest-900';
    amount.textContent = money(Math.round((plan.budget * share) / 100));
    right.append(input, percent, amount);
    header.append(name, right);
    const track = document.createElement('div');
    track.className = 'h-2 overflow-hidden rounded-full bg-slate-100';
    const bar = document.createElement('div');
    bar.className = `h-full rounded-full ${category.color}`;
    bar.style.width = `${share}%`;
    track.append(bar);
    row.append(header, track);
    breakdown.append(row);
    input.addEventListener('input', () => {
      budgetShares[category.name] = Math.max(0, Math.min(100, Number(input.value) || 0));
      amount.textContent = money(Math.round((plan.budget * budgetShares[category.name]) / 100));
      bar.style.width = `${budgetShares[category.name]}%`;
      totalShare = budgetCategories.reduce((sum, item) => sum + (Number(budgetShares[item.name]) || 0), 0);
      updateBudgetNote(plan, totalShare);
      writeStorage(STORAGE_KEYS.budgetShares, budgetShares);
    });
  });
  updateBudgetNote(plan, totalShare);
}

function updateBudgetNote(plan, totalShare) {
  const note = $('#budgetNote');
  const difference = Math.round(totalShare - 100);
  const status = difference === 0 ? 'Your allocations add up to 100%.' : difference > 0 ? `Your allocations are ${difference}% over the budget.` : `${Math.abs(difference)}% remains unallocated.`;
  note.textContent = `Daily target: ${money(plan.daily)} · ${status} Planning split only, not a destination price estimate.`;
  note.className = `mt-5 rounded-xl p-3 text-sm leading-5 ${difference === 0 ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-800'}`;
}

function renderPlan(plan) {
  activePlan = plan;
  $('#tripMood').textContent = plan.style;
  $('#dailyBudget').textContent = money(plan.daily);
  $('#bestTime').textContent = plan.bestTime;
  $('#travelScore').textContent = `${plan.budgetFit}/100`;
  $('#routeTag').textContent = plan.tag;
  $('#planDestination').textContent = `to ${plan.destination}`;
  $('#planMeta').textContent = `${plan.days} ${plan.days === 1 ? 'day' : 'days'} · ${plan.style} · total budget ${money(plan.budget)}`;
  const itinerary = $('#itineraryList');
  itinerary.replaceChildren();
  plan.itinerary.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'flex gap-3 rounded-2xl bg-slate-50 p-3.5';
    const day = document.createElement('span');
    day.className = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest-100 text-xs font-extrabold text-forest-800';
    day.textContent = String(item.day).padStart(2, '0');
    const copy = document.createElement('span');
    copy.className = 'self-center text-sm leading-6 text-slate-700';
    copy.textContent = item.activity;
    li.append(day, copy);
    itinerary.append(li);
  });
  const safety = $('#safetyList');
  safety.replaceChildren(...plan.safety.map((item) => {
    const li = document.createElement('li');
    li.className = 'flex gap-3 text-sm leading-6 text-slate-700';
    const mark = document.createElement('span');
    mark.className = 'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-100 text-xs font-extrabold text-forest-700';
    mark.textContent = '✓';
    li.append(mark, document.createTextNode(item));
    return li;
  }));
  $('#highlightsList').replaceChildren(...styles[plan.styleKey].highlights.map((item) => {
    const li = document.createElement('li');
    li.className = 'flex gap-3 text-sm leading-6 text-slate-700';
    const mark = document.createElement('span');
    mark.className = 'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-100 text-xs font-extrabold text-forest-700';
    mark.textContent = '✦';
    li.append(mark, document.createTextNode(item));
    return li;
  }));
  renderBudget(plan);
  renderPacking(plan);
}

function serializePlan(plan) {
  return [
    `Safar Rakshak trip plan: ${plan.destination}`,
    `${plan.days} days · ${plan.style} · Total budget: ${money(plan.budget)} · Daily target: ${money(plan.daily)}`,
    '', 'ITINERARY', ...plan.itinerary.map((item) => `Day ${item.day}: ${item.activity}`),
    '', 'BUDGET SPLIT', ...budgetCategories.map((item) => `${item.name} (${Number(budgetShares[item.name]) || 0}%): ${money(Math.round(plan.budget * (Number(budgetShares[item.name]) || 0) / 100))}`),
    '', 'PACKING CHECKLIST', ...plan.packing.map((item) => `${getPackedItems(plan).has(item) ? '[x]' : '[ ]'} ${item}`),
    '', 'SAFETY REMINDERS', ...plan.safety.map((item) => `• ${item}`),
    '', 'Planning guide only. Confirm current local travel details before departure.'
  ].join('\n');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const plan = getTripFromForm();
  if (!plan) return;
  renderPlan(plan);
  showMessage('Your trip plan is ready. You can save, share, or download it below.');
  $('#your-plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#savePlan').addEventListener('click', () => {
  if (!activePlan) return;
  if (writeStorage(STORAGE_KEYS.savedPlan, activePlan) && writeStorage(STORAGE_KEYS.budgetShares, budgetShares)) showMessage('Plan and budget split saved on this device.');
});

$('#resetBudget').addEventListener('click', () => {
  budgetShares = Object.fromEntries(budgetCategories.map((item) => [item.name, item.share]));
  writeStorage(STORAGE_KEYS.budgetShares, budgetShares);
  if (activePlan) renderBudget(activePlan);
  showMessage('Budget split reset to the suggested allocation.');
});

$('#sharePlan').addEventListener('click', async () => {
  if (!activePlan) return;
  const text = serializePlan(activePlan);
  try {
    if (navigator.share) {
      await navigator.share({ title: `Safar Rakshak · ${activePlan.destination}`, text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showMessage('Trip plan copied to clipboard.');
    } else {
      showMessage('Sharing is not available in this browser. Download your plan instead.', true);
    }
  } catch (error) {
    if (error?.name !== 'AbortError') showMessage('Could not share this plan. Try downloading it instead.', true);
  }
});

$('#downloadPlan').addEventListener('click', () => {
  if (!activePlan) return;
  const file = new Blob([serializePlan(activePlan)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `safar-rakshak-${activePlan.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-plan.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMessage('Your trip plan has been downloaded.');
});

function renderSavedContact(contact) {
  const display = $('#savedContact');
  display.replaceChildren();
  if (!contact?.name || !contact?.phone) return;
  display.append(document.createTextNode(`Saved on this device: ${contact.name} · `));
  const call = document.createElement('a');
  call.className = 'font-bold text-forest-700 underline';
  call.href = `tel:${contact.phone.replace(/[^+0-9]/g, '')}`;
  call.textContent = contact.phone;
  display.append(call);
}

$('#contactForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#contactName').value.trim();
  const phone = $('#contactPhone').value.trim();
  if (!name || !/^[+()0-9\s.-]{7,24}$/.test(phone)) {
    showMessage('Enter a contact name and a valid phone number.', true);
    return;
  }
  const contact = { name, phone };
  if (writeStorage(STORAGE_KEYS.contact, contact)) {
    renderSavedContact(contact);
    showMessage('Trusted contact saved on this device.');
  }
});

renderDestinations();
const savedContact = readStorage(STORAGE_KEYS.contact);
if (savedContact) {
  $('#contactName').value = savedContact.name ?? '';
  $('#contactPhone').value = savedContact.phone ?? '';
  renderSavedContact(savedContact);
}
const savedPlan = readStorage(STORAGE_KEYS.savedPlan);
if (savedPlan && savedPlan.destination && savedPlan.days && savedPlan.packing && savedPlan.itinerary) {
  destinationInput.value = savedPlan.destination;
  daysInput.value = savedPlan.days;
  budgetInput.value = savedPlan.budget;
  styleInput.value = savedPlan.styleKey;
  renderPlan(savedPlan);
  showMessage('Welcome back. Your saved trip plan has been restored.');
} else {
  renderPlan(getTripFromForm());
}
