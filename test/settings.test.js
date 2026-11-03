import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultSettings,
  getSimulationSpeedMultiplier,
  loadSettings,
  saveSettings,
} from '../src/pages/settingsPage.js';

const storage = new Map();
global.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, value);
  },
};

test('hints default to disabled and saved settings persist', () => {
  storage.clear();
  assert.deepEqual(loadSettings(), defaultSettings);

  saveSettings({ simulationSpeed: 'fast', hintsEnabled: true });
  assert.deepEqual(loadSettings(), {
    simulationSpeed: 'fast',
    hintsEnabled: true,
  });
  assert.equal(getSimulationSpeedMultiplier(loadSettings()), 2);
});

test('slow, normal, and fast speed settings use the expected multipliers', () => {
  assert.equal(getSimulationSpeedMultiplier({ simulationSpeed: 'slow' }), 0.5);
  assert.equal(getSimulationSpeedMultiplier({ simulationSpeed: 'normal' }), 1);
  assert.equal(getSimulationSpeedMultiplier({ simulationSpeed: 'fast' }), 2);
});
