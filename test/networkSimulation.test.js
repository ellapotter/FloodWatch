import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLevelOneNetworkSimulation,
  levelOneSimulation,
} from '../src/game/levels/levelOneMission.js';
import { NetworkSimulation } from '../src/game/gameEngine.js';

global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

function createSimulation(overrides = {}) {
  const packetHistory = [];
  const seenPacketIds = new Set();
  let latestState;
  let maximumConcurrentPackets = 0;
  const simulation = createLevelOneNetworkSimulation({
    clients: [
      { id: 'client-1', x: 0, y: 0 },
      { id: 'client-2', x: 0, y: 1 },
      { id: 'client-3', x: 0, y: 2 },
    ],
    server: { id: 'web-server', label: 'Web Server', x: 10, y: 1 },
    onPacketsChange(packets) {
      maximumConcurrentPackets = Math.max(maximumConcurrentPackets, packets.length);
      packets.forEach((packet) => {
        if (!seenPacketIds.has(packet.id)) {
          seenPacketIds.add(packet.id);
          packetHistory.push({ ...packet });
        }
      });
    },
    onStateChange(state) {
      latestState = state;
    },
    random: () => 0.5,
    ...overrides,
  });
  return {
    simulation,
    packetHistory,
    getState: () => latestState,
    getMaximumConcurrentPackets: () => maximumConcurrentPackets,
  };
}

function advance(simulation, duration, step = 100) {
  for (let timestamp = 0; timestamp <= duration; timestamp += step) {
    simulation.tick(timestamp);
  }
}

test('the shared controller delegates behavior to any mission driver', () => {
  const calls = [];
  const state = { mission: 'example', isPlaying: false };
  const simulation = new NetworkSimulation({
    speedMultiplier: 2,
    createDriver(options) {
      assert.equal(options.speedMultiplier, 2);
      return {
        play() {
          calls.push('play');
          state.isPlaying = true;
        },
        pause() {
          calls.push('pause');
          state.isPlaying = false;
        },
        reset(shouldPlay) {
          calls.push(`reset:${shouldPlay}`);
        },
        destroy() {
          calls.push('destroy');
        },
        setSpeed(speed) {
          calls.push(`speed:${speed}`);
        },
        getState() {
          return { ...state };
        },
        tick(timestamp) {
          calls.push(`tick:${timestamp}`);
        },
        performAction(actionName) {
          calls.push(`action:${actionName}`);
          return true;
        },
        getTiming() {
          return { packetDuration: 1250 };
        },
      };
    },
  });

  simulation.play();
  assert.deepEqual(simulation.getState(), { mission: 'example', isPlaying: true });
  simulation.pause();
  simulation.setSpeed(0.5);
  simulation.tick(500);
  assert.equal(simulation.performAction('custom-defense'), true);
  assert.deepEqual(simulation.getTiming(), { packetDuration: 1250 });
  simulation.reset(false);
  simulation.destroy();
  assert.deepEqual(calls, [
    'play',
    'pause',
    'speed:0.5',
    'tick:500',
    'action:custom-defense',
    'reset:false',
    'destroy',
  ]);
});

test('clients handshake independently and packets overlap', () => {
  const { simulation, packetHistory, getState, getMaximumConcurrentPackets } = createSimulation();
  simulation.play();
  advance(simulation, 25000);

  assert.ok(getMaximumConcurrentPackets() > 1);
  assert.ok(getState().completedHandshakes >= 3);

  const firstConnectionId = packetHistory.find((packet) => packet.type === 'SYN').connectionId;
  assert.deepEqual(
    packetHistory
      .filter((packet) => packet.connectionId === firstConnectionId)
      .map((packet) => packet.type),
    ['SYN', 'SYN-ACK', 'ACK'],
  );
});

