/**
 * Provides the lifecycle shared by every mission simulation.
 * Protocol behavior lives in a level-specific driver so missions can use
 * different traffic models, network states, and mitigation actions.
 */
import { createNetworkObserverPanel } from '../panels/networkObserverPanel.js';

// Default timing shared by each level
export const networkSimulationTiming = Object.freeze({
  packetDuration: 4000, // How long a packet takes to travel from source to destination
  responseDelay: 750, // How long the server waits before answering a request
  clientStartInterval: 4500, // Delay between each of the first clients appearing
  attackStartDelay: 60000, // How long before an attack starts
  initialAttackInterval: 1000, // Gap between attack packets once the attack starts
  clientDisruptionDuration: 12000, // How long a legitimate client waits for a response before leaving
});

//  Shared clock, event queue, rendering, and playback controls for level drivers.
export class EventDrivenNetworkSimulation {
  constructor({
    configuration,
    onStateChange,
    onPacketsChange = () => {},
    speedMultiplier = 1,
  }) {
    this.configuration = configuration;
    this.onStateChange = onStateChange;
    this.onPacketsChange = onPacketsChange;
    this.animationFrameId = null;
    this.tick = this.tick.bind(this);
    this.setSpeed(speedMultiplier);
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  render() {
    this.onPacketsChange(this.getPackets());
    this.onStateChange(this.getState());
  }

  schedule(delay, type, data = {}) {
    this.events.push({ at: this.simulationTime + delay, type, ...data });
    this.events.sort((first, second) => first.at - second.at);
  }

  processDueEvents() {
    while (this.events[0]?.at <= this.simulationTime) this.handleEvent(this.events.shift());
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = null;
    this.processDueEvents();
    this.render();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.render();
  }

  destroy() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}

export class NetworkSimulation {
  // Creates the level driver that supplies this mission's network behavior.
  constructor({ createDriver, ...driverOptions }) {
    if (typeof createDriver !== 'function') {
      throw new TypeError('NetworkSimulation requires a createDriver function.');
    }
    this.driver = createDriver(driverOptions);
  }

  // Starts or resumes the active mission simulation.
  play() {
    return this.driver.play();
  }

  // Pauses the active mission simulation without clearing its state.
  pause() {
    return this.driver.pause();
  }

  // Restarts the active mission simulation.
  reset(shouldPlay = true) {
    return this.driver.reset(shouldPlay);
  }

  // Stops the active simulation when its mission page is discarded.
  destroy() {
    return this.driver.destroy();
  }

  // Changes the active simulation's speed without restarting it.
  setSpeed(speedMultiplier) {
    return this.driver.setSpeed(speedMultiplier);
  }

  // Returns the current state supplied by the level driver.
  getState() {
    return this.driver.getState();
  }

  // Advances the driver from an animation timestamp.
  tick(timestamp) {
    return this.driver.tick(timestamp);
  }

  // Runs a named action implemented by the current level, such as a mitigation.
  performAction(actionName, ...args) {
    return this.driver.performAction?.(actionName, ...args) ?? false;
  }

