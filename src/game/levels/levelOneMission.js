/**
 * Connects the shared mission page to Level 1's SYN flood implementation.
 * Protocol-specific behavior stays here so the page coordinator does not need
 * to know about TCP backlogs, SYN cookies, or Level 1 evidence rules.
 */
import { createNetworkObserverPanel } from '../../panels/networkObserverPanel.js';
import { NetworkSimulation } from '../gameEngine.js';
import { LevelOneSimulation } from './levelOneSimulation.js';
import {
  levelOneInvestigationContent as content,
  levelOneMitigations,
  levelOneReport,
} from './levelOneContent.js';

export const levelOneSimulation = Object.freeze({
  backlogCapacity: 5, // The maximum number of pending half-open connections before the server starts dropping new SYN packets
  increasedBacklogCapacity: 10, // The maximum number of pending half-open connections after the  increase backlog mitigation is applied
  blockedIndicatorDuration: 1200, // The amount of time the blocked TCP indicator is shown after TCP is blocked by mitigation
  pendingConnectionTimeout: 10000, // The amount of time a pending connection will wait before being dropped
  packetDuration: 4000, // The amount of time it takes for a packet to travel from source to destination
  stepDelay: 750, // The amount of time between data transfer and connection step
  clientSpawnInterval: 4500, // The amount of time between each new client being spawned
  dataPacketsPerConnection: 4, // The number of data packets sent after a connection is established
  failedClientWaitDuration: 12000, // The amount of time a client waits before dropping after not recieving a reply back from the server
  replacementDelay: 1000, // The amount of time after a client is dropped before a new one appears
  attackAttemptInterval: 1000, // The amount of time between each SYN packet sent by the attacker
  attackStartDelay: 60000, // The amount of time after the simulation starts before the attack begins
  repeatedSynEvidenceThreshold: 3, // The number of repeated SYN packets that must be sent before the repeated SYN evidence is revealed
  pressureThreshold: 0.6, // The percentage of the backlog capacity that must be filled before the pressure warning is revealed
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
  clients: [
    { id: 'client-1', label: 'Client 1', x: 110, y: 80 },
    { id: 'client-2', label: 'Client 2', x: 110, y: 210 },
    { id: 'client-3', label: 'Client 3', x: 110, y: 340 },
  ],
  server: { id: 'web-server', label: 'Web Server', x: 790, y: 210 },
});

// If a client is suspicious and hints are on, it will be highlighted
export function shouldHintLevelOneClient(client) {
  return client.behavior === 'suspicious';
}

// If repeated SYN packets are sent and hints are on, they will be highlighted
export function shouldHintLevelOnePacket(packet, state) {
  return packet.type === 'SYN'
    && packet.isAttack === true
    && (state?.attackSynPacketsSent ?? 0) >= 2;
}

// Adds the selected object and current evidence state to investigation content.
function withContext(definition, { objectId, dynamicFacts = [] }) {
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

function getPacketFacts(packet) {
  return [
    ['Packet Type', packet.type],
    ['Source', packet.sourceLabel ?? packet.sourceId],
    ['Destination', packet.destinationLabel ?? packet.destinationId],
  ];
}

// Chooses the correct Level 1 explanation for the selected network object.
export function getLevelOneInvestigation(selection, state) {
  if (!selection) return null;

  if (selection.kind === 'server') {
    return withContext(content.webServer, {
      objectId: selection.kind,
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
    return withContext(definition, { objectId: client.id });
  }

  if (selection.kind === 'packet') {
    const packet = selection.packet;
    const packetContext = {
      objectId: packet.id,
      dynamicFacts: getPacketFacts(packet),
    };
    if (packet.type === 'SYN' && packet.isAttack && state?.attackEvidenceObserved) {
      return withContext(content.repeatedSynPacket, packetContext);
    }
    if (packet.type === 'SYN') {
      return withContext(content.synPacket, packetContext);
    }
    if (packet.type === 'SYN-ACK') {
      return withContext(content.synAckPacket, packetContext);
    }
    if (packet.type === 'ACK') {
      return withContext(content.ackPacket, packetContext);
    }
    if (packet.type === 'DATA') {
      return withContext(content.dataPacket, packetContext);
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

// Keeps the investigation panel content even when the selected object is no longer visible
export function resolveLevelOneSelection(selection, state) {
  if (selection?.kind === 'client') {
    const currentClient = state.visibleClients.find(
      (client) => client.id === selection.client.id,
    );
    return currentClient ? { ...selection, client: currentClient } : selection;
  }
  if (selection?.kind === 'packet') {
    const currentPacket = state.activePackets.find(
      (packet) => packet.id === selection.packet.id,
    );
    return currentPacket ? { ...selection, packet: currentPacket } : selection;
  }
  return selection;
}

export const levelOneMission = Object.freeze({
  id: 'syn-flood',
  instructions:
    'Observe the network and watch as clients establish connections with the server. Watch how the connection process works and identify any potential issues.',
  statistics: [
    {
      key: 'pendingHalfOpenConnections',
      label: 'Pending TCP connections',
      primary: true,
      capacity: (state) => state.backlogCapacity
        ? state.pendingHalfOpenConnections / state.backlogCapacity * 100
        : 0,
      status(state) {
        if (state.synCookieProtectionActive) {
          return { label: state.recoveryComplete ? 'Stable' : 'Recovering', tone: 'success' };
        }
        if (state.pendingHalfOpenConnections >= state.backlogCapacity) {
          return { label: 'Full', tone: 'warning' };
        }
        if (state.pendingHalfOpenConnections >= Math.ceil(state.backlogCapacity * 0.6)) {
          return { label: 'Increasing', tone: 'warning' };
        }
        return { label: 'Normal', tone: 'neutral' };
      },
    },
    { key: 'completedHandshakes', label: 'Successful connections' },
    { key: 'activeLegitimateConnections', label: 'Active connections' },
    { key: 'failedLegitimateAttempts', label: 'Failed connections' },
  ],
  report: levelOneReport,
  mitigation: levelOneMitigations,
  getInvestigation: getLevelOneInvestigation,
  resolveSelection: resolveLevelOneSelection,

  // Creates the Level 1 observer
  createRuntime({ onStateChange, ...options }) {
    const observer = createNetworkObserverPanel({
      ...options,
      diagram: levelOneDiagram,
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
        label: 'Mitigation Active',
        isActive: (state) => Boolean(state.activeMitigationId),
        getLabel(state) {
          if (state.synCookieProtectionActive) {
            return state.recoveryComplete
              ? 'SYN Cookie Protection: Network Stabilized'
              : 'SYN Cookie Protection: Active';
          }
          if (state.tcpTrafficBlocked) return 'Inbound TCP Filter: Active';
          return 'Backlog Capacity Increased';
        },
      },
      shouldHintClient: shouldHintLevelOneClient,
      shouldHintPacket: shouldHintLevelOnePacket,
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
  },
  completion: {
    attackName: correctReport.name,
    defenseName: 'Enable SYN Cookies',
    attackSummary: correctReport.feedback,
    defenseSummary: correctMitigation.feedback,
    nextMissionId: 'udp-flood',
    continueLabel: 'Continue to Level Two',
  },
});
