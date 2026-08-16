const tripForm = document.getElementById('tripForm');
const destinationInput = document.getElementById('destination');
const daysInput = document.getElementById('days');
const budgetInput = document.getElementById('budget');
const styleSelect = document.getElementById('style');

const tripMood = document.getElementById('tripMood');
const dailyBudget = document.getElementById('dailyBudget');
const bestTime = document.getElementById('bestTime');
const travelScore = document.getElementById('travelScore');
const routeTag = document.getElementById('routeTag');
const itineraryList = document.getElementById('itineraryList');
const highlightsList = document.getElementById('highlightsList');
const packingList = document.getElementById('packingList');
const safetyList = document.getElementById('safetyList');
const destinationGrid = document.getElementById('destinationGrid');

const destinations = [
  { name: 'Manali', summary: 'Snowy peaks and cozy cafés', accent: 'mountain' },
  { name: 'Goa', summary: 'Beach days and evening sunsets', accent: 'beach' },
  { name: 'Jaipur', summary: 'Heritage tours and royal food', accent: 'city' },
  { name: 'Rishikesh', summary: 'Riverfront calm and adventure', accent: 'river' }
];

const travelStyles = {
  adventure: {
    label: 'Adventure',
    bestTime: 'Early morning',
    tag: 'Mountain escape',
    activities: ['Trekking trail with scenic viewpoints', 'Local food walk and cafe stop', 'Sunset photo point visit', 'Night market exploration'],
    highlights: ['Best for active travelers', 'Easy to mix sightseeing with local food', 'High-energy plan with scenic breaks'],
    packing: ['Backpack', 'Water bottle', 'Power bank', 'Hiking shoes', 'Light rain cover'],
    safety: ['Save emergency contacts offline', 'Carry small cash for remote areas', 'Check weather and road conditions before leaving']
  },
  family: {
    label: 'Family',
    bestTime: 'Late morning',
    tag: 'Comfort trip',
    activities: ['Museum visit and relaxed city walk', 'Café break and family photo stop', 'Local park time', 'Easy evening stroll'],
    highlights: ['Comfortable and low-stress itinerary', 'Good for kids and senior travelers', 'Leaves room for rest and meals'],
    packing: ['Comfortable clothes', 'Snacks', 'First-aid pouch', 'Sunglasses', 'Travel adapter'],
    safety: ['Book family-friendly stays early', 'Keep a small emergency kit ready', 'Plan short breaks every few hours']
  },
  solo: {
    label: 'Solo',
    bestTime: 'Morning walk',
    tag: 'Explorer route',
    activities: ['Old town walk and local discovery', 'Coffee stop and journaling time', 'Bookstore or market visit', 'Night city lights experience'],
    highlights: ['Great for flexible planning', 'Ideal for discovery and photography', 'Helps you connect with locals'],
    packing: ['Safety whistle', 'Portable charger', 'ID copies', 'Compact towel', 'Reusable bottle'],
    safety: ['Share your live location with family', 'Avoid isolated routes after dark', 'Keep emergency numbers saved on your phone']
  },
  luxury: {
    label: 'Luxury',
    bestTime: 'Sunset drive',
    tag: 'Premium retreat',
    activities: ['Spa and wellness session', 'Fine-dining reservation', 'Private sightseeing route', 'Resort lounge evening'],
    highlights: ['Smooth booking experience', 'Comfort-first itinerary', 'Best for restful and scenic travel'],
    packing: ['Smart outfit', 'Perfume', 'Travel essentials kit', 'Premium toiletries', 'Charging cable'],
    safety: ['Confirm all bookings in advance', 'Keep backup transport ready', 'Carry cards and digital wallets securely']
  }
};

function renderDestinationCards() {
  destinationGrid.innerHTML = destinations.map((place) => `
    <button class="destination-card" data-destination="${place.name}"> 
      <div class="image ${place.accent}"></div>
      <h4>${place.name}</h4>
      <p>${place.summary}</p>
    </button>
  `).join('');

  destinationGrid.querySelectorAll('.destination-card').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.destination;
      destinationInput.value = name;
      const plan = getTravelPlan({
        destination: name,
        days: daysInput.value,
        budget: budgetInput.value,
        style: styleSelect.value
      });
      renderPlan(plan);
    });
  });
}

function getTravelPlan(data) {
  const style = travelStyles[data.style] || travelStyles.adventure;
  const days = Math.max(1, Number(data.days) || 3);
  const budget = Number(data.budget) || 0;
  const dailySpend = Math.round(budget / days);
  const destination = (data.destination || '').trim() || 'your destination';
  const itinerary = Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    return `${dayNumber}. ${style.activities[index % style.activities.length]} in ${destination}`;
  });

  const score = Math.min(99, Math.max(60, Math.round((budget / (days * 1800)) * 100 + 55)));

  return {
    destination,
    dailySpend,
    style,
    itinerary,
    score,
    highlights: style.highlights,
    packing: style.packing,
    safety: style.safety,
    tag: style.tag
  };
}

function renderPlan(plan) {
  tripMood.textContent = plan.style.label;
  dailyBudget.textContent = `₹${plan.dailySpend.toLocaleString('en-IN')}`;
  bestTime.textContent = plan.style.bestTime;
  travelScore.textContent = `${plan.score}/100`;
  routeTag.textContent = plan.tag;

  itineraryList.innerHTML = plan.itinerary.map(item => `<li>${item}</li>`).join('');
  highlightsList.innerHTML = plan.highlights.map(item => `<li>${item}</li>`).join('');
  packingList.innerHTML = plan.packing.map(item => `<li>${item}</li>`).join('');
  safetyList.innerHTML = plan.safety.map(item => `<li>${item}</li>`).join('');
}

tripForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const plan = getTravelPlan({
    destination: destinationInput.value,
    days: daysInput.value,
    budget: budgetInput.value,
    style: styleSelect.value
  });

  renderPlan(plan);
});

renderDestinationCards();

const initialPlan = getTravelPlan({
  destination: 'Manali',
  days: 4,
  budget: 12000,
  style: 'adventure'
});

renderPlan(initialPlan);