  // Returns timing information exposed by the current level driver.
  getTiming() {
    return this.driver.getTiming?.() ?? {};
  }
}

export function createNetworkSimulation(Driver, configuration, options) {
  return new NetworkSimulation({
    ...options,
    createDriver(driverOptions) {
      return new Driver({ ...driverOptions, configuration });
    },
  });
}

// Lays out the basic 3 client and 1 server diagram shared by levels 1, 2 and 3
export function createClientServerDiagram(title) {
  return Object.freeze({
    heading: 'Network Observer',
    title,
    clients: [
      { id: 'client-1', label: 'Client 1', x: 110, y: 80 },
      { id: 'client-2', label: 'Client 2', x: 110, y: 210 },
      { id: 'client-3', label: 'Client 3', x: 110, y: 340 },
    ],
    server: { id: 'web-server', label: 'Web Server', x: 790, y: 210 },
  });
}


export function createInvestigationContext(definition, { objectId, dynamicFacts = [] }) {
  return {
    objectId,
    title: definition.title,
    details: definition.details,
    meaning: definition.meaning,
    learnMore: definition.learnMore,
    dynamicFacts,
    evidence: definition.evidence
      ? { ...definition.evidence, objectId, available: true }
      : null,
  };
}


export function getPacketFacts(packet) {
  return [
    ['Packet Type', packet.type],
    ['Source', packet.sourceLabel ?? packet.sourceId],
    ['Destination', packet.destinationLabel ?? packet.destinationId],
  ];
}

// Ensures clients or packets that are being investigated stay open even if they disappear from the simulation
export function resolveNetworkSelection(
  selection,
  state,
) {
  if (selection?.kind === 'client') {
    const client = state.visibleClients.find((item) => item.id === selection.client.id);
    return client ? { ...selection, client } : selection;
  }
  if (selection?.kind === 'packet') {
    const packet = state.activePackets.find((item) => item.id === selection.packet.id);
    return packet ? { ...selection, packet } : selection;
  }
  return selection;
}

export function getCorrectChoice(configuration) {
  return configuration.choices.find(
    (choice) => choice.id === configuration.correctChoiceId,
  );
}

// Marks suspicious clients and attack packets to be highlighted if hints are on
export function createAttackHints({ packetType, counterKey, threshold }) {
  return {
    shouldHintClient(client) {
      return client.behavior === 'suspicious';
    },
    shouldHintPacket(packet, state) {
      return packet.type === packetType
        && packet.isAttack === true
        && (state?.[counterKey] ?? 0) >= threshold;
    },
  };
}

// Builds the basic mission object shared by each level
export function defineNetworkMission({
  id,  // Unique mission ID
  instructions, // Instructions shown in the mission panel
  statistics, // Statistics shown in the network analytics
  report, // Report attack options and feedback
  mitigation, // Mitigation options and feedback
  diagramTitle, // Title shown in the network observer diagram
  createSimulation, // Function that creates the level for this mission
  getInvestigation, // Function that returns the investigation context for this mission
  hints, // Determines what objects are highlighted when hints are on
  getRecoveryState, // Function that returns the state used to determine whether the network has recovered
  statusIndicator, // Function that returns the status indicator for the network observer
  completion, // Completion information shown after the mission is finished
  clientStatusLabels, // Function that returns the status labels for clients in the network observer
  getServerState,
  blockOverlayLabel = null,
  attackPacketType = null,
}) {
  const diagram = createClientServerDiagram(diagramTitle);
  const correctReport = getCorrectChoice(report);
  const correctMitigation = getCorrectChoice(mitigation);
  const configuredMitigation = Object.freeze({
    ...mitigation,
    identifiedAttack: mitigation.identifiedAttack ?? {
      name: correctReport.name,
      description: correctReport.description,
    },
  });

  return Object.freeze({
    id,
    instructions,
    statistics,
    report,
    mitigation: configuredMitigation,
    getInvestigation,
    resolveSelection: resolveNetworkSelection,
    createRuntime({ onStateChange, ...options }) {
      return createNetworkMissionRuntime({
        options,
        onStateChange,
        diagram,
        createSimulation,
        getRecoveryState,
        statusIndicator,
        shouldHintClient: hints.shouldHintClient,
        shouldHintPacket: hints.shouldHintPacket,
        clientStatusLabels,
        getServerState,
        blockOverlayLabel,
        attackPacketType,
      });
    },
    completion: {
      attackName: correctReport.name,
      defenseName: completion.defenseName ?? correctMitigation.name,
      attackSummary: correctReport.feedback,
      defenseSummary: correctMitigation.feedback,
      nextMissionId: completion.nextMissionId,
      continueLabel: completion.continueLabel,
    },
  });
}


export function createNetworkMissionRuntime({
  options,
  onStateChange,
  diagram,
  createSimulation,
  getRecoveryState,
  statusIndicator,
  shouldHintClient,
  shouldHintPacket,
  clientStatusLabels,
  getServerState,
  blockOverlayLabel = null,
  attackPacketType = null,
}) {
  const observer = createNetworkObserverPanel({
    ...options,
    diagram,
    onStateChange(state) {
      onStateChange(state, getRecoveryState(state));
    },
    createSimulation,
    statusIndicator,
    shouldHintClient,
    shouldHintPacket,
    clientStatusLabels,
    getServerState,
    blockOverlayLabel,
    attackPacketType,
  });

  return {
    element: observer.element,
    play: () => observer.simulation.play(),
    pause: () => observer.simulation.pause(),
    destroy: () => observer.simulation.destroy(),
    getState: () => observer.simulation.getState(),
    setSpeed: (multiplier) => observer.simulation.setSpeed(multiplier),
    setHints: observer.setHints,
    selectObject: observer.selectObject,
    clearSelection: observer.clearSelection,
    applyMitigation: (choiceId) => observer.simulation.performAction(choiceId),
  };
}

// Shared choice-state behavior for attack reporting and mitigation selection
function createChoiceState(configuration) {
  let selectedChoiceId = null;
  let feedback = null;
  let succeeded = false;

  // Stores a valid choice unless the correct answer has already been submitted.
  function select(choiceId) {
    if (succeeded || !configuration.choices.some((choice) => choice.id === choiceId)) {
      return false;
    }
    selectedChoiceId = choiceId;
    return true;
  }

  // Checks the selected answer and creates the feedback returned to the panel.
  function resolveChoice() {
    if (!selectedChoiceId || succeeded) return null;

    const choice = configuration.choices.find((item) => item.id === selectedChoiceId);
    succeeded = selectedChoiceId === configuration.correctChoiceId;
    feedback = {
      choiceId: selectedChoiceId,
      isCorrect: succeeded,
      message: choice.feedback,
    };
    return { ...feedback };
  }

  // Returns the current choice, feedback, and success state.
  function getState() {
    return { selectedChoiceId, feedback, succeeded };
  }

  // Clears the selected answer and feedback.
  function reset() {
    selectedChoiceId = null;
    feedback = null;
    succeeded = false;
  }

  return { select, resolveChoice, getState, reset };
}

export function createReportState(configuration) {
  const state = createChoiceState(configuration);
  return {
    select: state.select,
    submit: state.resolveChoice,
    // Returns report state using the name expected by the report panel.
    getState() {
      const { selectedChoiceId, feedback, succeeded } = state.getState();
      return { selectedChoiceId, feedback, isCorrect: succeeded };
    },
    reset: state.reset,
  };
}

export function createMitigationState(configuration) {
  const state = createChoiceState(configuration);
  return {
    select: state.select,
    apply: state.resolveChoice,
    // Returns mitigation state using the name expected by the mitigation panel.
    getState() {
      const { selectedChoiceId, feedback, succeeded } = state.getState();
      return { selectedChoiceId, feedback, isSuccessful: succeeded };
    },
    reset: state.reset,
  };
}

// Checks whether the player has collected attack evidence needed to open the report panel.
export function canOpenReport(configuration, collectedEvidence) {
  const minimumEvidenceCount = configuration.minimumEvidenceCount ?? 0;
  if (collectedEvidence.length < minimumEvidenceCount) return false;

  const collectedIds = new Set(collectedEvidence.map((evidence) => evidence.id));
  const requiredEvidenceCollected = configuration.requiredEvidenceIds.every(
    (evidenceId) => collectedIds.has(evidenceId),
  );
  if (!requiredEvidenceCollected) return false;

  const qualifyingEvidenceIds = configuration.qualifyingEvidenceIds ?? [];
  return qualifyingEvidenceIds.length === 0
    || qualifyingEvidenceIds.some((evidenceId) => collectedIds.has(evidenceId));
}

// Different stages the player can be in during simulation
const validStages = new Set([
  'observing', // The player is watching the network simulation without interacting
  'investigating', // The player is investigating network object
  'mitigating', // The player is applying a mitigation to the network
  'network-recovery', // The player is waiting for the network to recover after a mitigation
  'completed', // The player has completed the mission and is waiting for the next mission
]);

// Creates a small state controller for the stages shared by every mission.
export function createMissionState(initialStage = 'observing') {
  let stage = initialStage;

  return {
    // Returns the mission's current gameplay stage.
    getStage() {
      return stage;
    },

    // Changes the gameplay stage after checking that the name is supported.
    setStage(nextStage) {
      if (!validStages.has(nextStage)) {
        throw new Error(`Unknown mission stage: ${nextStage}`);
      }
      stage = nextStage;
    },

    // Returns the mission to its original gameplay stage.
    reset() {
      stage = initialStage;
    },
  };
}

// Create the memory store used to track which evidence has been collected
export function createEvidenceStore(missionId) {
  const collectedEvidence = new Map();

  return {
    // Adds valid evidence once and rejects evidence from another mission.
    collect(evidence) {
      if (evidence.missionId !== missionId || collectedEvidence.has(evidence.id)) {
        return false;
      }

      collectedEvidence.set(evidence.id, { ...evidence, collected: true });
      return true;
    },

    // Checks whether an evidence item has already been collected.
    has(evidenceId) {
      return collectedEvidence.has(evidenceId);
    },

    // Returns every collected evidence item in collection order.
    getAll() {
      return [...collectedEvidence.values()];
    },

    // Removes all evidence when the mission restarts.
    clear() {
      collectedEvidence.clear();
    },
  };
}
