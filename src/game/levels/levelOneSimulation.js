/**
 * Runs the Level 1 network simulation.
 * It owns clients, animated packets, a lightweight server backlog, timing, and recovery.
 */
export class LevelOneSimulation {
  // Sets up the simulation clock, network objects, and update callbacks.
  constructor({
    clients,
    server,
    configuration,
    onStateChange,
    onPacketsChange = () => {},
    speedMultiplier = 1,
    random = Math.random,
  }) {
    this.clientSlots = clients;
    this.server = server;
    this.configuration = configuration;
    this.onStateChange = onStateChange;
    this.onPacketsChange = onPacketsChange;
    this.random = random;
    this.baseLegDuration = configuration.packetDuration;
    this.baseWaitDuration = configuration.stepDelay;
    this.animationFrameId = null;
    this.tick = this.tick.bind(this);
    this.setSpeed(speedMultiplier);
    this.reset(false);
  }

  /** Restores the engine to its initial state and schedules the first client arrivals. */
  reset(shouldPlay = true) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.activeClients = new Map();
    this.activePackets = new Map();
    this.backlog = [];
    this.backlogCapacity = this.configuration.backlogCapacity;
    this.events = [];
    this.isPlaying = false;
    this.simulationPhase = 'normal-traffic';
    this.simulationTime = 0;
    this.lastTimestamp = null;
    this.sessionSequence = 0;
    this.nextClientNumber = 1;
    this.packetSequence = 0;
    this.compromisedSessionId = null;
    this.selectedAttackSlot = null;
    this.attackSynPacketsSent = 0;
    this.completedHandshakes = 0;
    this.failedLegitimateAttempts = 0;
    this.synCookieProtectionActive = false;
    this.activeMitigationId = null;
    this.tcpTrafficBlocked = false;
    this.droppedTCPPackets = 0;
    this.blockedIndicatorUntil = 0;
    this.recoveryComplete = false;
    this.attackContinuedAfterMitigation = false;
    this.protectedHandshakeCompleted = false;
    this.statusMessage = 'Simulation ready. Clients will appear as they begin connecting.';
    this.clientSlots.forEach((_, slotIndex) => {
      this.schedule(slotIndex * this.configuration.clientSpawnInterval, 'spawn-client', {
        slotIndex,
      });
    });
    this.render();
    if (shouldPlay) this.play();
  }

  // Starts or resumes the simulation clock and animation loop.
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = null;
    this.processDueEvents();
    this.render();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  // Stops the simulation clock without clearing its current state.
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.render();
  }

  // Stops the animation loop when the mission page is closed.
  destroy() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }


  setSpeed(speedMultiplier) {
    const validMultiplier = Number.isFinite(speedMultiplier) && speedMultiplier > 0
      ? speedMultiplier
      : 1;
    this.speedMultiplier = validMultiplier;
    this.legDuration = this.baseLegDuration / validMultiplier;
    this.waitDuration = this.baseWaitDuration / validMultiplier;
  }

  // Returns the current animation durations for settings and checks.
  getTiming() {
    return {
      packetDuration: this.legDuration,
      waitDuration: this.waitDuration,
    };
  }

  // Runs a named Level 1 mitigation without exposing protocol details to shared code.
  performAction(actionName) {
    return this.applyMitigation(actionName);
  }

  applyMitigation(mitigationId) {
    const validMitigations = new Set([
      'enable-syn-cookies',
      'increase-tcp-backlog',
      'block-all-tcp-traffic',
    ]);
    if (!validMitigations.has(mitigationId) || this.simulationPhase === 'normal-traffic') {
      return false;
    }

    this.activeMitigationId = mitigationId;
    this.synCookieProtectionActive = mitigationId === 'enable-syn-cookies';
    this.tcpTrafficBlocked = mitigationId === 'block-all-tcp-traffic';
    this.recoveryComplete = false;
    this.backlogCapacity = mitigationId === 'increase-tcp-backlog'
      ? this.configuration.increasedBacklogCapacity
      : this.configuration.backlogCapacity;

    if (this.synCookieProtectionActive) {
      this.attackContinuedAfterMitigation = false;
      this.protectedHandshakeCompleted = false;
      this.simulationPhase = 'mitigation-active';
      this.statusMessage = 'SYN cookie protection active. Continue watching or complete the mission.';
    } else if (this.tcpTrafficBlocked) {
      this.simulationPhase = 'mitigation-ineffective';
      this.statusMessage = 'Inbound TCP traffic is blocked, including legitimate connection attempts.';
    } else {
      this.simulationPhase = 'mitigation-ineffective';
      this.statusMessage = 'TCP backlog capacity increased; the SYN flood continues.';
    }
    this.render();
    return true;
  }

  /** Returns a serializable snapshot consumed by mission components. */
  getState() {
    const visibleClients = this.getVisibleClients();
    return {
      clientCount: this.activeClients.size,
      isPlaying: this.isPlaying,
      simulationPhase: this.simulationPhase,
      statusMessage: this.statusMessage,
      visibleClients,
      activeLegitimateConnections: visibleClients.filter(
        (client) => client.state === 'connected' && client.behavior === 'normal',
      ).length,
      activePackets: this.getPackets(),
      activePacketCount: this.activePackets.size,
      attackClientSlot: this.selectedAttackSlot,
      attackSynPacketsSent: this.attackSynPacketsSent,
      attackEvidenceObserved:
        this.attackSynPacketsSent >= this.configuration.repeatedSynEvidenceThreshold,
      synCookieProtectionActive: this.synCookieProtectionActive,
      activeMitigationId: this.activeMitigationId,
      tcpTrafficBlocked: this.tcpTrafficBlocked,
      droppedTCPPackets: this.droppedTCPPackets,
      blockedPacketIndicatorActive: this.simulationTime < this.blockedIndicatorUntil,
      serverAvailable: !this.tcpTrafficBlocked,
      recoveryComplete: this.recoveryComplete,
      pendingHalfOpenConnections: this.backlog.length,
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

  // Returns the current positions and details of all animated packets.
  getPackets() {
    return [...this.activePackets.values()].map((packet) => {
      const progress = Math.min(
        1,
        Math.max(0, (this.simulationTime - packet.startedAt) / packet.duration),
      );
      return {
        id: packet.id,
        type: packet.type,
        sessionId: packet.sessionId,
        isAttack: packet.isAttack === true,
        usesSynCookie: packet.usesSynCookie === true,
        willBeBlocked: this.tcpTrafficBlocked && packet.destination.id === this.server.id,
        slotIndex: packet.source.slotIndex ?? packet.destination.slotIndex,
        sourceId: packet.source.id,
        destinationId: packet.destination.id,
        sourceLabel: packet.sourceLabel,
        destinationLabel: packet.destinationLabel,
        visualLaneOffset: packet.visualLaneOffset,
        direction: packet.destination.id === this.server.id
          ? 'client-to-server'
          : 'server-to-client',
        progress,
        x: packet.source.x + (packet.destination.x - packet.source.x) * progress,
        y: packet.source.y + (packet.destination.y - packet.source.y) * progress,
      };
    });
  }

  // Sends the latest packet and simulation data to the page components.
  render() {
    this.onPacketsChange(this.getPackets());
    this.onStateChange(this.getState());
  }

  /**
   * Advances the simulation from requestAnimationFrame timestamps.
   * Pausing cancels this loop, which also freezes packet progress and connection timeouts.
   */
  tick(timestamp) {
    if (!this.isPlaying) return;
    const elapsed = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.simulationTime += elapsed * this.speedMultiplier;

    const expiredCount = this.expireBacklogEntries();
    if (expiredCount > 0) {
      this.statusMessage = `${expiredCount} half-open connection${expiredCount === 1 ? '' : 's'} timed out; backlog space released.`;
    }

    this.processDueEvents();
    this.maybeStartAttack();

    const arrivedPackets = [];
    this.activePackets.forEach((packet, packetId) => {
      if (this.simulationTime - packet.startedAt >= packet.duration) {
        arrivedPackets.push(packet);
        this.activePackets.delete(packetId);
      }
    });
    arrivedPackets.forEach((packet) => this.handlePacketArrival(packet));
    this.updateSimulationPhase();
    // Arrival handlers can schedule zero-delay follow-up work for the same frame.
    this.processDueEvents();
    this.render();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  /** Adds an event deadline expressed in simulation milliseconds. */
  schedule(delay, type, data = {}) {
    this.events.push({
      at: this.simulationTime + delay,
      type,
      ...data,
    });
    this.events.sort((first, second) => first.at - second.at);
  }

  // Runs every scheduled action whose simulation deadline has passed.
  processDueEvents() {
    while (this.events.length > 0 && this.events[0].at <= this.simulationTime) {
      this.handleEvent(this.events.shift());
    }
  }

  // Handles one scheduled simulation action when its deadline is reached.
  handleEvent(event) {
    const client = event.sessionId
      ? this.activeClients.get(event.sessionId)
      : null;

    if (event.type === 'spawn-client') {
      this.spawnClient(event.slotIndex);
    } else if (event.type === 'send-syn-ack') {
      if (client) {
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
    } else if (event.type === 'attack-syn') {
      this.beginAttackAttempt(client);
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
    this.activePackets.forEach((packet, packetId) => {
      if (packet.sessionId === sessionId) this.activePackets.delete(packetId);
    });
    this.events = this.events.filter((event) => event.sessionId !== sessionId);
    if (replace) {
      this.schedule(this.configuration.replacementDelay, 'spawn-client', {
        slotIndex: client.slotIndex,
      });
    }
  }

  // Starts a normal TCP handshake for a legitimate client.
  beginLegitimateHandshake(client) {
    client.state = 'connecting';
    this.spawnPacket('SYN', client, this.server, {
      sessionId: client.id,
      isAttack: false,
    });
  }

  // Adds a packet to the animation and records its basic details.
  spawnPacket(type, source, destination, metadata) {
    this.packetSequence += 1;
    const packet = {
      ...metadata,
      id: `packet-${this.packetSequence}`,
      type,
      source,
      destination,
      sourceLabel: source.label,
      destinationLabel: destination.label,
      visualLaneOffset: ((this.packetSequence - 1) % 3 - 1) * 4,
      startedAt: this.simulationTime,
      duration: this.configuration.packetDuration,
    };
    this.activePackets.set(packet.id, packet);

    if (type === 'SYN') {
      this.statusMessage = `${source.label} sends SYN.`;
    } else if (type === 'SYN-ACK') {
      this.statusMessage = 'Server sends SYN-ACK and waits for ACK.';
    } else if (type === 'ACK') {
      this.statusMessage = `${source.label} sends the final ACK.`;
    }
  }

  /** Applies protocol state changes only when an animated packet reaches its destination. */
  handlePacketArrival(packet) {
    const client = this.activeClients.get(packet.sessionId);

    if (this.tcpTrafficBlocked && packet.destination.id === this.server.id) {
      this.droppedTCPPackets += 1;
      this.blockedIndicatorUntil = this.simulationTime
        + this.configuration.blockedIndicatorDuration;
      this.statusMessage = `${packet.type} packet blocked before reaching the web server.`;
      if (client && !packet.isAttack) {
        client.state = 'waiting-for-syn-ack';
        this.schedule(this.configuration.failedClientWaitDuration, 'remove-client', {
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
        this.schedule(this.configuration.stepDelay, 'send-data-response', {
          sessionId: client.id,
        });
      } else if (
        packet.destination.id !== this.server.id
        && client.dataPacketsSent < this.configuration.dataPacketsPerConnection
      ) {
        this.schedule(this.configuration.stepDelay, 'send-data', {
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
      this.statusMessage = usesSynCookie
        ? 'Server sends a SYN cookie without allocating pending state.'
        : accepted
          ? 'SYN accepted into the pending backlog.'
          : 'Connection request dropped because the backlog is full.';
      if (accepted) {
        this.schedule(this.configuration.stepDelay, 'send-syn-ack', {
          sessionId: packet.sessionId,
          isAttack: packet.isAttack,
          usesSynCookie,
        });
      } else if (!packet.isAttack && client) {
        client.state = 'waiting-for-syn-ack';
        this.statusMessage = `${client.label} is waiting for a SYN-ACK that does not arrive.`;
        this.schedule(this.configuration.failedClientWaitDuration, 'remove-client', {
          sessionId: client.id,
          replace: true,
        });
      }
      this.updateSimulationPhase();
      return;
    }

    if (packet.type === 'SYN-ACK') {
      if (packet.isAttack) {
        // Attack attempts intentionally omit the final ACK.
        this.statusMessage = packet.usesSynCookie
          ? 'No final ACK arrives; no connection is established.'
          : 'No final ACK arrives; connection remains half-open.';
      } else if (client) {
        this.schedule(this.configuration.stepDelay, 'send-ack', {
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
      this.statusMessage = 'Final ACK rejected; no connection is established.';
      this.schedule(this.configuration.failedClientWaitDuration, 'remove-client', {
        sessionId: client.id,
        replace: true,
      });
      return;
    }
    this.completedHandshakes += 1;
    if (packet.usesSynCookie) this.protectedHandshakeCompleted = true;
    client.state = 'connected';
    client.connectedAt = this.simulationTime;
    this.statusMessage = `Handshake complete; ${client.label} begins exchanging data.`;
    this.schedule(0, 'send-data', { sessionId: client.id });
  }

  /** Converts one randomly selected occupied client slot into the attack source. */
  maybeStartAttack() {
    if (this.simulationPhase !== 'normal-traffic') return;
    if (this.simulationTime < this.configuration.attackStartDelay) return;

    if (this.selectedAttackSlot === null) {
      this.selectedAttackSlot = Math.floor(this.random() * this.clientSlots.length);
    }

    const changedClient = [...this.activeClients.values()].find(
      (client) => client.slotIndex === this.selectedAttackSlot,
    );
    if (!changedClient) return;

    changedClient.compromised = true;
    changedClient.state = 'connecting';
    this.compromisedSessionId = changedClient.id;
    this.simulationPhase = 'attack-begins';
    // Remove the client's legitimate work before starting repeated incomplete handshakes.
    this.events = this.events.filter((event) => event.sessionId !== changedClient.id);
    this.activePackets.forEach((packet, packetId) => {
      if (packet.sessionId === changedClient.id) this.activePackets.delete(packetId);
    });
    this.statusMessage = `${changedClient.label} begins sending repeated connection requests.`;
    this.schedule(0, 'attack-syn', { sessionId: changedClient.id });
  }

  // Sends one attack SYN and schedules the compromised client to send another.
  beginAttackAttempt(client) {
    if (!client?.compromised) return;
    this.attackSynPacketsSent += 1;
    this.spawnPacket('SYN', client, this.server, {
      sessionId: client.id,
      isAttack: true,
    });
    this.schedule(this.configuration.attackAttemptInterval, 'attack-syn', {
      sessionId: client.id,
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

  /**
   * Declares recovery complete after old backlog state drains, attack traffic
   * continues, and a legitimate client succeeds while SYN cookies are active.
   */
  updateRecoveryState() {
    if (!this.synCookieProtectionActive || this.recoveryComplete) return;
    if (
      this.backlog.length === 0
      && this.attackContinuedAfterMitigation
      && this.protectedHandshakeCompleted
    ) {
      this.recoveryComplete = true;
      this.simulationPhase = 'network-recovered';
      this.statusMessage = 'Network recovery complete.';
    } else {
      this.simulationPhase = 'network-recovery';
    }
  }
}
