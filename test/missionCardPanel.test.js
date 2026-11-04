import test from 'node:test';
import assert from 'node:assert/strict';

import { levelOneMission } from '../src/game/levels/levelOneMission.js';
import {
  levelOneMitigations,
  levelOneReport,
} from '../src/game/levels/levelOneContent.js';
import {
  findMissionDefinition,
  getMissionCardTitle,
  missions,
} from '../src/panels/missionCardPanel.js';

test('the mission catalog exposes Level 1 through the shared definition interface', () => {
  const definition = findMissionDefinition('syn-flood');

  assert.equal(definition, levelOneMission);
  assert.equal(definition.report, levelOneReport);
  assert.equal(definition.mitigation, levelOneMitigations);
  assert.equal(typeof definition.createRuntime, 'function');
  assert.equal(typeof definition.getInvestigation, 'function');
  assert.equal(definition.statistics.length, 4);
});

test('mission completion and navigation are supplied by the Level 1 definition', () => {
  assert.equal(levelOneMission.completion.nextMissionId, 'udp-flood');
  assert.equal(findMissionDefinition('udp-flood'), null);
});

test('mission card titles include existing attack names', () => {
  assert.deepEqual(missions.map(getMissionCardTitle), [
    'Level 1: SYN Flood',
    'Level 2: UDP Flood',
    'Level 3: HTTP Flood',
    'Level 4: DNS Amplification',
    'Final Mission',
  ]);
});
