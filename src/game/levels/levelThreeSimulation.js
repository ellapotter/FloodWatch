import { TrafficSimulation } from '../trafficSimulation.js';

export class LevelThreeSimulation extends TrafficSimulation {
  getPacketIdPrefix() {
    return 'http-packet';
  }

  resetBehavior() {
    this.activeClients = new Map();
    this.processingRequests = new Map();
    this.requestQueue = [];
    this.requestSequence = 0;
    this.nextClientNumber = 1;
    this.incomingRequestHistory = [];
    this.responseTimeHistory = [];
    this.incomingHttpRequestsTotal = 0;
    this.completedHttpResponses = 0;
    this.failedHttpRequests = 0;
    this.droppedHttpRequests = 0;
    this.timedOutHttpRequests = 0;
    this.attackRequestsGenerated = 0;
    this.filteredAttackRequests = 0;
    this.filteredHttpRequests = 0;
    this.wafFilteredIndicatorUntil = 0;
    this.maximumQueueLength = 0;
    this.legitimateResponseAfterMitigation = false;
    this.overloadStartedAt = null;
    this.processingCapacity = this.configuration.maxConcurrentRequests;
    this.processingQueueCapacity = this.configuration.maxQueuedRequests;
    this.effectiveResponseTimeout = this.configuration.clientResponseTimeout;
    this.wafRateLimitingActive = false;
    this.scheduleInitialClients();
  }

  createClient(slotIndex, isAttackSource = false) {
    const slot = this.clientSlots[slotIndex];
    const clientNumber = this.nextClientNumber;
    this.nextClientNumber += 1;
    return {
      ...slot,
      id: `http-client-${clientNumber}`,
      label: `Client ${clientNumber}`,
      slotIndex,
      isAttackSource,
      awaitingRequestId: null,
      requestSentAt: null,
      disruptedUntil: 0,
      completedRequests: 0,
    };
  }

  spawnClient(slotIndex) {
    if (this.isClientSlotOccupied(slotIndex)) return;
    if (this.shouldSpawnAttackClient(slotIndex)) return;
    const client = this.createClient(slotIndex);
    this.activeClients.set(client.id, client);
    this.schedule(0, 'legitimate-http-request', { clientId: client.id });
  }

  removeClient(clientId, replace = true) {
    const client = this.activeClients.get(clientId);
    if (client?.isAttackSource) return null;
    return super.removeClient(clientId, replace);
  }

  createAttackClient(slotIndex) {
    return this.createClient(slotIndex, true);
  }

  getFloodPacketType() {
    return 'HTTP GET';
  }

  getVisibleClients() {
    return [...this.activeClients.values()].map((client) => {
      const waiting = client.awaitingRequestId !== null && this.simulationTime - client.requestSentAt >= this.configuration.waitingThreshold;
      return {
        id: client.id,
        label: client.label,
        slotIndex: client.slotIndex,
        state: 'communicating',
        protocol: 'http',
        behavior: client.isAttackSource && this.attackRequestsGenerated >= 2
          ? 'suspicious'
          : client.disruptedUntil > this.simulationTime
            ? 'disrupted'
            : waiting
              ? 'waiting'
              : 'normal',
      };
    });
  }

  chooseNormalPath() {
    const paths = this.configuration.normalRequestPaths;
    return paths[this.requestSequence % paths.length];
  }

  createRequest(client, path, isAttack, animate) {
    this.requestSequence += 1;
    return {
      id: `http-request-${this.requestSequence}`,
      clientId: client.id,
      path,
      isAttack,
      sentAt: this.simulationTime,
      animate,
    };
  }

  sendLegitimateRequest(client) {
    if (!client || client.isAttackSource || client.awaitingRequestId !== null) return;
    const request = this.createRequest(client, this.chooseNormalPath(), false, true);
    client.awaitingRequestId = request.id;
    client.requestSentAt = request.sentAt;
    this.spawnRequestPacket(client, request);
    this.scheduleRequestTimeout(client, request);
  }

  sendFloodPacket(client, packetType, { animate = true } = {}) {
    if (!client?.isAttackSource) return;
    this.attackRequestsGenerated += 1;
    const request = this.createRequest(
      client,
      this.configuration.attackRequestPath,
      true,
      animate,
    );
    this.spawnRequestPacket(client, request);
    // Like Level 2's bandwidth increase, extra capacity provides temporary
    // relief but the continuing flood scales up and eventually exhausts it.
    if (this.activeMitigationId === 'increase-processing-capacity') {
      this.attackRequestsGenerated += 1;
      const overflowRequest = this.createRequest(
        client,
        this.configuration.attackRequestPath,
        true,
        false,
      );
      this.spawnRequestPacket(client, overflowRequest);
    }
  }

