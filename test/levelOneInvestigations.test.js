import test from 'node:test';
import assert from 'node:assert/strict';

import { canOpenReport, createEvidenceStore } from '../src/game/gameEngine.js';
import { levelOneReport } from '../src/game/levels/levelOneContent.js';
import {
  getLevelOneInvestigation,
  resolveLevelOneSelection,
} from '../src/game/levels/levelOneMission.js';
import {
  getClientPresentation,
  getPacketVisualPosition,
} from '../src/panels/networkObserverPanel.js';

const simulationState = {
  pendingHalfOpenConnections: 4,
  backlogCapacity: 5,
  synPacketsReceived: 20,
  completedHandshakes: 4,
  failedLegitimateAttempts: 2,
  attackEvidenceObserved: true,
};

test('replaced clients are cleared while completed packet investigations remain open', () => {
  const state = {
    visibleClients: [{ id: 'client-new', state: 'connecting', behavior: 'normal' }],
    activePackets: [{ id: 'packet-new', type: 'SYN' }],
  };

  assert.equal(resolveLevelOneSelection({
    kind: 'client', client: { id: 'client-old' },
  }, state), null);
  const completedPacket = {
    kind: 'packet',
    packet: {
      id: 'packet-old',
      type: 'SYN',
      sourceLabel: 'Client 1',
      destinationLabel: 'Web Server',
      direction: 'client-to-server',
    },
  };
  assert.deepEqual(resolveLevelOneSelection(completedPacket, state), completedPacket);
  assert.equal(resolveLevelOneSelection({
    kind: 'backlog',
  }, state).kind, 'backlog');
});

test('client selections follow the current matching client through rapid updates', () => {
  const selection = {
    kind: 'client',
    client: { id: 'client-1', state: 'connecting', behavior: 'normal' },
  };
  const connected = resolveLevelOneSelection(selection, {
    visibleClients: [
      { id: 'client-1', state: 'connected', behavior: 'normal' },
      { id: 'client-2', state: 'connecting', behavior: 'normal' },
    ],
    activePackets: [],
  });
  assert.equal(connected.client.id, 'client-1');
  assert.equal(connected.client.state, 'connected');

  const switched = resolveLevelOneSelection({
    kind: 'client',
    client: { id: 'client-2', state: 'connecting', behavior: 'normal' },
  }, {
    visibleClients: [
      { id: 'client-1', state: 'connected', behavior: 'normal' },
      { id: 'client-2', state: 'waiting-for-syn-ack', behavior: 'waiting' },
    ],
    activePackets: [],
  });
  assert.equal(switched.client.id, 'client-2');
  assert.equal(switched.client.behavior, 'waiting');
});

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
  assert.equal(
    waiting.details,
    'This client is trying to connect to the web server but has not been able to establish a connection successfully.',
  );
  assert.equal(
    waiting.meaning,
    'The client has sent a connection request but is still waiting for the connection to be established. The server is currently handling a large number of incomplete connection requests, which may be affecting its ability to accept new clients.',
  );
  assert.equal(waiting.evidence.description, 'Client is experiencing connection delays');

  const suspicious = getLevelOneInvestigation({
    kind: 'client',
    client: { id: 'client-session-5', state: 'connected', behavior: 'suspicious' },
  });
  assert.equal(suspicious.title, 'Suspicious Client');
  assert.equal(suspicious.evidence.id, 'suspicious-client');
});

test('waiting clients receive a visible and accessible status presentation', () => {
  assert.deepEqual(getClientPresentation({
    id: 'client-4', label: 'Client 4', behavior: 'waiting',
  }), {
    isWaiting: true,
    statusLabel: 'Waiting...',
    ariaLabel: 'Investigate Client 4, connection delayed',
  });
  assert.deepEqual(getClientPresentation({
    id: 'client-1', label: 'Client 1', behavior: 'normal', state: 'connecting',
  }), {
    isWaiting: false,
    statusLabel: 'Connecting',
    ariaLabel: 'Investigate Client 1',
  });
  assert.equal(getClientPresentation({
    id: 'client-2', label: 'Client 2', behavior: 'normal', state: 'connected',
  }).statusLabel, 'Connected');
  assert.equal(getClientPresentation({
    id: 'client-3', label: 'Client 3', behavior: 'suspicious', state: 'connecting',
  }).statusLabel, 'Connecting');
  assert.equal(getClientPresentation({
    id: 'client-3', label: 'Client 3', behavior: 'suspicious', state: 'connecting',
  }, true).statusLabel, 'Review activity');
});

test('packet visual lanes keep full cards outside devices and separate opposing traffic', () => {
  const diagram = {
    clients: [{ x: 100, y: 100 }],
    server: { x: 800, y: 200 },
  };
  assert.deepEqual(getPacketVisualPosition({
    slotIndex: 0, direction: 'client-to-server', progress: 0,
  }, diagram), { x: 228, y: 91 });
  assert.deepEqual(getPacketVisualPosition({
    slotIndex: 0, direction: 'client-to-server', progress: 1,
  }, diagram), { x: 662, y: 191 });
  assert.deepEqual(getPacketVisualPosition({
    slotIndex: 0, direction: 'server-to-client', progress: 0,
  }, diagram), { x: 662, y: 209 });
  assert.deepEqual(getPacketVisualPosition({
    slotIndex: 0, direction: 'server-to-client', progress: 1,
  }, diagram), { x: 228, y: 109 });
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

  const dataPacket = getLevelOneInvestigation({
    kind: 'packet',
    packet: {
      id: 'packet-3',
      type: 'DATA',
      isAttack: false,
      sourceLabel: 'Client 2',
      destinationLabel: 'Web Server',
      direction: 'client-to-server',
    },
  });
  assert.equal(dataPacket.title, 'Data Packet');
  assert.equal(
    dataPacket.details,
    'This is a data packet traveling between a client and the web server. It contains information being exchanged after the TCP three-way handshake has successfully established a connection.',
  );
  assert.equal(
    dataPacket.evidence.description,
    'Client and server are exchanging data through an established TCP connection.',
  );
  assert.deepEqual(dataPacket.dynamicFacts, [
    ['Packet Type', 'DATA'],
    ['Source', 'Client 2'],
    ['Destination', 'Web Server'],
  ]);

  const responsePacket = getLevelOneInvestigation({
    kind: 'packet',
    packet: {
      id: 'packet-4',
      type: 'SYN-ACK',
      sourceLabel: 'Web Server',
      destinationLabel: 'Client 2',
      direction: 'server-to-client',
    },
  });
  assert.deepEqual(responsePacket.dynamicFacts.slice(1), [
    ['Source', 'Web Server'],
    ['Destination', 'Client 2'],
  ]);
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

  assert.equal(store.collect({
    id: 'client-connection-delays',
    description: 'Client is experiencing connection delays',
    missionId: 'syn-flood',
  }), true);
  assert.equal(canOpenReport(levelOneReport, store.getAll()), false);

  assert.equal(store.collect({
    id: 'established-connection-data',
    description: 'Client and server are exchanging data through an established TCP connection.',
    missionId: 'syn-flood',
  }), true);
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
