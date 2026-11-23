import { TrafficSimulation } from '../trafficSimulation.js';

/**
 * Runs the Level 1 TCP handshake, backlog, and SYN flood behavior.
 * Shared timing, packet motion, and mitigationlogic are in TrafficSimulation.
 */
export class LevelOneSimulation extends TrafficSimulation {
  // Restores TCP clients, the backlog, and the first connection attempts.
  resetBehavior() {
    this.activeClients = new Map();
    this.backlog = [];
    this.backlogCapacity = this.configuration.backlogCapacity;
    this.sessionSequence = 0;
    this.nextClientNumber = 1;
    this.compromisedSessionId = null;
    this.attackSynPacketsSent = 0;
    this.completedHandshakes = 0;
    this.failedLegitimateAttempts = 0;
    this.synCookieProtectionActive = false;
    this.tcpTrafficBlocked = false;
    this.droppedTCPPackets = 0;
    this.blockedIndicatorUntil = 0;
    this.attackContinuedAfterMitigation = false;
    this.protectedHandshakeCompleted = false;
    this.clientSlots.forEach((_, slotIndex) => {
      this.schedule(slotIndex * this.configuration.clientStartInterval, 'spawn-client', {
        slotIndex,
      });
    });
  }

  getTiming() {
    return {
      ...super.getTiming(),
      waitDuration: this.configuration.responseDelay / this.speedMultiplier,
    };
  }

  getMitigationActions() {
    return {
      'enable-syn-cookies': () => this.applyMitigationEffects('enable-syn-cookies'),
      'increase-tcp-backlog': () => this.applyMitigationEffects('increase-tcp-backlog'),
      'block-all-tcp-traffic': () => this.applyMitigationEffects('block-all-tcp-traffic'),
    };
  }

  canApplyMitigation() {
    return this.simulationPhase !== 'normal-traffic';
  }

  // Applies one Level 1 defense and records whether it stops the incomplete handshakes.
  applyMitigationEffects(mitigationId) {
    this.synCookieProtectionActive = mitigationId === 'enable-syn-cookies';
    this.tcpTrafficBlocked = mitigationId === 'block-all-tcp-traffic';
    this.backlogCapacity = mitigationId === 'increase-tcp-backlog'
      ? this.configuration.increasedBacklogCapacity
      : this.configuration.backlogCapacity;

    if (this.synCookieProtectionActive) {
      this.serverShutdown = false;
      this.attackContinuedAfterMitigation = false;
      this.protectedHandshakeCompleted = false;
      this.simulationPhase = 'mitigation-active';
    } else if (this.tcpTrafficBlocked) {
      this.simulationPhase = 'mitigation-ineffective';
    } else {
      if (mitigationId === 'increase-tcp-backlog') this.serverShutdown = false;
      this.simulationPhase = 'mitigation-ineffective';
    }
  }

  getState() {
    const visibleClients = this.getVisibleClients();
    const displayedPendingHalfOpenConnections = this.serverShutdown
      ? this.backlogCapacity
      : this.backlog.length;
    return {
      isPlaying: this.isPlaying,
      simulationPhase: this.simulationPhase,
      visibleClients,
      activeLegitimateConnections: visibleClients.filter(
        (client) => client.state === 'connected' && client.behavior === 'normal',
      ).length,
      activePackets: this.getPackets(),
      attackClientSlot: this.attackClientSlot,
      attackSynPacketsSent: this.attackSynPacketsSent,
      attackEvidenceObserved:
        this.attackSynPacketsSent >= this.configuration.repeatedSynEvidenceThreshold,
      synCookieProtectionActive: this.synCookieProtectionActive,
      activeMitigationId: this.activeMitigationId,
      tcpTrafficBlocked: this.tcpTrafficBlocked,
      droppedTCPPackets: this.droppedTCPPackets,
      blockedPacketIndicatorActive: this.simulationTime < this.blockedIndicatorUntil,
      serverAvailable: !this.tcpTrafficBlocked && !this.serverShutdown,
      serverShutdown: this.serverShutdown,
      recoveryComplete: this.recoveryComplete,
      pendingHalfOpenConnections: this.backlog.length,
      displayedPendingHalfOpenConnections,
      backlogCapacity: this.backlogCapacity,
      completedHandshakes: this.completedHandshakes,
      failedLegitimateAttempts: this.failedLegitimateAttempts,
    };
  }

  // Returns the clients that should currently appear in the network diagram.
  getVisibleClients() {
    const repeatedSynTrafficStarted = this.attackSynPacketsSent >= 2;
    return [...this.activeClients.values()].map((client) => ({
      id: client.id,
      label: client.label,
      slotIndex: client.slotIndex,
      state: client.state,
      behavior: client.compromised && repeatedSynTrafficStarted
        ? 'suspicious'
        : client.state === 'waiting-for-syn-ack'
          ? 'waiting'
          : 'normal',
    }));
  }

