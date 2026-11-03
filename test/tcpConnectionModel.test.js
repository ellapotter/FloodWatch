import test from 'node:test';
import assert from 'node:assert/strict';

import { TcpConnectionModel } from '../src/game/levels/levelOneSimulation.js';

function createModel() {
  return new TcpConnectionModel({
    backlogCapacity: 2,
    pendingConnectionTimeout: 100,
  });
}

test('a legitimate handshake enters and then leaves the pending backlog', () => {
  const model = createModel();
  const received = model.receiveSyn({
    connectionId: 'connection-1',
    originId: 'client-1',
    isAttacker: false,
    receivedAt: 0,
  });

  assert.equal(received.accepted, true);
  assert.equal(model.getState().pendingHalfOpenConnections, 1);
  assert.equal(model.sendSynAck('connection-1'), true);
  assert.equal(model.completeHandshake('connection-1'), true);
  assert.equal(model.getState().pendingHalfOpenConnections, 0);
  assert.equal(model.getState().completedHandshakes, 1);
});

test('the backlog rejects attempts beyond capacity and counts affected legitimate clients', () => {
  const model = createModel();
  model.receiveSyn({
    connectionId: 'attack-1',
    originId: 'attacker-1',
    isAttacker: true,
    receivedAt: 0,
  });
  model.receiveSyn({
    connectionId: 'attack-2',
    originId: 'attacker-1',
    isAttacker: true,
    receivedAt: 1,
  });
  const rejected = model.receiveSyn({
    connectionId: 'legitimate-1',
    originId: 'client-1',
    isAttacker: false,
    receivedAt: 2,
  });

  assert.deepEqual(rejected, { accepted: false, reason: 'backlog-full' });
  assert.equal(model.getState().pendingHalfOpenConnections, 2);
  assert.equal(model.getState().failedLegitimateAttempts, 1);
});

test('half-open connections expire and free backlog capacity', () => {
  const model = createModel();
  model.receiveSyn({
    connectionId: 'attack-1',
    originId: 'attacker-1',
    isAttacker: true,
    receivedAt: 0,
  });

  assert.equal(model.expirePendingConnections(99).length, 0);
  const expired = model.expirePendingConnections(100);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].timeoutStatus, 'timed-out');
  assert.equal(model.getState().pendingHalfOpenConnections, 0);
  assert.equal(model.getState().timedOutConnections, 1);
});

test('reset clears counters and pending connection state', () => {
  const model = createModel();
  model.receiveSyn({
    connectionId: 'connection-1',
    originId: 'client-1',
    isAttacker: false,
    receivedAt: 0,
  });
  model.reset();

  assert.deepEqual(model.getState(), {
    synPacketsReceived: 0,
    synAckPacketsSent: 0,
    completedHandshakes: 0,
    pendingHalfOpenConnections: 0,
    backlogCapacity: 2,
    failedLegitimateAttempts: 0,
    timedOutConnections: 0,
    pendingConnections: [],
  });
});

test('SYN cookies respond and complete legitimate handshakes without pending state', () => {
  const model = createModel();
  const received = model.receiveSyn({
    connectionId: 'cookie-connection',
    originId: 'client-1',
    isAttacker: false,
    receivedAt: 0,
    usesSynCookie: true,
  });

  assert.equal(received.accepted, true);
  assert.equal(received.stateAllocated, false);
  assert.equal(model.getState().pendingHalfOpenConnections, 0);
  assert.equal(
    model.sendSynAck('cookie-connection', { usesSynCookie: true }),
    true,
  );
  assert.equal(
    model.completeHandshake('cookie-connection', { usesSynCookie: true }),
    true,
  );
  assert.equal(model.getState().completedHandshakes, 1);
});
