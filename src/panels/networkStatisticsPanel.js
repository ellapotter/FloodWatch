// Creates a statistics panel that summarizes the current state of the network.
import { decorateHeading, panelIconMappings } from '../icons/iconSystem.js';

export function createNetworkStatisticsPanel(statistics) {
  const section = document.createElement('section');
  const valueElements = new Map();
  const statusElements = new Map();
  const capacityElements = new Map();
  section.className = 'panel mission-statistics';
  section.setAttribute('aria-labelledby', 'statistics-title');
  section.innerHTML = `
    <h2 id="statistics-title">Network Statistics</h2>
    <p class="statistics-simulation-note">
      <strong>Simulation note:</strong> Timing, traffic rates, capacity limits, and statistics are simplified and scaled for educational purposes. They do not represent real-world network performance or operational thresholds.
    </p>
    <dl class="statistics-list"></dl>
  `;
  decorateHeading(section.querySelector('#statistics-title'), panelIconMappings.statistics);

  const list = section.querySelector('.statistics-list');
  statistics.forEach(({ key, label, primary = false, capacity = null }) => {
    const row = document.createElement('div');
    row.className = primary ? 'statistics-row is-primary' : 'statistics-row';
    row.innerHTML = `
      <div class="statistics-row__values"><dt>${label}</dt><dd>0</dd></div>
      <span class="statistics-status" hidden></span>
      ${capacity ? '<progress class="statistics-capacity" max="100" value="0" aria-label="Capacity used"></progress>' : ''}
    `;
    valueElements.set(key, row.querySelector('dd'));
    statusElements.set(key, row.querySelector('.statistics-status'));
    capacityElements.set(key, row.querySelector('.statistics-capacity'));
    list.append(row);
  });

  return {
    element: section,
    // Updates each displayed value from the latest mission state.
    update(state) {
      statistics.forEach(({
        key,
        format = (value) => value,
        status = null,
        capacity = null,
      }) => {
        valueElements.get(key).textContent = format(state[key], state);
        const statusElement = statusElements.get(key);
        const statusState = status?.(state) ?? null;
        statusElement.hidden = !statusState;
        if (statusState) {
          statusElement.textContent = statusState.label;
          statusElement.dataset.tone = statusState.tone ?? 'neutral';
        }
        const capacityElement = capacityElements.get(key);
        if (capacityElement && capacity) {
          capacityElement.value = Math.min(100, Math.max(0, capacity(state)));
        }
      });
    },
  };
}
