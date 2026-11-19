import { createNavigationPanel } from '../panels/navigationPanel.js';
import { loadProgress, resetProgress, unlockAllLevels } from '../panels/missionCardPanel.js';
import { decorateHeading, settingsIconMappings } from '../icons/iconSystem.js';

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

export function getSimulationSpeedMultiplier(settings = loadSettings()) {
  return speedMultipliers[settings.simulationSpeed] ?? speedMultipliers.normal;
}

// Builds the settings page and connects its save and progress-reset controls.
export function renderSettingsPage({ returnRoute = null, onProgressReset = () => {} } = {}) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  const settings = loadSettings();
  const allLevelsUnlocked = loadProgress().allLevelsUnlocked === true;
  main.className = 'page-layout settings-page';
  main.innerHTML = `
    <header class="panel settings-header">
      <div>
        <h1>Settings</h1>
        <p>Adjust the simulation speed, choose whether to use hints, or reset mission progress.</p>
      </div>
      ${returnRoute ? `<a class="button-link button--secondary settings-return" href="#${returnRoute}">Return to Active Mission</a>` : ''}
    </header>

    <form class="panel settings-form" aria-labelledby="preferences-title">
      <div class="settings-form__heading">
        <h2 id="preferences-title">Preferences</h2>
        <p>Choose how the simulation runs and how much guidance appears.</p>
      </div>
      <section class="settings-section settings-preference" aria-labelledby="speed-title">
        <h2 id="speed-title">Simulation Speed</h2>
        <p>Controls how quickly packets and other network activity are displayed.</p>
        <fieldset class="settings-options">
          <legend>Select a speed</legend>
          <label><input type="radio" name="simulation-speed" value="slow" ${settings.simulationSpeed === 'slow' ? 'checked' : ''}> <span><strong>Slow</strong> – 0.5× speed</span></label>
          <label><input type="radio" name="simulation-speed" value="normal" ${settings.simulationSpeed === 'normal' ? 'checked' : ''}> <span><strong>Normal</strong> – 1× speed</span></label>
          <label><input type="radio" name="simulation-speed" value="fast" ${settings.simulationSpeed === 'fast' ? 'checked' : ''}> <span><strong>Fast</strong> – 2× speed</span></label>
        </fieldset>
      </section>

      <section class="settings-section settings-preference" aria-labelledby="hints-title">
        <h2 id="hints-title">Gameplay Hints</h2>
        <label class="hint-setting">
          <input type="checkbox" name="hints-enabled" ${settings.hintsEnabled ? 'checked' : ''}>
          <span><strong>Enable Hints</strong><br>When enabled, additional guidance may appear during missions to help identify suspicious network behavior.</span>
        </label>
      </section>

      <footer class="settings-form__footer">
        <button class="button--primary" type="submit">Save Settings</button>
        <p class="settings-save-status" aria-live="polite"></p>
      </footer>
    </form>

    <section class="panel settings-section developer-section" aria-labelledby="developer-title">
      <div>
        <h2 id="developer-title">Developer &amp; Educator Tools</h2>
        <p>Open every mission for demonstrations, lesson planning, and development testing. Unplayed missions will remain marked as available rather than completed.</p>
      </div>
      <div class="developer-section__action">
        <button class="unlock-levels button--secondary" type="button" ${allLevelsUnlocked ? 'disabled' : ''}>
          ${allLevelsUnlocked ? 'All Levels Unlocked' : 'Unlock All Levels'}
        </button>
        <p class="unlock-status" aria-live="polite">${allLevelsUnlocked ? 'Every level is currently available.' : ''}</p>
      </div>
    </section>

    <section class="panel settings-section reset-section" aria-labelledby="reset-title">
      <h2 id="reset-title">Reset Game Progress</h2>
      <p>Erase completed missions and return progress to the beginning.</p>
      <button class="reset-progress button--danger" type="button">Reset Progress</button>
      <p class="reset-status" aria-live="polite"></p>
    </section>

    <dialog class="panel settings-confirmation" aria-labelledby="reset-confirmation-title">
      <h2 id="reset-confirmation-title">Reset Game Progress?</h2>
      <p>Are you sure you want to reset your game progress? This action cannot be undone.</p>
      <div class="confirmation-actions">
        <button class="confirm-reset button--danger" type="button">Confirm Reset</button>
        <button class="cancel-reset button--secondary" type="button">Close</button>
      </div>
    </dialog>
  `;
  decorateHeading(main.querySelector('.settings-header h1'), settingsIconMappings.page, {
    size: 24,
  });
  decorateHeading(main.querySelector('#preferences-title'), settingsIconMappings.page);
  decorateHeading(main.querySelector('#speed-title'), settingsIconMappings.speed);
  decorateHeading(main.querySelector('#hints-title'), settingsIconMappings.hints);
  decorateHeading(main.querySelector('#developer-title'), settingsIconMappings.developer);
  decorateHeading(main.querySelector('#reset-title'), settingsIconMappings.reset);

  const form = main.querySelector('.settings-form');
  const confirmation = main.querySelector('.settings-confirmation');
  const unlockButton = main.querySelector('.unlock-levels');
  const unlockStatus = main.querySelector('.unlock-status');
  const returnLink = main.querySelector('.settings-return');
  // Saves the selected speed and hint options when the form is submitted.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveSettings({
      simulationSpeed: form.elements['simulation-speed'].value,
      hintsEnabled: form.elements['hints-enabled'].checked,
    });
    main.querySelector('.settings-save-status').textContent = 'Settings saved.';
  });

  // Makes every mission available without changing completion history.
  unlockButton.addEventListener('click', () => {
    unlockAllLevels();
    unlockButton.disabled = true;
    unlockButton.textContent = 'All Levels Unlocked';
    unlockStatus.textContent = 'Every level is now available from the Home screen.';
  });

  // Opens the progress-reset confirmation dialog.
  main.querySelector('.reset-progress').addEventListener('click', () => confirmation.showModal());
  // Closes the confirmation dialog without resetting progress.
  main.querySelector('.cancel-reset').addEventListener('click', () => confirmation.close());
  // Treats the browser's dialog cancel action like the Close button.
  confirmation.addEventListener('cancel', () => confirmation.close());
  // Clears saved progress after the player confirms the reset.
  main.querySelector('.confirm-reset').addEventListener('click', () => {
    resetProgress();
    confirmation.close();
    onProgressReset();
    returnLink?.remove();
    unlockButton.disabled = false;
    unlockButton.textContent = 'Unlock All Levels';
    unlockStatus.textContent = '';
    main.querySelector('.reset-status').textContent = 'Game progress has been reset.';
  });

  page.append(createNavigationPanel(), main);
  return page;
}