test('connected clients exchange DATA in both directions and are replaced', () => {
  const { simulation, packetHistory, getState } = createSimulation();
  simulation.play();
  advance(simulation, 45000);

  const dataPackets = packetHistory.filter((packet) => packet.type === 'DATA');
  assert.ok(dataPackets.some((packet) => packet.destinationId === 'web-server'));
  assert.ok(dataPackets.some((packet) => packet.sourceId === 'web-server'));
  assert.ok(dataPackets.some(
    (packet) => packet.destinationLabel === 'Web Server'
      && packet.sourceLabel.startsWith('Client '),
  ));
  assert.ok(dataPackets.some(
    (packet) => packet.sourceLabel === 'Web Server'
      && packet.destinationLabel.startsWith('Client '),
  ));
  assert.ok(
    getState().visibleClients.some(
      (client) => Number(client.label.replace('Client ', '')) > 3,
    ),
  );

  const dataPacketsBySession = new Map();
  dataPackets.forEach((packet) => {
    dataPacketsBySession.set(
      packet.sessionId,
      (dataPacketsBySession.get(packet.sessionId) ?? 0) + 1,
    );
  });
  assert.ok(
    [...dataPacketsBySession.values()].some(
      (packetCount) => packetCount === levelOneSimulation.dataPacketsPerConnection,
    ),
  );
  dataPacketsBySession.forEach((packetCount) => {
    assert.ok(packetCount <= levelOneSimulation.dataPacketsPerConnection);
  });
});

test('a random client position changes behavior after one minute', () => {
  const before = createSimulation();
  before.simulation.play();
  advance(before.simulation, 59000);
  assert.equal(before.getState().simulationPhase, 'normal-traffic');
  assert.equal(before.getState().attackClientSlot, null);

  const after = createSimulation();
  after.simulation.play();
  advance(after.simulation, 70000);
  assert.notEqual(after.getState().simulationPhase, 'normal-traffic');
  assert.equal(after.getState().attackClientSlot, 1);
  assert.ok(
    after.getState().visibleClients.some(
      (client) => client.slotIndex === 1 && client.behavior === 'suspicious',
    ),
  );
});

test('the second outbound attack SYN marks the client suspicious before either SYN arrives', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, levelOneSimulation.attackStartDelay);

  const attackStarted = getState();
  assert.equal(attackStarted.attackSynPacketsSent, 1);
  assert.equal(attackStarted.attackSynPacketsReceived, 0);
  assert.equal(
    attackStarted.activePackets.filter((packet) => packet.type === 'SYN' && packet.isAttack).length,
    1,
  );

  simulation.tick(levelOneSimulation.attackStartDelay + levelOneSimulation.attackAttemptInterval);
  const repeatedTraffic = getState();
  assert.equal(repeatedTraffic.attackSynPacketsSent, 2);
  assert.equal(repeatedTraffic.attackSynPacketsReceived, 0);
  assert.equal(
    repeatedTraffic.activePackets.filter(
      (packet) => packet.type === 'SYN' && packet.isAttack,
    ).length,
    2,
  );
  assert.ok(
    repeatedTraffic.visibleClients.some(
      (client) => client.slotIndex === repeatedTraffic.attackClientSlot
        && client.behavior === 'suspicious',
    ),
  );
});

test('half-open attack connections release backlog space after ten seconds', () => {
  const { simulation, getState } = createSimulation();
  assert.equal(levelOneSimulation.pendingConnectionTimeout, 10000);
  simulation.play();
  advance(simulation, 76000);

  const state = getState();
  assert.ok(state.timedOutConnections > 0);
  assert.ok(state.pendingHalfOpenConnections <= state.backlogCapacity);
  assert.ok(state.attackSynPacketsSent > state.pendingHalfOpenConnections);
});

test('normal traffic clients are not marked as waiting', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 50000);

  assert.ok(getState().visibleClients.length > 0);
  assert.equal(
    getState().visibleClients.some((client) => client.behavior === 'waiting'),
    false,
  );
});

test('the random selection can choose any of the three client positions', () => {
  const choices = [
    [0, 0],
    [0.5, 1],
    [0.999, 2],
  ];

  choices.forEach(([randomValue, expectedSlot]) => {
    const { simulation, getState } = createSimulation({
      random: () => randomValue,
    });
    simulation.play();
    advance(simulation, 70000);
    assert.equal(getState().attackClientSlot, expectedSlot);
  });
});

test('the selected client remains while other clients fail and are replaced', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 90000);
  const state = getState();

  assert.equal(state.simulationPhase, 'attack-established');
  assert.ok(state.synPacketsReceived > state.completedHandshakes);
  assert.ok(state.failedLegitimateAttempts >= 2);
  assert.ok(state.pendingHalfOpenConnections <= state.backlogCapacity);
  assert.ok(
    state.visibleClients.some(
      (client) => client.slotIndex === state.attackClientSlot,
    ),
  );
});

