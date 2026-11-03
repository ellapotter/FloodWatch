// Creates a statistics panel that summarizes the current state of the network.
export function createNetworkStatisticsPanel(statistics) {
  const section = document.createElement('section');
  const valueElements = new Map();
  section.className = 'panel mission-statistics';
  section.setAttribute('aria-labelledby', 'statistics-title');
  section.innerHTML = `
    <h2 id="statistics-title">Network Statistics</h2>
    <dl class="statistics-list"></dl>
  `;

  const list = section.querySelector('.statistics-list');
  statistics.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.innerHTML = `<dt>${label}</dt><dd>0</dd>`;
    valueElements.set(key, row.querySelector('dd'));
    list.append(row);
  });

  return {
    element: section,
    // Updates each displayed value from the latest mission state.
    update(state) {
      statistics.forEach(({ key, format = (value) => value }) => {
        valueElements.get(key).textContent = format(state[key]);
      });
    },
  };
}
