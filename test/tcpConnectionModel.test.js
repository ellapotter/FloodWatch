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
  assert.equal(model.completeHandshake('connection-1', { originId: 'client-1' }), true);
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

test('backlog capacity changes preserve existing pending connections', () => {
  const model = createModel();
  model.receiveSyn({
    connectionId: 'attack-1', originId: 'attacker', isAttacker: true, receivedAt: 0,
  });
  model.receiveSyn({
    connectionId: 'attack-2', originId: 'attacker', isAttacker: true, receivedAt: 1,
  });

  assert.equal(model.setBacklogCapacity(4), true);
  assert.equal(model.getState().backlogCapacity, 4);
  assert.equal(model.getState().pendingHalfOpenConnections, 2);
  assert.equal(model.setBacklogCapacity(1), true);
  assert.equal(model.getState().pendingHalfOpenConnections, 2);
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
    model.completeHandshake('cookie-connection', {
      usesSynCookie: true,
      originId: 'client-1',
    }),
    true,
  );
  assert.equal(model.getState().completedHandshakes, 1);
});

test('an expired connection ACK cannot complete a handshake', () => {
  const model = createModel();
  model.receiveSyn({ connectionId: 'expired', originId: 'client-1', isAttacker: false, receivedAt: 0 });
  model.sendSynAck('expired');
  model.expirePendingConnections(100);

  assert.equal(model.completeHandshake('expired'), false);
  assert.equal(model.getState().completedHandshakes, 0);
});

test('a missing or out-of-order ACK cannot complete a handshake', () => {
  const model = createModel();
  assert.equal(model.completeHandshake('missing'), false);
  model.receiveSyn({ connectionId: 'out-of-order', originId: 'client-1', isAttacker: false, receivedAt: 0 });

  assert.equal(model.completeHandshake('out-of-order'), false);
  assert.equal(model.getState().completedHandshakes, 0);
});

test('a duplicate ACK cannot count a completed handshake twice', () => {
  const model = createModel();
  model.receiveSyn({ connectionId: 'connection-1', originId: 'client-1', isAttacker: false, receivedAt: 0 });
  model.sendSynAck('connection-1');

  assert.equal(model.completeHandshake('connection-1', { originId: 'client-1' }), true);
  assert.equal(model.completeHandshake('connection-1', { originId: 'client-1' }), false);
  assert.equal(model.getState().completedHandshakes, 1);
});

test('a rejected handshake cannot establish a connection', () => {
  const model = createModel();
  ['attack-1', 'attack-2'].forEach((connectionId, receivedAt) => {
    model.receiveSyn({ connectionId, originId: 'attacker', isAttacker: true, receivedAt });
  });
  const rejected = model.receiveSyn({
    connectionId: 'rejected', originId: 'client-1', isAttacker: false, receivedAt: 2,
  });

  assert.equal(rejected.accepted, false);
  assert.equal(model.sendSynAck('rejected'), false);
  assert.equal(model.completeHandshake('rejected'), false);
  assert.equal(model.getState().completedHandshakes, 0);
});

test('an invalid or expired SYN cookie ACK is rejected', () => {
  const model = createModel();
  assert.equal(model.completeHandshake('missing-cookie', { usesSynCookie: true }), false);
  model.receiveSyn({
    connectionId: 'expired-cookie', originId: 'client-1', isAttacker: false,
    receivedAt: 0, usesSynCookie: true,
  });
  model.sendSynAck('expired-cookie', { usesSynCookie: true });
  model.expirePendingConnections(100);

  assert.equal(model.completeHandshake('expired-cookie', { usesSynCookie: true }), false);
  assert.equal(model.getState().completedHandshakes, 0);
});

test('SYN cookie ACKs validate origin and cannot be duplicated', () => {
  const model = createModel();
  model.receiveSyn({
    connectionId: 'cookie', originId: 'client-1', isAttacker: false,
    receivedAt: 0, usesSynCookie: true,
  });
  model.sendSynAck('cookie', { usesSynCookie: true });

  assert.equal(model.completeHandshake('cookie', {
    usesSynCookie: true, originId: 'client-2',
  }), false);
  assert.equal(model.completeHandshake('cookie', {
    usesSynCookie: true, originId: 'client-1',
  }), true);
  assert.equal(model.completeHandshake('cookie', {
    usesSynCookie: true, originId: 'client-1',
  }), false);
  assert.equal(model.getState().completedHandshakes, 1);
});