test('new clients continue appearing during a sustained attack', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  const laterClientNumbers = new Set();
  for (let timestamp = 0; timestamp <= 120000; timestamp += 100) {
    simulation.tick(timestamp);
    if (timestamp > 70000) {
      getState().visibleClients.forEach((client) => {
        laterClientNumbers.add(Number(client.label.replace('Client ', '')));
      });
    }
  }

  assert.ok([...laterClientNumbers].some((clientNumber) => clientNumber > 7));
});

test('replacement clients continue appearing in both non-attacker positions', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  let sawBothOuterSlots = false;

  for (let timestamp = 0; timestamp <= 90000; timestamp += 100) {
    simulation.tick(timestamp);
    if (timestamp < 70000) continue;
    const occupiedSlots = new Set(
      getState().visibleClients.map((client) => client.slotIndex),
    );
    if (occupiedSlots.has(0) && occupiedSlots.has(1) && occupiedSlots.has(2)) {
      sawBothOuterSlots = true;
      break;
    }
  }

  assert.equal(sawBothOuterSlots, true);
});

test('an empty client slot is reclaimed after one second', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  let failedClientId = null;
  let failedClientSlot = null;
  let slotBecameEmptyAt = null;
  let slotWasReclaimedAt = null;

  for (let timestamp = 0; timestamp <= 120000; timestamp += 100) {
    simulation.tick(timestamp);
    const visibleClients = getState().visibleClients;
    if (failedClientId === null) {
      const waitingClient = visibleClients.find(
        (client) => client.state === 'waiting-for-syn-ack',
      );
      if (waitingClient) {
        failedClientId = waitingClient.id;
        failedClientSlot = waitingClient.slotIndex;
      }
    }
    const failedClientStillVisible = visibleClients.some(
      (client) => client.id === failedClientId,
    );
    if (failedClientId && slotBecameEmptyAt === null && !failedClientStillVisible) {
      slotBecameEmptyAt = timestamp;
    }
    const replacementClient = visibleClients.find(
      (client) => client.slotIndex === failedClientSlot && client.id !== failedClientId,
    );
    if (
      slotBecameEmptyAt !== null
      && slotWasReclaimedAt === null
      && replacementClient
    ) {
      slotWasReclaimedAt = timestamp;
      break;
    }
  }

  assert.equal(slotWasReclaimedAt - slotBecameEmptyAt, 1000);
});

test('a rejected legitimate client waits for the configured duration before disappearing', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  let failedClientId = null;
  let clientStartedWaitingAt = null;
  let clientDisappearedAt = null;

  for (let timestamp = 0; timestamp <= 120000; timestamp += 100) {
    simulation.tick(timestamp);
    const visibleClients = getState().visibleClients;
    const waitingClient = visibleClients.find(
      (client) => client.state === 'waiting-for-syn-ack',
    );
    if (waitingClient && clientStartedWaitingAt === null) {
      failedClientId = waitingClient.id;
      clientStartedWaitingAt = timestamp;
      assert.equal(waitingClient.behavior, 'waiting');
      assert.ok(getState().failedLegitimateAttempts > 0);
    }
    if (
      clientStartedWaitingAt !== null
      && !visibleClients.some((client) => client.id === failedClientId)
    ) {
      clientDisappearedAt = timestamp;
      break;
    }
  }

  assert.equal(
    clientDisappearedAt - clientStartedWaitingAt,
    levelOneSimulation.failedClientWaitDuration,
  );
});

test('simulation speed changes the real-time waiting duration', () => {
  function measureWaitingDuration(speedMultiplier) {
    const { simulation, getState } = createSimulation({ speedMultiplier });
    simulation.play();
    let waitingClientId = null;
    let waitingStartedAt = null;

    for (let timestamp = 0; timestamp <= 300000; timestamp += 100) {
      simulation.tick(timestamp);
      const clients = getState().visibleClients;
      const waitingClient = clients.find((client) => client.behavior === 'waiting');
      if (!waitingClientId && waitingClient) {
        waitingClientId = waitingClient.id;
        waitingStartedAt = timestamp;
      }
      if (waitingClientId && !clients.some((client) => client.id === waitingClientId)) {
        return timestamp - waitingStartedAt;
      }
    }
    return null;
  }

  assert.equal(measureWaitingDuration(2), levelOneSimulation.failedClientWaitDuration / 2);
  assert.equal(measureWaitingDuration(0.5), levelOneSimulation.failedClientWaitDuration / 0.5);
});