  spawnRequestPacket(client, request) {
    const filtered = this.shouldFilterRequest(client);
    if (filtered) {
      this.filteredHttpRequests += 1;
      if (request.isAttack) this.filteredAttackRequests += 1;
      this.wafFilteredIndicatorUntil = this.simulationTime + 1200;
    }
    this.spawnPacket('HTTP GET', client, this.server, {
      clientId: client.id,
      request,
      requestId: request.id,
      path: request.path,
      isAttack: request.isAttack,
      animate: request.animate,
      filteredAtSource: filtered,
    });
  }

  shouldFilterRequest(client) {
    if (!this.wafRateLimitingActive) return false;
    return [...this.activePackets.values()].some(
      (packet) => packet.type === 'HTTP GET'
        && packet.clientId === client.id
        && !packet.filteredAtSource,
    );
  }

  scheduleRequestTimeout(client, request) {
    this.schedule(this.effectiveResponseTimeout, 'http-request-timeout', {
      clientId: client.id,
      requestId: request.id,
    });
  }

  rescheduleClientTimeouts() {
    this.cancelEvents((event) => event.type === 'http-request-timeout');
    this.activeClients.forEach((client) => {
      if (client.isAttackSource || client.awaitingRequestId === null) return;
      const elapsed = this.simulationTime - client.requestSentAt;
      this.schedule(Math.max(0, this.effectiveResponseTimeout - elapsed), 'http-request-timeout', {
        clientId: client.id,
        requestId: client.awaitingRequestId,
      });
    });
  }

  handleEvent(event) {
    if (this.handleFloodEvent(event)) return;
    if (event.type === 'spawn-client') {
      this.spawnClient(event.slotIndex);
      return;
    }

    if (event.type === 'finish-http-processing') {
      this.finishProcessing(event.requestId);
      return;
    }

    if (event.type === 'application-overload-check') {
      if (!this.serverShutdown && this.overloadStartedAt === event.overloadStartedAt && this.getProcessingQueueLength() >= this.processingQueueCapacity) {
        this.triggerApplicationShutdown();
      }
      return;
    }

    if (event.type === 'send-http-response') {
      this.sendResponse(event.request, event.statusCode);
      return;
    }

    const client = event.clientId ? this.activeClients.get(event.clientId) : null;
    if (!client) return;
    if (event.type === 'legitimate-http-request') {
      this.sendLegitimateRequest(client);
    } else if (event.type === 'http-request-timeout') {
      if (client.awaitingRequestId === event.requestId) {
        this.timedOutHttpRequests += 1;
        if (!this.serverShutdown) this.cancelRequest(event.requestId);
        this.disruptClient(client);
      }
    } else if (event.type === 'remove-client') {
      this.removeClient(client.id);
    }
  }

  handlePacketArrival(packet) {
    if (packet.type === 'HTTP GET') {
      if (packet.filteredAtSource) return;
      this.receiveRequest(packet.request);
      return;
    }

    if (packet.type === 'HTTP Response') this.receiveResponse(packet);
  }

  receiveRequest(request) {
    this.pruneStatistics();
    this.incomingHttpRequestsTotal += 1;
    this.incomingRequestHistory.push(this.simulationTime);
    if (this.serverShutdown) {
      this.failedHttpRequests += 1;
      this.droppedHttpRequests += 1;
    } else if (this.getProcessingQueueLength() >= this.processingQueueCapacity) {
      this.failedHttpRequests += 1;
      this.droppedHttpRequests += 1;
    } else if (this.processingRequests.size < this.processingCapacity) {
      this.startProcessing(request);
    } else if (this.requestQueue.length < this.processingQueueCapacity) {
      request.queuedAt = this.simulationTime;
      this.requestQueue.push(request);
    }
    this.maximumQueueLength = Math.max(
      this.maximumQueueLength,
      this.getProcessingQueueLength(),
    );
    this.updateOverloadTimer();
  }

  getProcessingQueueLength() {
    return this.processingRequests.size + this.requestQueue.length;
  }

  updateOverloadTimer() {
    if (this.serverShutdown) return;
    if (this.wafRateLimitingActive || this.getProcessingQueueLength() <= this.processingCapacity ) {
      this.overloadStartedAt = null;
      this.cancelEvents((event) => event.type === 'application-overload-check');
      return;
    }
    if (this.overloadStartedAt !== null) {
      if (this.getProcessingQueueLength() >= this.processingQueueCapacity && this.simulationTime - this.overloadStartedAt >= this.configuration.overloadShutdownDelay) {
        this.triggerApplicationShutdown();
      }
      return;
    }
    this.overloadStartedAt = this.simulationTime;
    this.schedule(this.configuration.overloadShutdownDelay, 'application-overload-check', {
      overloadStartedAt: this.overloadStartedAt,
    });
  }

