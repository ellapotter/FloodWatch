import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMitigationState,
  createReportState,
} from '../src/game/gameEngine.js';
import {
  levelOneMitigations,
  levelOneReport,
} from '../src/game/levels/levelOneContent.js';
import {
  getMissionStatus,
  loadProgress,
  markMissionCompleted,
  missions,
  resetProgress,
  saveProgress,
  unlockAllLevels,
} from '../src/panels/missionCardPanel.js';

const storage = new Map();
global.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, value);
  },
};

test('incorrect reports can be retried and only SYN Flood succeeds', () => {
  const report = createReportState(levelOneReport);
  report.select('tcp-ack-flood');
  const incorrect = report.submit();
  assert.equal(incorrect.isCorrect, false);
  assert.equal(incorrect.message, levelOneReport.choices[1].feedback);

  report.select('syn-flood');
  const correct = report.submit();
  assert.equal(correct.isCorrect, true);
  assert.equal(correct.message, levelOneReport.choices[0].feedback);
});

test('incorrect mitigations do not activate success and SYN cookies do', () => {
  assert.deepEqual(
    levelOneMitigations.choices.map((choice) => choice.name),
    ['Enable SYN cookies', 'Increase TCP backlog', 'Block TCP traffic'],
  );
  const mitigation = createMitigationState(levelOneMitigations);
  mitigation.select('increase-tcp-backlog');
  assert.equal(mitigation.apply().isCorrect, false);
  assert.equal(mitigation.getState().isSuccessful, false);

  mitigation.select('enable-syn-cookies');
  assert.equal(mitigation.apply().isCorrect, true);
  assert.equal(mitigation.getState().isSuccessful, true);
});

test('completing Level 1 unlocks only Level 2 and persists idempotently', () => {
  storage.clear();
  markMissionCompleted('syn-flood');
  markMissionCompleted('syn-flood');
  const progress = loadProgress();
  const byId = Object.fromEntries(
    missions.map((mission) => [mission.id, getMissionStatus(mission, progress)]),
  );

  assert.deepEqual(progress.completedMissionIds, ['syn-flood']);
  assert.equal(byId['syn-flood'], 'Completed');
  assert.equal(byId['udp-flood'], 'Available');
  assert.equal(byId['http-flood'], 'Locked');
  assert.equal(byId['dns-amplification'], 'Locked');
  assert.equal(byId['final-mission'], 'Locked');

  resetProgress();
  assert.deepEqual(loadProgress().completedMissionIds, []);
});

test('developer unlock makes every mission available without completing them', () => {
  storage.clear();
  const progress = unlockAllLevels();
  const statuses = missions.map((mission) => getMissionStatus(mission, progress));

  assert.deepEqual(progress.completedMissionIds, []);
  assert.equal(progress.allLevelsUnlocked, true);
  assert.deepEqual(statuses, missions.map(() => 'Available'));

  markMissionCompleted('syn-flood');
  const updatedProgress = loadProgress();
  assert.equal(updatedProgress.allLevelsUnlocked, true);
  assert.equal(getMissionStatus(missions[0], updatedProgress), 'Completed');
  assert.equal(getMissionStatus(missions[4], updatedProgress), 'Available');

  resetProgress();
  assert.equal(loadProgress().allLevelsUnlocked, undefined);
});

test('progress saves fail safely when browser storage is unavailable', () => {
  const originalSetItem = global.localStorage.setItem;
  global.localStorage.setItem = () => {
    throw new Error('Storage unavailable');
  };

  const progress = { completedMissionIds: ['syn-flood'] };
  try {
    assert.equal(saveProgress(progress), progress);
  } finally {
    global.localStorage.setItem = originalSetItem;
  }
});
