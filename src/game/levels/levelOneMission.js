/**
 * Connects the shared mission page to Level 1's SYN flood implementation.
 * Protocol-specific behavior stays here so the page coordinator does not need
 * to know about TCP backlogs, SYN cookies, or Level 1 evidence rules.
 */
import { createNetworkObserverPanel } from '../../panels/networkObserverPanel.js';
import { createBacklogPanel } from '../../panels/backlogPanel.js';
import { NetworkSimulation } from '../gameEngine.js';
import { LevelOneSimulation } from './levelOneSimulation.js';
import {
  levelOneInvestigationContent as content,
  levelOneMitigations,
  levelOneReport,
} from './levelOneContent.js';

export const levelOneSimulation = Object.freeze({
  backlogCapacity: 5,
  pendingConnectionTimeout: 36000,
  packetDuration: 3000,
  stepDelay: 750,
  clientSpawnInterval: 4500,
  dataPacketsPerConnection: 4,
  failedClientWaitDuration: 3000,
  replacementDelay: 1000,
  attackAttemptInterval: 1000,
  attackStartDelay: 60000,
  repeatedSynEvidenceThreshold: 3,
  pressureThreshold: 0.6,
  recoveryAttackSynThreshold: 3,
  recoveryHandshakeThreshold: 2,
});

// Creates the shared controller with Level 1's TCP simulation driver.
export function createLevelOneNetworkSimulation(options) {
  return new NetworkSimulation({
    ...options,
    // Supplies TCP-specific behavior only when Level 1 is created.
    createDriver(driverOptions) {
      return new LevelOneSimulation({
        ...driverOptions,
        configuration: levelOneSimulation,
      });
    },
  });
}

const levelOneDiagram = Object.freeze({
  heading: 'Network Observer',
  title: 'Client and web server network',
  description:
    'Three clients exchange labeled TCP packets with a web server. One client\'s behavior changes later in the simulation.',
  clients: [
    { id: 'client-1', label: 'Client 1', x: 110, y: 80 },
    { id: 'client-2', label: 'Client 2', x: 110, y: 210 },
    { id: 'client-3', label: 'Client 3', x: 110, y: 340 },
  ],
  server: { id: 'web-server', label: 'Web Server', x: 790, y: 210 },
});

// Adds the selected object and current evidence state to investigation content.
function withContext(definition, { objectId, evidenceAvailable = true, dynamicFacts = [] }) {
  return {
    objectId,
    title: definition.title,
    details: definition.details,
    meaning: definition.meaning,
    learnMore: definition.learnMore,
    dynamicFacts,
    evidence: definition.evidence
      ? { ...definition.evidence, objectId, available: evidenceAvailable }
      : null,
  };
}

// Builds the live server values shown in the investigation panel.
function getServerFacts(state) {
  if (!state) return [];
  return [
    ['Pending connections', `${state.pendingHalfOpenConnections} / ${state.backlogCapacity}`],
    ['SYN packets received', state.synPacketsReceived],
    ['Completed handshakes', state.completedHandshakes],
    ['Failed connection attempts', state.failedLegitimateAttempts],
  ];
}

// Chooses the correct Level 1 explanation for the selected network object.
export function getLevelOneInvestigation(selection, state) {
  if (!selection) return null;

  if (selection.kind === 'server' || selection.kind === 'backlog') {
    return withContext(content.webServer, {
      objectId: selection.kind,
      dynamicFacts: getServerFacts(state),
    });
  }

  if (selection.kind === 'client') {
    const client = selection.client;
    if (client.behavior === 'suspicious') {
      return withContext(content.suspiciousClient, { objectId: client.id });
    }
    if (client.behavior === 'waiting') {
      return withContext(content.waitingClient, { objectId: client.id });
    }
    const definition = {
      ...content.client,
      details: client.state === 'connected'
        ? content.client.connectedDetails
        : content.client.connectingDetails,
    };
    return withContext(definition, {
      objectId: client.id,
      evidenceAvailable: client.state === 'connected',
    });
  }

  if (selection.kind === 'packet') {
    const packet = selection.packet;
    if (packet.type === 'SYN' && packet.isAttack && state?.attackEvidenceObserved) {
      return withContext(content.repeatedSynPacket, { objectId: packet.id });
    }
    if (packet.type === 'SYN') {
      return withContext(content.synPacket, { objectId: packet.id });
    }
    if (packet.type === 'SYN-ACK') {
      return withContext(content.synAckPacket, { objectId: packet.id });
    }
    if (packet.type === 'ACK') {
      return withContext(content.ackPacket, { objectId: packet.id });
    }
  }

  return null;
}