  triggerApplicationShutdown() {
    if (this.serverShutdown) return;
    this.serverShutdown = true;
    this.simulationPhase = 'server-overloaded';
    this.cancelEvents(
      (event) => event.type === 'finish-http-processing'
        || event.type === 'send-http-response',
    );
  }

  startProcessing(request) {
    request.processingStartedAt = this.simulationTime;
    this.processingRequests.set(request.id, request);
    this.schedule(this.configuration.processingDuration, 'finish-http-processing', {
      requestId: request.id,
    });
  }

  finishProcessing(requestId) {
    if (this.serverShutdown) return;
    const request = this.processingRequests.get(requestId);
    if (!request) return;
    request.processingComplete = true;
    this.schedule(this.configuration.responseDelay, 'send-http-response', {
      request,
      statusCode: '200 OK',
    });
  }

  fillProcessingSlots() {
    if (this.serverShutdown) return;
    while (this.processingRequests.size < this.processingCapacity&& this.requestQueue.length > 0) {
      this.startProcessing(this.requestQueue.shift());
    }
  }

  sendResponse(request, statusCode) {
    if (this.serverShutdown) return;
    this.processingRequests.delete(request.id);
    const client = this.activeClients.get(request.clientId);
    if (client) {
      this.spawnPacket('HTTP Response', this.server, client, {
        clientId: client.id,
        requestId: request.id,
        path: request.path,
        statusCode,
        sentAt: request.sentAt,
        isAttack: request.isAttack,
        animate: request.animate,
      });
    }
    this.fillProcessingSlots();
    this.updateOverloadTimer();
  }

  receiveResponse(packet) {
    const client = this.activeClients.get(packet.clientId);
    if (packet.isAttack) {
      this.completedHttpResponses += 1;
      return;
    }
    if (!client || client.isAttackSource) return;
    if (client.awaitingRequestId !== packet.requestId) return;

    this.completedHttpResponses += 1;
    client.awaitingRequestId = null;
    client.requestSentAt = null;
    this.cancelEvents(
      (event) => event.type === 'http-request-timeout'
        && event.clientId === client.id
        && event.requestId === packet.requestId,
    );
    if (packet.statusCode !== '200 OK') {
      this.disruptClient(client);
      return;
    }

    const responseTime = this.simulationTime - packet.sentAt;
    this.responseTimeHistory.push({ at: this.simulationTime, duration: responseTime });
    if (this.wafRateLimitingActive) this.legitimateResponseAfterMitigation = true;
    client.completedRequests += 1;
    if (client.completedRequests >= this.configuration.requestsPerClient) {
      this.removeClient(client.id);
    } else {
      this.schedule(this.configuration.normalRequestInterval, 'legitimate-http-request', {
        clientId: client.id,
      });
    }
  }

  disruptClient(client) {
    if (!client || client.isAttackSource || client.disruptedUntil > this.simulationTime) return;
    client.awaitingRequestId = null;
    client.requestSentAt = null;
    client.disruptedUntil = this.simulationTime + this.configuration.disruptedClientDuration;
    this.schedule(this.configuration.disruptedClientDuration, 'remove-client', {
      clientId: client.id,
    });
  }

  cancelRequest(requestId) {
    this.requestQueue = this.requestQueue.filter((request) => request.id !== requestId);
    const removedFromProcessing = this.processingRequests.delete(requestId);
    this.cancelEvents(
      (event) => ['finish-http-processing', 'send-http-response'].includes(event.type)
        && (event.requestId === requestId || event.request?.id === requestId),
    );
    if (removedFromProcessing) this.fillProcessingSlots();
    this.updateOverloadTimer();
  }

  pruneStatistics() {
    const cutoff = this.simulationTime - this.configuration.statisticsWindow;
    this.incomingRequestHistory = this.incomingRequestHistory.filter((at) => at > cutoff);
    this.responseTimeHistory = this.responseTimeHistory.filter((item) => item.at > cutoff);
  }

  getMitigationActions() {
    const apply = (id) => () => this.applyMitigationEffects(id);
    return {
      'apply-http-rate-limiting': apply('apply-http-rate-limiting'),
      'increase-processing-capacity': apply('increase-processing-capacity'),
      'increase-http-timeout': apply('increase-http-timeout'),
    };
  }

  canApplyMitigation() {
    return this.attackClientSlot !== null;
  }

  applyMitigationEffects(mitigationId) {
    this.wafRateLimitingActive = mitigationId === 'apply-http-rate-limiting';
    this.processingCapacity = mitigationId === 'increase-processing-capacity'
      ? this.configuration.increasedConcurrentRequests
      : this.configuration.maxConcurrentRequests;
    this.processingQueueCapacity = mitigationId === 'increase-processing-capacity'
      ? this.configuration.increasedQueuedRequests
      : this.configuration.maxQueuedRequests;
    this.effectiveResponseTimeout = mitigationId === 'increase-http-timeout'
      ? this.configuration.increasedResponseTimeout
      : this.configuration.clientResponseTimeout;
    this.rescheduleClientTimeouts();
    if (this.wafRateLimitingActive) {
      this.restoreApplicationWithWaf();
    } else if (mitigationId === 'increase-processing-capacity') {
      this.restoreApplicationWithIncreasedCapacity();
    } else {
      this.fillProcessingSlots();
      this.updateOverloadTimer();
    }
    this.simulationPhase = this.wafRateLimitingActive
      ? 'network-recovery'
      : 'mitigation-ineffective';
  }