test('pausing freezes a waiting client and restart clears waiting state', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  let timestamp = 0;
  let waitingClient;
  for (; timestamp <= 120000; timestamp += 100) {
    simulation.tick(timestamp);
    waitingClient = getState().visibleClients.find((client) => client.behavior === 'waiting');
    if (waitingClient) break;
  }

  assert.ok(waitingClient);
  simulation.pause();
  const pausedState = simulation.getState();
  simulation.tick(timestamp + levelOneSimulation.failedClientWaitDuration * 2);
  assert.deepEqual(simulation.getState(), pausedState);

  simulation.reset(false);
  assert.equal(simulation.getState().visibleClients.length, 0);
  assert.equal(
    simulation.getState().visibleClients.some((client) => client.behavior === 'waiting'),
    false,
  );
});

test('pause freezes state and restart returns to initial empty client slots', () => {
  const { simulation } = createSimulation();
  simulation.play();
  advance(simulation, 5000);
  simulation.pause();
  const pausedState = simulation.getState();
  simulation.tick(20000);
  assert.deepEqual(simulation.getState(), pausedState);

  simulation.reset(false);
  const resetState = simulation.getState();
  assert.equal(resetState.simulationPhase, 'normal-traffic');
  assert.equal(resetState.synPacketsReceived, 0);
  assert.equal(resetState.pendingHalfOpenConnections, 0);
  assert.equal(resetState.visibleClients.length, 0);
});

test('repeated Play and Pause calls do not create duplicate animation loops', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  let scheduledFrames = 0;
  global.requestAnimationFrame = () => {
    scheduledFrames += 1;
    return scheduledFrames;
  };

  const { simulation } = createSimulation();
  simulation.play();
  simulation.play();
  simulation.play();
  assert.equal(scheduledFrames, 1);
  simulation.pause();
  simulation.pause();
  simulation.play();
  simulation.play();
  assert.equal(scheduledFrames, 2);
  simulation.destroy();
  global.requestAnimationFrame = originalRequestAnimationFrame;
});

test('speed changes durations without resetting simulation state', () => {
  const { simulation } = createSimulation();
  simulation.play();
  advance(simulation, 2000);
  const synPacketsReceived = simulation.getState().synPacketsReceived;

  simulation.setSpeed(2);
  assert.equal(simulation.getTiming().packetDuration, levelOneSimulation.packetDuration / 2);
  assert.equal(simulation.getState().synPacketsReceived, synPacketsReceived);
  simulation.setSpeed(0.5);
  assert.equal(simulation.getTiming().packetDuration, levelOneSimulation.packetDuration * 2);
});

test('SYN cookies preserve attack traffic while legitimate clients recover', () => {
  const { simulation, packetHistory, getState } = createSimulation();
  simulation.play();
  advance(simulation, 80000);

  const beforeMitigation = getState();
  assert.ok(beforeMitigation.pendingHalfOpenConnections > 0);
  assert.equal(simulation.performAction('enable-syn-cookies'), true);
  const immediatelyAfter = getState();
  assert.equal(
    immediatelyAfter.pendingHalfOpenConnections,
    beforeMitigation.pendingHalfOpenConnections,
  );
  assert.equal(immediatelyAfter.synCookieProtectionActive, true);

  const mitigationPacketStart = packetHistory.length;
  for (let timestamp = 80100; timestamp <= 150000; timestamp += 100) {
    simulation.tick(timestamp);
    if (getState().recoveryComplete) break;
  }

  const recovered = getState();
  const mitigationPackets = packetHistory.slice(mitigationPacketStart);
  assert.equal(recovered.recoveryComplete, true);
  assert.equal(recovered.simulationPhase, 'network-recovered');
  assert.equal(recovered.pendingHalfOpenConnections, 0);
  assert.ok(recovered.recoveryCompletedHandshakes >= 2);
  assert.ok(recovered.recoveryAttackSynPackets >= 3);
  assert.ok(
    mitigationPackets.some((packet) => packet.type === 'SYN' && packet.isAttack),
  );
  assert.ok(
    mitigationPackets.some(
      (packet) => packet.type === 'SYN-ACK' && packet.usesSynCookie,
    ),
  );
  assert.ok(mitigationPackets.some((packet) => packet.type === 'ACK'));
});