  packetSnapshotExtras(packet) {
    return {
      sessionId: packet.sessionId,
      usesSynCookie: packet.usesSynCookie === true,
      willBeBlocked: this.tcpTrafficBlocked && packet.destination.id === this.server.id,
    };
  }

  beforeEvents() {
    this.expireBacklogEntries();
    super.beforeEvents();
  }

  // Handles one scheduled simulation action when its deadline is reached.
  handleEvent(event) {
    if (this.handleFloodEvent(event)) return;
    const client = event.sessionId
      ? this.activeClients.get(event.sessionId)
      : null;

    if (event.type === 'spawn-client') {
      this.spawnClient(event.slotIndex);
    } else if (event.type === 'send-syn-ack') {
      if (client && !this.serverShutdown) {
        this.spawnPacket('SYN-ACK', this.server, client, event);
      }
    } else if (event.type === 'send-ack') {
      if (client) this.spawnPacket('ACK', client, this.server, event);
    } else if (event.type === 'send-data') {
      if (
        client?.state === 'connected'
        && !client.compromised
        && client.dataPacketsSent < this.configuration.dataPacketsPerConnection
      ) {
        client.dataPacketsSent += 1;
        this.spawnPacket('DATA', client, this.server, { sessionId: client.id });
      }
    } else if (event.type === 'send-data-response') {
      if (
        client?.state === 'connected'
        && !client.compromised
        && client.dataPacketsSent < this.configuration.dataPacketsPerConnection
      ) {
        client.dataPacketsSent += 1;
        this.spawnPacket('DATA', this.server, client, { sessionId: client.id });
      }
    } else if (event.type === 'end-session') {
      if (client && !client.compromised) this.removeClient(client.id);
    } else if (event.type === 'remove-client') {
      if (client) this.removeClient(client.id, event.replace !== false);
    }
  }

  // Reserves the next number used in a client's visible label.
  allocateClientNumber() {
    const clientNumber = this.nextClientNumber;
    this.nextClientNumber += 1;
    return clientNumber;
  }

  // Places a new client in an empty diagram slot and starts its connection.
  spawnClient(slotIndex) {
    if ([...this.activeClients.values()].some((client) => client.slotIndex === slotIndex)) {
      return;
    }

    const slot = this.clientSlots[slotIndex];
    this.sessionSequence += 1;
    const clientNumber = this.allocateClientNumber();
    const client = {
      id: `client-session-${this.sessionSequence}`,
      clientNumber,
      label: `Client ${clientNumber}`,
      slotIndex,
      x: slot.x,
      y: slot.y,
      state: 'connecting',
      compromised: false,
      dataPacketsSent: 0,
    };
    this.activeClients.set(client.id, client);
    this.beginLegitimateHandshake(client);
  }

  // Removes a client and optionally schedules a replacement for its slot.
  removeClient(sessionId, replace = true) {
    const client = this.activeClients.get(sessionId);
    if (!client) return;
    this.activeClients.delete(sessionId);
    this.backlog = this.backlog.filter((entry) => entry.clientId !== sessionId);
    this.deletePackets((packet) => packet.sessionId === sessionId);
    this.cancelEvents((event) => event.sessionId === sessionId);
    if (replace) {
      this.schedule(this.configuration.replacementDelay, 'spawn-client', {
        slotIndex: client.slotIndex,
      });
    }
  }

  // Creates the TCP-specific state for a new attack-only client.
  createAttackClient(slotIndex) {
    const slot = this.clientSlots[slotIndex];
    this.sessionSequence += 1;
    const clientNumber = this.allocateClientNumber();
    const client = {
      id: `client-session-${this.sessionSequence}`,
      clientNumber,
      label: `Client ${clientNumber}`,
      slotIndex,
      x: slot.x,
      y: slot.y,
      state: 'connecting',
      compromised: true,
      dataPacketsSent: 0,
    };
    return client;
  }

  onAttackClientSpawned(client) {
    this.compromisedSessionId = client.id;
  }

  getFloodPacketType() {
    return 'SYN';
  }

  // Starts a normal TCP handshake for a legitimate client.
  beginLegitimateHandshake(client) {
    client.state = 'connecting';
    this.spawnPacket('SYN', client, this.server, {
      sessionId: client.id,
      isAttack: false,
    });
  }

