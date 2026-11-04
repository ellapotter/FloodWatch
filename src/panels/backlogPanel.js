// Creates a configurable capacity panel that a mission can connect to its own state.
import { decorateHeading, panelIconMappings } from '../icons/iconSystem.js';

export function createBacklogPanel({
  capacity,
  title = 'Backlog',
  description = '',
  countLabel = 'Items',
  pressureThreshold = 0.6,
  statusMessages = {},
  getCount = () => 0,
  getCapacity = () => capacity,
}) {
  const section = document.createElement('section');
  section.className = 'panel backlog-panel';
  section.style.setProperty('--backlog-capacity', capacity);
  section.setAttribute('aria-labelledby', 'backlog-title');
  section.innerHTML = `
    <h2 id="backlog-title"></h2>
    <p class="backlog-description"></p>
    <p class="backlog-count" aria-live="polite"><span></span>: <strong>0 / ${capacity}</strong></p>
    <div class="backlog-slots" aria-hidden="true">
      ${Array.from({ length: capacity }, () => '<span></span>').join('')}
    </div>
    <p class="backlog-status"></p>
  `;

  const messages = {
    available: 'Capacity available',
    pressure: 'Capacity under pressure',
    full: 'Capacity full',
    ...statusMessages,
  };
  section.querySelector('h2').textContent = title;
  decorateHeading(section.querySelector('h2'), panelIconMappings.backlog);
  section.querySelector('.backlog-description').textContent = description;
  section.querySelector('.backlog-count span').textContent = countLabel;
  const count = section.querySelector('.backlog-count strong');
  const status = section.querySelector('.backlog-status');
  status.textContent = messages.available;
  const slotsContainer = section.querySelector('.backlog-slots');
  let renderedCapacity = capacity;

  function renderSlots(nextCapacity) {
    if (nextCapacity === renderedCapacity && slotsContainer.children.length === nextCapacity) return;
    renderedCapacity = nextCapacity;
    section.style.setProperty('--backlog-capacity', nextCapacity);
    slotsContainer.replaceChildren(
      ...Array.from({ length: nextCapacity }, () => document.createElement('span')),
    );
  }

  return {
    element: section,
    // Updates occupied slots and the pressure message from the latest state.
    update(state) {
      const currentCount = getCount(state);
      const currentCapacity = getCapacity(state);
      renderSlots(currentCapacity);
      count.textContent = `${currentCount} / ${currentCapacity}`;
      [...slotsContainer.children].forEach((slot, index) => {
        slot.classList.toggle('is-occupied', index < currentCount);
      });
      section.classList.toggle('is-full', currentCount >= currentCapacity);
      status.textContent = currentCount >= currentCapacity
        ? messages.full
        : currentCount >= Math.ceil(currentCapacity * pressureThreshold)
          ? messages.pressure
          : messages.available;
    },
  };
}