const correctReport = levelOneReport.choices.find(
  (choice) => choice.id === levelOneReport.correctChoiceId,
);
const correctMitigation = levelOneMitigations.choices.find(
  (choice) => choice.id === levelOneMitigations.correctChoiceId,
);

// Creates the read-only server backlog panel used beside the observer.
function createLevelOneBacklogPanel() {
  const backlog = createBacklogPanel({
    capacity: levelOneSimulation.backlogCapacity,
    title: 'Server Backlog',
    description: 'Simplified pending TCP connections',
    countLabel: 'Pending Connections',
    pressureThreshold: levelOneSimulation.pressureThreshold,
    statusMessages: {
      available: 'Capacity available',
      pressure: 'Backlog under pressure',
      full: 'Backlog full — new connection attempts may fail',
    },
    // Reads Level 1's pending TCP connection count from its simulation state.
    getCount: (state) => state.pendingHalfOpenConnections ?? 0,
    // Reads Level 1's configured TCP backlog capacity from its simulation state.
    getCapacity: (state) => state.backlogCapacity ?? levelOneSimulation.backlogCapacity,
  });

  return {
    element: backlog.element,
    hideDuringMitigation: true,
    update: backlog.update,
  };
}

// Refreshes a selected client with the latest data from the simulation.
function resolveSelection(selection, state) {
  if (selection?.kind !== 'client') return selection;
  const currentClient = state.visibleClients.find(
    (client) => client.id === selection.client.id,
  );
  return currentClient ? { ...selection, client: currentClient } : selection;
}

export const levelOneMission = Object.freeze({
  id: 'syn-flood',
  instructions:
    'Observe clients establish TCP connections using SYN, SYN-ACK, and ACK packets. Watch how incomplete handshakes affect the server\'s simplified pending-connection backlog.',
  statistics: [
    { key: 'pendingHalfOpenConnections', label: 'Pending TCP connections' },
    { key: 'completedHandshakes', label: 'Successful connections' },
    { key: 'failedLegitimateAttempts', label: 'Failed connections' },
  ],
  report: levelOneReport,
  mitigation: levelOneMitigations,
  getInvestigation: getLevelOneInvestigation,
  resolveSelection,
  // Creates the Level 1 observer and exposes the controls used by the mission page.
  createRuntime({ onStateChange, ...options }) {
    const observer = createNetworkObserverPanel({
      ...options,
      diagram: levelOneDiagram,
      // Converts simulation recovery details into the shared mission recovery state.
      onStateChange(state) {
        const recoveryState = state.recoveryComplete
          ? 'complete'
          : state.synCookieProtectionActive
            ? 'recovering'
            : 'inactive';
        onStateChange(state, recoveryState);
      },
      // Creates Level 1's simulation with its TCP-specific configuration.
      createSimulation(simulationOptions) {
        return createLevelOneNetworkSimulation(simulationOptions);
      },
      statusIndicator: {
        label: 'SYN Cookie Protection: Active',
        // Shows the protection label only after SYN cookies are enabled.
        isActive: (state) => state.synCookieProtectionActive,
      },
      // Level 1 treats handshake packets as investigable but leaves DATA packets decorative.
      isPacketInvestigable: (packet) => packet.type !== 'DATA',
      // Level 1 hints identify the client whose repeated handshakes look suspicious.
      shouldHintClient: (client) => client.behavior === 'suspicious',
    });
    return {
      element: observer.element,
      // Starts or resumes the Level 1 simulation.
      play: () => observer.simulation.play(),
      // Pauses the Level 1 simulation.
      pause: () => observer.simulation.pause(),
      // Stops the simulation when the mission page is closed.
      destroy: () => observer.simulation.destroy(),
      // Returns the latest Level 1 simulation state.
      getState: () => observer.simulation.getState(),
      // Changes the simulation speed without resetting it.
      setSpeed: (multiplier) => observer.simulation.setSpeed(multiplier),
      // Shows or hides optional investigation hints.
      setHints: observer.setHints,
      // Highlights a selected network object in the observer.
      selectObject: observer.selectObject,
      // Removes the observer's current selection.
      clearSelection: observer.clearSelection,
      // Applies Level 1's correct SYN cookie defense.
      applyMitigation: () => observer.simulation.performAction('enable-syn-cookies'),
    };
  },
  createContextPanel: createLevelOneBacklogPanel,
  completion: {
    attackName: correctReport.name,
    defenseName: 'Enable SYN Cookies',
    attackSummary: correctReport.feedback,
    defenseSummary: correctMitigation.feedback,
    nextMissionId: 'udp-flood',
    continueLabel: 'Continue to Level Two',
  },
});