  restoreApplicationWithIncreasedCapacity() {
    const pendingRequests = [
      ...this.processingRequests.values(),
      ...this.requestQueue,
    ];
    this.serverShutdown = false;
    this.overloadStartedAt = null;
    this.cancelEvents(
      (event) => event.type === 'application-overload-check'
        || event.type === 'finish-http-processing'
        || event.type === 'send-http-response',
    );
    this.processingRequests.clear();
    this.requestQueue = pendingRequests.slice(0, this.processingQueueCapacity);
    this.fillProcessingSlots();
    this.updateOverloadTimer();
  }

  restoreApplicationWithWaf() {
    this.serverShutdown = false;
    this.recoveryComplete = false;
    this.legitimateResponseAfterMitigation = false;
    this.overloadStartedAt = null;
    this.cancelEvents(
      (event) => event.type === 'application-overload-check'
        || event.type === 'finish-http-processing'
        || event.type === 'send-http-response',
    );
    const legitimateRequests = [
      ...this.processingRequests.values(),
      ...this.requestQueue,
    ].filter(
      (request) => !request.isAttack && this.activeClients.has(request.clientId),
    );
    this.processingRequests.clear();
    this.requestQueue = legitimateRequests.slice(0, this.processingQueueCapacity);
    this.fillProcessingSlots();
    this.updateOverloadTimer();
  }

  packetSnapshotExtras(packet) {
    return {
      requestId: packet.requestId,
      path: packet.path,
      statusCode: packet.statusCode,
      willBeFiltered: packet.filteredAtSource === true,
    };
  }

  updateSimulationPhase() {
    if (this.wafRateLimitingActive) {
      this.recoveryComplete = this.legitimateResponseAfterMitigation && this.getProcessingQueueLength() <= this.configuration.maxConcurrentRequests;
      this.simulationPhase = this.recoveryComplete ? 'network-recovered' : 'network-recovery';
      return;
    }
    if (this.activeMitigationId) {
      this.simulationPhase = 'mitigation-ineffective';
      return;
    }
    if (this.serverShutdown) {
      this.simulationPhase = 'server-overloaded';
    } else if (this.requestQueue.length > 0) {
      this.simulationPhase = 'processing-pressure';
    }
  }

  getState() {
    this.pruneStatistics();
    const averageResponseTime = this.responseTimeHistory.length === 0
      ? null
      : this.responseTimeHistory.reduce((total, item) => total + item.duration, 0)
        / this.responseTimeHistory.length;
    const observedMilliseconds = Math.min(
      this.configuration.statisticsWindow,
      Math.max(this.simulationTime, 1),
    );
    const windowSeconds = observedMilliseconds / 1000;
    return {
      isPlaying: this.isPlaying,
      simulationPhase: this.simulationPhase,
      visibleClients: this.getVisibleClients(),
      activePackets: this.getPackets(),
      attackClientSlot: this.attackClientSlot,
      attackRequestsGenerated: this.attackRequestsGenerated,
      incomingHttpRequests: this.incomingRequestHistory.length,
      incomingHttpRequestsTotal: this.incomingHttpRequestsTotal,
      incomingHttpRequestsPerSecond: this.incomingRequestHistory.length / windowSeconds,
      averageResponseTime,
      serverProcessingQueue: this.getProcessingQueueLength(),
      activeProcessingRequests: this.processingRequests.size,
      processingCapacity: this.processingCapacity,
      processingQueueCapacity: this.processingQueueCapacity,
      maximumQueueLength: this.maximumQueueLength,
      completedHttpResponses: this.completedHttpResponses,
      failedHttpRequests: this.failedHttpRequests,
      droppedHttpRequests: this.droppedHttpRequests,
      timedOutHttpRequests: this.timedOutHttpRequests,
      filteredAttackRequests: this.filteredAttackRequests,
      filteredHttpRequests: this.filteredHttpRequests,
      wafFilteredIndicatorActive: this.simulationTime < this.wafFilteredIndicatorUntil,
      wafRateLimitingActive: this.wafRateLimitingActive,
      effectiveResponseTimeout: this.effectiveResponseTimeout,
      activeMitigationId: this.activeMitigationId,
      recoveryComplete: this.recoveryComplete,
      serverShutdown: this.serverShutdown,
    };
  }
}
