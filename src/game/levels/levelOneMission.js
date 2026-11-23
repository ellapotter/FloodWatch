/**
 * Connects the shared mission page to Level 1's SYN flood implementation.
 * Protocol-specific behavior stays here so the page logic does not need
 * to know about TCP backlogs, SYN cookies, or Level 1 evidence rules.
 */
import {
  createAttackHints,
  createInvestigationContext,
  createNetworkSimulation,
  defineNetworkMission,
  getPacketFacts,
  networkSimulationTiming,
  resolveNetworkSelection,
} from '../gameEngine.js';
import { LevelOneSimulation } from './levelOneSimulation.js';
import {
  levelOneInvestigationContent as content,
  levelOneMitigations,
  levelOneReport,
} from './levelOneContent.js';

export const levelOneSimulation = Object.freeze({
  ...networkSimulationTiming,
  backlogCapacity: 5, // The maximum number of pending half-open connections before the server starts dropping new SYN packets
  increasedBacklogCapacity: 10, // The maximum number of pending half-open connections after the increase backlog mitigation is applied
  blockedIndicatorDuration: 1200, // The amount of time the blocked TCP indicator is shown after TCP is blocked by mitigation
  pendingConnectionTimeout: 10000, // The amount of time a pending connection will wait before being dropped
  dataPacketsPerConnection: 4, // The number of data packets sent after a connection is established
  replacementDelay: 1000, // The amount of time after a client is dropped before a new one appears
  repeatedSynEvidenceThreshold: 3, // The number of repeated SYN packets that must be sent before the repeated SYN evidence is revealed
  pressureThreshold: 0.6, // The percentage of the backlog capacity that must be filled before the pressure warning is revealed
});

// Creates the shared controller with Level 1's TCP simulation driver.
export function createLevelOneNetworkSimulation(options) {
  return createNetworkSimulation(LevelOneSimulation, levelOneSimulation, options);
}

const levelOneHints = createAttackHints({
  packetType: 'SYN',
  counterKey: 'attackSynPacketsSent',
  threshold: 2,
});

// If a client is suspicious and hints are on, it will be highlighted
export const shouldHintLevelOneClient = levelOneHints.shouldHintClient;

// If repeated SYN packets are sent and hints are on, they will be highlighted
export const shouldHintLevelOnePacket = levelOneHints.shouldHintPacket;

// Chooses the correct Level 1 explanation for the selected network object.
export function getLevelOneInvestigation(selection, state) {
  if (!selection) return null;

  if (selection.kind === 'server' || selection.kind === 'backlog') {
    return createInvestigationContext(content.webServer, {
      objectId: selection.kind,
    });
  }

  if (selection.kind === 'client') {
    const client = selection.client;
    if (client.behavior === 'suspicious') {
      return createInvestigationContext(content.suspiciousClient, { objectId: client.id });
    }
    if (client.behavior === 'waiting') {
      return createInvestigationContext(content.waitingClient, { objectId: client.id });
    }
    const definition = {
      ...content.client,
      details: client.state === 'connected'
        ? content.client.connectedDetails
        : content.client.connectingDetails,
    };
    return createInvestigationContext(definition, { objectId: client.id });
  }

  if (selection.kind === 'packet') {
    const packet = selection.packet;
    const packetContext = {
      objectId: packet.id,
      dynamicFacts: getPacketFacts(packet),
    };
    if (packet.type === 'SYN' && packet.isAttack && state?.attackEvidenceObserved) {
      return createInvestigationContext(content.repeatedSynPacket, packetContext);
    }
    if (packet.type === 'SYN') {
      return createInvestigationContext(content.synPacket, packetContext);
    }
    if (packet.type === 'SYN-ACK') {
      return createInvestigationContext(content.synAckPacket, packetContext);
    }
    if (packet.type === 'ACK') {
      return createInvestigationContext(content.ackPacket, packetContext);
    }
    if (packet.type === 'DATA') {
      return createInvestigationContext(content.dataPacket, packetContext);
    }
  }

  return null;
}

// Keeps the investigation panel content even when the selected object is no longer visible
export const resolveLevelOneSelection = resolveNetworkSelection;

// Returns the current state of the server
function getLevelOneServerState(state) {
  const underPressure = Number.isFinite(state.pendingHalfOpenConnections)
    && state.pendingHalfOpenConnections >= Math.ceil(state.backlogCapacity * 0.6);
  const recoveryActive = Boolean(state.synCookieProtectionActive) && !state.recoveryComplete;
  const backlogIncreased = state.activeMitigationId === 'increase-tcp-backlog';
  const trafficBlocked = state.tcpTrafficBlocked === true;
  let statusLabel = 'Online';
  if (trafficBlocked) statusLabel = 'TCP Traffic Blocked';
  else if (state.synCookieProtectionActive) statusLabel = 'SYN Cookies Active';
  else if (state.serverShutdown) statusLabel = 'Server Unresponsive';
  else if (backlogIncreased) {
    statusLabel = state.pendingHalfOpenConnections >= state.backlogCapacity
      ? 'Backlog Full'
      : 'Backlog Increased';
  } else if (underPressure) statusLabel = 'Backlog pressure';

  return {
    statusLabel,
    underPressure: (underPressure && !recoveryActive) || trafficBlocked || state.serverShutdown,
    recovering: recoveryActive,
    protected: Boolean(state.synCookieProtectionActive),
    showBlockOverlay: trafficBlocked,
    blockOverlayActive: state.blockedPacketIndicatorActive === true,
  };
}

export const levelOneMission = defineNetworkMission({
  id: 'syn-flood',
  instructions:
    'Observe the network and watch as clients establish connections with the server. Watch how the connection process works and identify any potential issues.',
  statistics: [
    {
      key: 'displayedPendingHalfOpenConnections',
      label: 'Pending TCP connections',
      primary: true,
      capacity: (state) => state.backlogCapacity
        ? state.displayedPendingHalfOpenConnections / state.backlogCapacity * 100
        : 0,
      status(state) {
        if (state.synCookieProtectionActive) {
          return { label: state.recoveryComplete ? 'Stable' : 'Recovering', tone: 'success' };
        }
        if (state.displayedPendingHalfOpenConnections >= state.backlogCapacity) {
          return { label: 'Full', tone: 'warning' };
        }
        if (
          state.displayedPendingHalfOpenConnections
          >= Math.ceil(state.backlogCapacity * 0.6)
        ) {
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
  diagramTitle: 'Client and web server network',
  createSimulation: createLevelOneNetworkSimulation,
  getInvestigation: getLevelOneInvestigation,
  hints: levelOneHints,
  getRecoveryState: (state) => state.recoveryComplete
    ? 'complete'
    : state.synCookieProtectionActive
      ? 'recovering'
      : 'inactive',
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
  getServerState: getLevelOneServerState,
  blockOverlayLabel: 'TCP Blocked',
  completion: {
    defenseName: 'Enable SYN Cookies',
    nextMissionId: 'udp-flood',
    continueLabel: 'Continue to Level Two',
  },
});
