import test from 'node:test';
import assert from 'node:assert/strict';

import { levelOneMission } from '../src/game/levels/levelOneMission.js';
import { levelTwoMission } from '../src/game/levels/levelTwoMission.js';
import {
  levelOneMitigations,
  levelOneReport,
} from '../src/game/levels/levelOneContent.js';
import {
  findMissionDefinition,
  findMissionByRoute,
  getMissionRoute,
  getMissionCardTitle,
  getMissionCardPresentation,
  missions,
} from '../src/panels/missionCardPanel.js';

test('the mission catalog exposes Level 1 through the shared definition interface', () => {
  const definition = findMissionDefinition('syn-flood');

  assert.equal(definition, levelOneMission);
  assert.equal(definition.report, levelOneReport);
  assert.deepEqual(definition.mitigation, {
    ...levelOneMitigations,
    identifiedAttack: {
      name: 'SYN Flood',
      description: levelOneReport.choices.find((choice) => choice.id === 'syn-flood').description,
    },
  });
  assert.equal(typeof definition.createRuntime, 'function');
  assert.equal(typeof definition.getInvestigation, 'function');
  assert.equal(definition.statistics.length, 4);
});

test('public mission routes do not expose attack names', () => {
  assert.equal(findMissionByRoute('level-1')?.id, 'syn-flood');
  assert.equal(getMissionRoute('syn-flood'), 'level-1');
  assert.equal(missions.some((mission) => mission.route.includes(mission.id)), false);
});

test('mission completion and navigation are supplied by the Level 1 definition', () => {
  assert.equal(levelOneMission.completion.nextMissionId, 'udp-flood');
  assert.equal(findMissionDefinition('udp-flood'), levelTwoMission);
  assert.equal(levelTwoMission.completion.nextMissionId, 'http-flood');
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

test('mission cards reveal attack details only after completion', () => {
  const mission = missions[0];
  const available = getMissionCardPresentation(mission, 'Available');
  const locked = getMissionCardPresentation(mission, 'Locked');
  const completed = getMissionCardPresentation(mission, 'Completed');

  assert.deepEqual(available, {
    title: 'Level One',
    description: '',
    icon: 'shield-alert',
  });
  assert.deepEqual(locked, {
    title: 'Level One',
    description: '',
    icon: 'lock',
  });
  assert.deepEqual(completed, {
    title: 'Level 1: SYN Flood',
    description: mission.description,
    icon: 'shield-alert',
  });
});
