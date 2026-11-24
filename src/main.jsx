import React from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';

const shortcuts = [
  { number: '01', title: 'Plan your journey', description: 'Keep your destination, travel dates and trusted contact details together.', href: '#journey', action: 'Open safety plan', symbol: '↗' },
  { number: '02', title: 'Route navigator', description: 'Compare available driving routes and open turn-by-turn directions.', href: './navigator.html', action: 'Explore routes', symbol: '⌁' },
  { number: '03', title: 'Nearby assistance', description: 'Look up public pharmacy listings around your current location.', href: './trip-area.html', action: 'Explore trip area', symbol: '＋' }
];

function TravelShortcuts() {
  return (
    <section className="sr:my-8 sr:rounded-[26px] sr:border sr:border-[#e2e9e3] sr:bg-white sr:p-6 sr:shadow-[0_12px_34px_rgba(25,53,43,0.05)] sm:sr:p-8" aria-labelledby="shortcuts-title">
      <div className="sr:flex sr:flex-col sr:gap-3 sm:sr:flex-row sm:sr:items-end sm:sr:justify-between">
        <div>
          <p className="sr:mb-2 sr:text-[10px] sr:font-extrabold sr:uppercase sr:tracking-[.18em] sr:text-[#39715b]">Your travel toolkit</p>
          <h2 id="shortcuts-title" className="sr:text-2xl sr:font-extrabold sr:tracking-[-.045em] sr:text-[#193f34]">A clearer way to prepare</h2>
        </div>
        <p className="sr:max-w-sm sr:text-xs sr:leading-6 sr:text-[#64736c]">Quick access to the tools that help you organise your trip before you leave.</p>
      </div>
      <div className="sr:mt-6 sr:grid sr:grid-cols-1 sr:gap-3 md:sr:grid-cols-3">
        {shortcuts.map((item) => (
          <a key={item.number} href={item.href} className="sr:group sr:flex sr:min-h-44 sr:flex-col sr:rounded-2xl sr:border sr:border-[#e6ece7] sr:bg-[#fbfcfa] sr:p-5 sr:no-underline sr:transition sr:duration-200 sr:hover:-translate-y-1 sr:hover:border-[#b8cfc0] sr:hover:bg-[#f2f7f3] sr:focus-visible:outline-2 sr:focus-visible:outline-offset-4 sr:focus-visible:outline-[#d6a64a]">
            <div className="sr:flex sr:items-center sr:justify-between">
              <span className="sr:text-[10px] sr:font-bold sr:tracking-[.16em] sr:text-[#809087]">{item.number}</span>
              <span className="sr:grid sr:h-9 sr:w-9 sr:place-items-center sr:rounded-xl sr:bg-[#eaf2ed] sr:text-lg sr:text-[#245c49]">{item.symbol}</span>
            </div>
            <h3 className="sr:mb-2 sr:mt-5 sr:text-base sr:font-bold sr:text-[#193f34]">{item.title}</h3>
            <p className="sr:mb-5 sr:text-xs sr:leading-5 sr:text-[#64736c]">{item.description}</p>
            <span className="sr:mt-auto sr:text-xs sr:font-extrabold sr:text-[#245c49] sr:group-hover:text-[#193f34]">{item.action} <span aria-hidden="true">→</span></span>
          </a>
        ))}
      </div>
      <p className="sr:mb-0 sr:mt-5 sr:border-t sr:border-[#edf0ec] sr:pt-4 sr:text-[10px] sr:leading-5 sr:text-[#7a8780]">React.js powers this interactive section; Tailwind CSS provides its responsive styling. Existing trip planning and check-in features remain unchanged.</p>
    </section>
  );
}

const mount = document.getElementById('react-shortcuts');
if (mount) createRoot(mount).render(<TravelShortcuts />);
