import { createNavigationPanel } from '../panels/navigationPanel.js';
import { resetProgress } from '../panels/missionCardPanel.js';

const STORAGE_KEY = 'floodwatch-settings';

export const defaultSettings = Object.freeze({
  simulationSpeed: 'normal',
  hintsEnabled: false,
});

const validSimulationSpeeds = new Set(['slow', 'normal', 'fast']);
const speedMultipliers = {
  slow: 0.5,
  normal: 1,
  fast: 2,
};

// Replaces missing or invalid setting values with defaults.
function normalizeSettings(settings) {
  return {
    simulationSpeed: validSimulationSpeeds.has(settings?.simulationSpeed)
      ? settings.simulationSpeed
      : defaultSettings.simulationSpeed,
    hintsEnabled:
      typeof settings?.hintsEnabled === 'boolean'
        ? settings.hintsEnabled
        : defaultSettings.hintsEnabled,
  };
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  const normalizedSettings = normalizeSettings(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
  } catch {
    return normalizedSettings;
  }
  return normalizedSettings;
}

export function updateSetting(key, value) {
  return saveSettings({ ...loadSettings(), [key]: value });
}

export function getSimulationSpeedMultiplier(settings = loadSettings()) {
  return speedMultipliers[settings.simulationSpeed] ?? speedMultipliers.normal;
}

export function areHintsEnabled() {
  return loadSettings().hintsEnabled;
}

// Builds the settings page and connects its save and progress-reset controls.
export function renderSettingsPage({ returnRoute = null, onProgressReset = () => {} } = {}) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  const settings = loadSettings();
  main.className = 'page-layout settings-page';
  main.innerHTML = `
    <header class="panel settings-header">
      <div>
        <h1>Settings</h1>
        <p>Adjust the simulation speed, choose whether to use hints, or reset mission progress.</p>
      </div>
      <a class="button-link settings-return" href="#${returnRoute ?? 'home'}">
        ${returnRoute ? 'Return to Active Mission' : 'Return to Home'}
      </a>
    </header>

    <form class="settings-form">
      <section class="panel settings-section" aria-labelledby="speed-title">
        <h2 id="speed-title">Simulation Speed</h2>
        <p>Controls how quickly packets and other network activity are displayed.</p>
        <fieldset class="settings-options">
          <legend>Select a speed</legend>
          <label><input type="radio" name="simulation-speed" value="slow" ${settings.simulationSpeed === 'slow' ? 'checked' : ''}> <span><strong>Slow</strong> – 0.5× speed</span></label>
          <label><input type="radio" name="simulation-speed" value="normal" ${settings.simulationSpeed === 'normal' ? 'checked' : ''}> <span><strong>Normal</strong> – 1× speed</span></label>
          <label><input type="radio" name="simulation-speed" value="fast" ${settings.simulationSpeed === 'fast' ? 'checked' : ''}> <span><strong>Fast</strong> – 2× speed</span></label>
        </fieldset>
      </section>

      <section class="panel settings-section" aria-labelledby="hints-title">
        <h2 id="hints-title">Gameplay Hints</h2>
        <label class="hint-setting">
          <input type="checkbox" name="hints-enabled" ${settings.hintsEnabled ? 'checked' : ''}>
          <span><strong>Enable Hints</strong><br>When enabled, additional guidance may appear during missions to help identify suspicious network behavior.</span>
        </label>
      </section>

      <button type="submit">Save Settings</button>
      <p class="settings-save-status" aria-live="polite"></p>
    </form>

    <section class="panel settings-section reset-section" aria-labelledby="reset-title">
      <h2 id="reset-title">Reset Game Progress</h2>
      <p>Erase completed missions and return progress to the beginning.</p>
      <button class="reset-progress" type="button">Reset Progress</button>
      <p class="reset-status" aria-live="polite"></p>
    </section>

    <dialog class="panel settings-confirmation" aria-labelledby="reset-confirmation-title">
      <h2 id="reset-confirmation-title">Reset Game Progress?</h2>
      <p>Are you sure you want to reset your game progress? This action cannot be undone.</p>
      <div class="confirmation-actions">
        <button class="confirm-reset" type="button">Confirm Reset</button>
        <button class="cancel-reset" type="button">Cancel</button>
      </div>
    </dialog>
  `;

  const form = main.querySelector('.settings-form');
  const confirmation = main.querySelector('.settings-confirmation');
  // Saves the selected speed and hint options when the form is submitted.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveSettings({
      simulationSpeed: form.elements['simulation-speed'].value,
      hintsEnabled: form.elements['hints-enabled'].checked,
    });
    main.querySelector('.settings-save-status').textContent = 'Settings saved.';
  });

  // Opens the progress-reset confirmation dialog.
  main.querySelector('.reset-progress').addEventListener('click', () => confirmation.showModal());
  // Closes the confirmation dialog without resetting progress.
  main.querySelector('.cancel-reset').addEventListener('click', () => confirmation.close());
  // Treats the browser's dialog cancel action like the Cancel button.
  confirmation.addEventListener('cancel', () => confirmation.close());
  // Clears saved progress after the player confirms the reset.
  main.querySelector('.confirm-reset').addEventListener('click', () => {
    resetProgress();
    confirmation.close();
    onProgressReset();
    const returnLink = main.querySelector('.settings-return');
    returnLink.href = '#home';
    returnLink.textContent = 'Return to Home';
    main.querySelector('.reset-status').textContent = 'Game progress has been reset.';
  });

  page.append(createNavigationPanel(), main);
  return page;
}
