/**
 * Shared traffic class for mission simulations.
 * Levels will need to implement their own packet generation, packet handling, and mitigation effects.
 * This class will handle scheduling, packet motion, attack-source selection, and playback.
 */
import { EventDrivenNetworkSimulation } from './gameEngine.js';

export class TrafficSimulation extends EventDrivenNetworkSimulation {
  constructor({
    clients,
    server,
    random = Math.random,
    ...options
  }) {
    super(options);
    this.clientSlots = clients;
    this.server = server;
    this.random = random;
    this.reset(false);
  }

  // Returns the packet type, levels will have to override this to return specific packet type
  getPacketIdPrefix() {
    return 'packet';
  }

  getTiming() {
    return {
      packetDuration: this.configuration.packetDuration / this.speedMultiplier,
    };
  }

  reset(shouldPlay = true) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.events = [];
    this.activePackets = new Map();
    this.isPlaying = false;
    this.simulationPhase = 'normal-traffic';
    this.simulationTime = 0;
    this.lastTimestamp = null;
    this.packetSequence = 0;
    this.activeMitigationId = null;
    this.recoveryComplete = false;
    this.attackClientSlot = null;
    this.pendingAttackClientOrdinal = null;
    this.clientsAppearedAfterAttackSelection = 0;
    this.serverShutdown = false;
    const attackDelayOptions = this.configuration.attackStartDelayOptions;
    this.attackStartsAt = Array.isArray(attackDelayOptions) && attackDelayOptions.length > 0
      ? attackDelayOptions[Math.floor(this.random() * attackDelayOptions.length)]
      : this.configuration.attackStartDelay;
    this.resetBehavior();
    this.render();
    if (shouldPlay) this.play();
  }

  // Used to reset any level specific state
  resetBehavior() {}

  // Runs one animation frame: events, one packet-arrival pass, then phase updates.
  tick(timestamp) {
    if (!this.isPlaying) return;
    const elapsed = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.simulationTime += elapsed * this.speedMultiplier;

    this.beforeEvents();
    this.processDueEvents();
    this.afterEvents();
    this.retireArrivedPackets();
    this.updateSimulationPhase();
    // Arrival handlers can schedule zero-delay follow-up work for the same frame.
    this.processDueEvents();
    this.render();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  beforeEvents() {
    this.maybeStartAttack();
  }

  afterEvents() {}

  handleEvent() {}

  handlePacketArrival() {}

  updateSimulationPhase() {}

  // Applies mitigation choice
  performAction(actionId) {
    const action = this.getMitigationActions()[actionId];
    if (typeof action !== 'function' || !this.canApplyMitigation(actionId)) return false;
    this.activeMitigationId = actionId;
    this.recoveryComplete = false;
    action();
    this.render();
    return true;
  }

  // Level specific mitigation behavior
  getMitigationActions() {
    return {};
  }

  // Reports whether the simulation is in correct stage to mitigate
  canApplyMitigation() {
    return false;
  }

  getClientInSlot(slotIndex) {
    return [...this.activeClients.values()].find(
      (client) => client.slotIndex === slotIndex,
    ) ?? null;
  }

  isClientSlotOccupied(slotIndex) {
    return this.getClientInSlot(slotIndex) !== null;
  }

  scheduleInitialClients() {
    this.clientSlots.forEach((_, slotIndex) => {
      this.schedule(this.configuration.clientStartInterval * slotIndex, 'spawn-client', {
        slotIndex,
      });
    });
  }

  scheduleReplacementClient(slotIndex) {
    this.schedule(this.configuration.replacementDelay, 'spawn-client', { slotIndex });
  }

  // Removes shared client traffic while leaving protocol-specific cleanup to a hook.
  removeClient(clientId, replace = true) {
    const client = this.activeClients.get(clientId);
    if (!client) return null;

    this.activeClients.delete(clientId);
    this.deletePackets(
      (packet) => packet.clientId === clientId || packet.sessionId === clientId,
    );
    this.cancelEvents(
      (event) => event.clientId === clientId || event.sessionId === clientId,
    );
    this.onClientRemoved(client);
    if (replace) this.scheduleReplacementClient(client.slotIndex);
    return client;
  }

  onClientRemoved() {}

  // Chooses client slot to be the attacker
  selectAttackSlot(optionCount = this.clientSlots.length) {
    if (this.attackClientSlot === null) {
      this.attackClientSlot = Math.floor(this.random() * optionCount);
    }
    return this.attackClientSlot;
  }

  // After normal traffic has run long enough, chooses which upcoming client becomes the attacker.
  maybeStartAttack() {
    if (this.attackClientSlot !== null) return;
    if (this.pendingAttackClientOrdinal !== null) return;
    if (this.simulationTime < this.attackStartsAt) return;
    this.pendingAttackClientOrdinal = Math.floor(this.random() * 3) + 1;
  }

  // Returns true when this empty-slot arrival is the randomly chosen upcoming attacker.
  shouldSpawnAttackClient(slotIndex) {
    if (this.attackClientSlot !== null || this.pendingAttackClientOrdinal === null) {
      return false;
    }
    this.clientsAppearedAfterAttackSelection += 1;
    if (this.clientsAppearedAfterAttackSelection < this.pendingAttackClientOrdinal) {
      return false;
    }
    this.attackClientSlot = slotIndex;
    this.pendingAttackClientOrdinal = null;
    this.spawnAttackClient(slotIndex);
    this.simulationPhase = 'attack-begins';
    return true;
  }

  // Registers a protocol-specific attacker and starts only its attack traffic.
  spawnAttackClient(slotIndex) {
    const client = this.createAttackClient(slotIndex);
    this.activeClients.set(client.id, client);
    this.onAttackClientSpawned(client);
    this.scheduleInitialAttack(client);
    return client;
  }

  // Runs one attempt in a sustained flood and schedules the next attempt.
  sendFloodAttack(clientId, packetType) {
    const client = this.activeClients.get(clientId);
    if (!client) return;
    // Every scheduled flood attempt is rendered so attacks appear as one continuous stream.
    this.sendFloodPacket(client, packetType, { animate: true });
    this.schedule(this.configuration.floodInterval, 'flood-attack', {
      clientId,
      packetType,
    });
  }

  handleFloodEvent(event) {
    if (event.type !== 'flood-attack') return false;
    this.sendFloodAttack(event.clientId, event.packetType);
    return true;
  }

  createAttackClient() {
    throw new TypeError('TrafficSimulation levels must implement createAttackClient().');
  }

  onAttackClientSpawned() {}

  scheduleInitialAttack(client) {
    this.schedule(0, 'flood-attack', {
      clientId: client.id,
      packetType: this.getFloodPacketType(),
    });
  }

  getFloodPacketType() {
    throw new TypeError('TrafficSimulation levels must implement getFloodPacketType().');
  }

  sendFloodPacket() {
    throw new TypeError('TrafficSimulation levels must implement sendFloodPacket().');
  }

  // Spawns a new packet
  spawnPacket(type, source, destination, metadata = {}) {
    this.packetSequence += 1;
    const packet = {
      ...metadata,
      id: `${this.getPacketIdPrefix()}-${this.packetSequence}`,
      type,
      source,
      destination,
      sourceLabel: source.label,
      destinationLabel: destination.label,
      slotIndex: source.slotIndex ?? destination.slotIndex,
      visualLaneOffset: ((this.packetSequence - 1) % 3 - 1) * 4,
      startedAt: this.simulationTime,
      duration: this.configuration.packetDuration,
      animate: metadata.animate !== false,
    };
    this.activePackets.set(packet.id, packet);
    this.onPacketSpawned(packet);
    return packet;
  }

  onPacketSpawned() {}

  deletePackets(predicate) {
    this.activePackets.forEach((packet, packetId) => {
      if (predicate(packet)) this.activePackets.delete(packetId);
    });
  }

  cancelEvents(predicate) {
    this.events = this.events.filter((event) => !predicate(event));
  }

  retireArrivedPackets() {
    const arrived = [];
    this.activePackets.forEach((packet, packetId) => {
      if (this.simulationTime - packet.startedAt >= packet.duration) {
        arrived.push(packet);
        this.activePackets.delete(packetId);
      }
    });
    arrived.forEach((packet) => this.handlePacketArrival(packet));
  }

  getPackets() {
    return [...this.activePackets.values()]
      .filter((packet) => packet.animate !== false)
      .map((packet) => this.createPacketSnapshot(packet));
  }

  createPacketSnapshot(packet) {
    const progress = Math.min(
      1,
      Math.max(0, (this.simulationTime - packet.startedAt) / packet.duration),
    );
    const toServer = packet.destination.id === this.server.id;
    return {
      id: packet.id,
      type: packet.type,
      isAttack: packet.isAttack === true,
      slotIndex: packet.slotIndex,
      sourceId: packet.source.id,
      destinationId: packet.destination.id,
      sourceLabel: packet.sourceLabel,
      destinationLabel: packet.destinationLabel,
      visualLaneOffset: packet.visualLaneOffset,
      direction: toServer ? 'client-to-server' : 'server-to-client',
      usesSynCookie: false,
      willBeBlocked: false,
      progress,
      x: packet.source.x + (packet.destination.x - packet.source.x) * progress,
      y: packet.source.y + (packet.destination.y - packet.source.y) * progress,
      ...this.packetSnapshotExtras(packet),
    };
  }

  packetSnapshotExtras() {
    return {};
  }
}