  // Applies state changes only when an animated packet reaches its destination.
  handlePacketArrival(packet) {
    const client = this.activeClients.get(packet.sessionId);

    if (this.tcpTrafficBlocked && packet.destination.id === this.server.id) {
      this.droppedTCPPackets += 1;
      this.blockedIndicatorUntil = this.simulationTime
        + this.configuration.blockedIndicatorDuration;
      if (client && !packet.isAttack) {
        client.state = 'waiting-for-syn-ack';
        this.schedule(this.configuration.clientDisruptionDuration, 'remove-client', {
          sessionId: client.id,
          replace: true,
        });
      }
      return;
    }

    if (packet.type === 'DATA') {
      if (!client || client.state !== 'connected' || client.compromised) return;
      if (
        packet.destination.id === this.server.id
        && client.dataPacketsSent < this.configuration.dataPacketsPerConnection
      ) {
        this.schedule(this.configuration.responseDelay, 'send-data-response', {
          sessionId: client.id,
        });
      } else if (
        packet.destination.id !== this.server.id
        && client.dataPacketsSent < this.configuration.dataPacketsPerConnection
      ) {
        this.schedule(this.configuration.responseDelay, 'send-data', {
          sessionId: client.id,
        });
      } else if (client.dataPacketsSent >= this.configuration.dataPacketsPerConnection) {
        this.schedule(0, 'end-session', { sessionId: client.id });
      }
      return;
    }

    if (packet.type === 'SYN') {
      const usesSynCookie = this.synCookieProtectionActive;
      const accepted = usesSynCookie
        || this.addBacklogEntry(packet.sessionId, packet.isAttack);
      if (usesSynCookie && packet.isAttack) this.attackContinuedAfterMitigation = true;
      if (accepted && !this.serverShutdown) {
        this.schedule(this.configuration.responseDelay, 'send-syn-ack', {
          sessionId: packet.sessionId,
          isAttack: packet.isAttack,
          usesSynCookie,
        });
      } else if (!packet.isAttack && client) {
        client.state = 'waiting-for-syn-ack';
        this.schedule(this.configuration.clientDisruptionDuration, 'remove-client', {
          sessionId: client.id,
          replace: true,
        });
      }
      this.updateSimulationPhase();
      return;
    }

    if (packet.type === 'SYN-ACK') {
      // Attack attempts intentionally omit the final ACK.
      if (!packet.isAttack && client) {
        this.schedule(this.configuration.responseDelay, 'send-ack', {
          sessionId: client.id,
          usesSynCookie: packet.usesSynCookie,
        });
      }
      return;
    }

    if (!client) return;
    const handshakeCompleted = packet.usesSynCookie
      ? !client.compromised
      : this.removeBacklogEntry(client.id);
    if (!handshakeCompleted) {
      client.state = 'waiting-for-syn-ack';
      this.schedule(this.configuration.clientDisruptionDuration, 'remove-client', {
        sessionId: client.id,
        replace: true,
      });
      return;
    }
    this.completedHandshakes += 1;
    if (packet.usesSynCookie) this.protectedHandshakeCompleted = true;
    client.state = 'connected';
    client.connectedAt = this.simulationTime;
    this.schedule(0, 'send-data', { sessionId: client.id });
  }

  sendFloodPacket(client, packetType, { animate }) {
    if (!client?.compromised) return;
    this.attackSynPacketsSent += 1;
    this.spawnPacket(packetType, client, this.server, {
      sessionId: client.id,
      isAttack: true,
      animate,
    });
  }

  // Reserves one backlog slot. Repeated attacker SYNs intentionally create separate entries.
  addBacklogEntry(clientId, isAttack) {
    if (this.backlog.length >= this.backlogCapacity) {
      if (!isAttack) this.failedLegitimateAttempts += 1;
      return false;
    }
    this.backlog.push({
      clientId,
      isAttack,
      expiresAt: this.simulationTime + this.configuration.pendingConnectionTimeout,
    });
    if (this.backlog.length >= this.backlogCapacity) this.serverShutdown = true;
    return true;
  }

  // Releases the legitimate client's backlog slot after its final ACK arrives.
  removeBacklogEntry(clientId) {
    const index = this.backlog.findIndex(
      (entry) => entry.clientId === clientId && !entry.isAttack,
    );
    if (index < 0) return false;
    this.backlog.splice(index, 1);
    return true;
  }

  // Drops expired half-open entries and reports how many slots were released.
  expireBacklogEntries() {
    const previousLength = this.backlog.length;
    this.backlog = this.backlog.filter((entry) => entry.expiresAt > this.simulationTime);
    return previousLength - this.backlog.length;
  }

  // Updates the mission phase when backlog pressure or failures are observed.
  updateSimulationPhase() {
    if (this.synCookieProtectionActive) {
      this.updateRecoveryState();
      return;
    }
    if (this.simulationPhase === 'normal-traffic') return;
    if (this.activeMitigationId && !this.synCookieProtectionActive) {
      this.simulationPhase = 'mitigation-ineffective';
      return;
    }
    if (
      this.backlog.length >= this.backlogCapacity
      || this.failedLegitimateAttempts > 0
    ) {
      this.simulationPhase = 'attack-established';
    } else if (
      this.backlog.length
      >= Math.ceil(this.backlogCapacity * this.configuration.pressureThreshold)
    ) {
      this.simulationPhase = 'backlog-pressure';
    }
  }
  
  updateRecoveryState() {
    if (!this.synCookieProtectionActive || this.recoveryComplete) return;
    if (
      this.backlog.length === 0
      && this.attackContinuedAfterMitigation
      && this.protectedHandshakeCompleted
    ) {
      this.recoveryComplete = true;
      this.simulationPhase = 'network-recovered';
    } else {
      this.simulationPhase = 'network-recovery';
    }
  }
}
