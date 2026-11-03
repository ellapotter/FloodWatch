import test from 'node:test';
import assert from 'node:assert/strict';

import { canOpenReport, createEvidenceStore } from '../src/game/gameEngine.js';
import { levelOneReport } from '../src/game/levels/levelOneContent.js';
import { getLevelOneInvestigation } from '../src/game/levels/levelOneMission.js';

const simulationState = {
  pendingHalfOpenConnections: 4,
  backlogCapacity: 5,
  synPacketsReceived: 20,
  completedHandshakes: 4,
  failedLegitimateAttempts: 2,
  attackEvidenceObserved: true,
};

test('client content follows its actual simulation behavior', () => {
  const connected = getLevelOneInvestigation({
    kind: 'client',
    client: { id: 'client-session-1', state: 'connected', behavior: 'normal' },
  });
  assert.equal(
    connected.details,
    'This is a client trying to communicate with the web server. (It is currently connected and sending data to the server)',
  );
  assert.equal(connected.evidence.available, true);

  const connecting = getLevelOneInvestigation({
    kind: 'client',
    client: { id: 'client-session-2', state: 'connecting', behavior: 'normal' },
  });
  assert.match(connecting.details, /attempting to connect/);
  assert.equal(connecting.evidence.available, false);

  const waiting = getLevelOneInvestigation({
    kind: 'client',
    client: { id: 'client-session-6', state: 'waiting-for-syn-ack', behavior: 'waiting' },
  });
  assert.equal(waiting.title, 'Waiting Client');

  const suspicious = getLevelOneInvestigation({
    kind: 'client',
    client: { id: 'client-session-5', state: 'connected', behavior: 'suspicious' },
  });
  assert.equal(suspicious.title, 'Suspicious Client');
  assert.equal(suspicious.evidence.id, 'suspicious-client');
});

test('packet content distinguishes normal SYN from repeated SYN behavior', () => {
  const normalSyn = getLevelOneInvestigation({
    kind: 'packet',
    packet: { id: 'packet-1', type: 'SYN', isAttack: false },
  });
  assert.equal(normalSyn.title, 'SYN packet');
  assert.equal(normalSyn.evidence.id, 'client-syn-request');

  const repeatedSyn = getLevelOneInvestigation(
    {
      kind: 'packet',
      packet: { id: 'packet-2', type: 'SYN', isAttack: true },
    },
    simulationState,
  );
  assert.equal(repeatedSyn.title, 'Repeated SYN packet');
  assert.equal(repeatedSyn.evidence.description, 'High number of new SYN requests');

  const earlyAttackSyn = getLevelOneInvestigation({
    kind: 'packet',
    packet: { id: 'packet-early', type: 'SYN', isAttack: true },
  }, { attackEvidenceObserved: false });
  assert.equal(earlyAttackSyn.title, 'SYN packet');

  assert.equal(
    getLevelOneInvestigation({
      kind: 'packet',
      packet: { id: 'packet-3', type: 'DATA', isAttack: false },
    }),
    null,
  );
});

test('server and backlog investigations use live simulation values', () => {
  const server = getLevelOneInvestigation({ kind: 'server' }, simulationState);
  const backlog = getLevelOneInvestigation({ kind: 'backlog' }, simulationState);
  assert.deepEqual(server.dynamicFacts[0], ['Pending connections', '4 / 5']);
  assert.deepEqual(backlog.dynamicFacts, server.dynamicFacts);
});

test('evidence is unique and only relevant evidence enables Report Attack', () => {
  const store = createEvidenceStore('syn-flood');
  const normalEvidence = {
    id: 'client-syn-request',
    description: 'Client sends SYN packet to request a connection (Step 1)',
    missionId: 'syn-flood',
  };
  assert.equal(store.collect(normalEvidence), true);
  assert.equal(store.collect(normalEvidence), false);
  assert.equal(store.getAll().length, 1);
  assert.equal(canOpenReport(levelOneReport, store.getAll()), false);

  assert.equal(
    store.collect({
      id: 'repeated-syn',
      description: 'High number of new SYN requests',
      missionId: 'syn-flood',
    }),
    true,
  );
  assert.equal(canOpenReport(levelOneReport, store.getAll()), true);
});