test('increasing the backlog preserves entries and provides only temporary capacity', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 80000);
  const before = getState();
  const sentBefore = before.attackSynPacketsSent;

  assert.equal(simulation.performAction('increase-tcp-backlog'), true);
  const increased = getState();
  assert.equal(increased.activeMitigationId, 'increase-tcp-backlog');
  assert.equal(increased.backlogCapacity, 10);
  assert.equal(increased.pendingHalfOpenConnections, before.pendingHalfOpenConnections);
  assert.equal(increased.synCookieProtectionActive, false);

  for (let timestamp = 80100; timestamp <= 92000; timestamp += 100) simulation.tick(timestamp);
  const later = getState();
  assert.ok(later.attackSynPacketsSent > sentBefore);
  assert.ok(later.pendingHalfOpenConnections > before.pendingHalfOpenConnections);
  assert.ok(later.pendingHalfOpenConnections <= 10);
  assert.equal(later.recoveryComplete, false);
});

test('blocking TCP filters inbound packets without server processing or recovery', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 80000);
  assert.equal(simulation.performAction('block-all-tcp-traffic'), true);

  for (let timestamp = 80100; timestamp <= 87000; timestamp += 100) simulation.tick(timestamp);
  const settled = getState();
  const receivedAfterSettling = settled.synPacketsReceived;
  const sentAfterSettling = settled.synAckPacketsSent;
  for (let timestamp = 87100; timestamp <= 97000; timestamp += 100) simulation.tick(timestamp);
  const blocked = getState();

  assert.equal(blocked.activeMitigationId, 'block-all-tcp-traffic');
  assert.equal(blocked.tcpTrafficBlocked, true);
  assert.ok(blocked.droppedTCPPackets > 0);
  assert.equal(blocked.synPacketsReceived, receivedAfterSettling);
  assert.equal(blocked.synAckPacketsSent, sentAfterSettling);
  assert.equal(blocked.serverAvailable, false);
  assert.equal(blocked.recoveryComplete, false);
});

test('switching mitigations restores normal capacity and allows SYN cookies to recover', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 80000);
  simulation.performAction('increase-tcp-backlog');
  for (let timestamp = 80100; timestamp <= 90000; timestamp += 100) simulation.tick(timestamp);
  const expandedPending = getState().pendingHalfOpenConnections;
  assert.equal(getState().backlogCapacity, 10);

  assert.equal(simulation.performAction('enable-syn-cookies'), true);
  const switched = getState();
  assert.equal(switched.backlogCapacity, 5);
  assert.equal(switched.pendingHalfOpenConnections, expandedPending);
  assert.equal(switched.synCookieProtectionActive, true);
  assert.equal(switched.tcpTrafficBlocked, false);
});

test('SYN cookies cannot be enabled before the attack begins', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 30000);
  assert.equal(simulation.performAction('enable-syn-cookies'), false);
  assert.equal(getState().synCookieProtectionActive, false);
});

test('restart clears SYN cookie and recovery state', () => {
  const { simulation, getState } = createSimulation();
  simulation.play();
  advance(simulation, 80000);
  assert.equal(simulation.performAction('enable-syn-cookies'), true);
  assert.equal(getState().synCookieProtectionActive, true);

  simulation.reset(false);
  assert.equal(simulation.getState().synCookieProtectionActive, false);
  assert.equal(simulation.getState().recoveryComplete, false);
  assert.equal(simulation.getState().activeMitigationId, null);
  assert.equal(simulation.getState().tcpTrafficBlocked, false);
  assert.equal(simulation.getState().backlogCapacity, 5);
  assert.equal(simulation.getState().droppedTCPPackets, 0);
});
