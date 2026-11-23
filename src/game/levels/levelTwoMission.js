import {
  createAttackHints,
  createInvestigationContext,
  createNetworkSimulation,
  defineNetworkMission,
  getPacketFacts,
  networkSimulationTiming,
} from '../gameEngine.js';

import { LevelTwoSimulation } from './levelTwoSimulation.js';

import {
  levelTwoInvestigationContent as content,
  levelTwoMitigations,
  levelTwoReport,
} from './levelTwoContent.js';

// Level 2 uses the shared clock and packet animation timing.
export const levelTwoSimulation = Object.freeze({
    ...networkSimulationTiming,

  // Inbound link capacity. (set low for simulation purposes)
    capacityKbps: 8,
    increasedCapacityKbps: 14,
    datagramSizeBytes: 1000,
    statisticsWindow: 4000,
    // Normal UDP communication.
    normalTrafficInterval: 500,
    exchangesPerClient: 4,
    replacementDelay: 1000,

    // Fixed-rate UDP flood.
    floodInterval: 1000,

    // Simplified server-side request limiter.
    serverRateLimitWindow: 4000,
    serverRateLimitCount: 3,
});

export function createLevelTwoNetworkSimulation(options) {
    return createNetworkSimulation(LevelTwoSimulation,levelTwoSimulation,options,);
}

const levelTwoHints = createAttackHints({
    packetType: 'UDP Datagram',
    counterKey: 'attackDatagramsGenerated',
    threshold: 2,
});

export const shouldHintLevelTwoClient = levelTwoHints.shouldHintClient;

export const shouldHintLevelTwoPacket = levelTwoHints.shouldHintPacket;

// Returns the appropriate educational explanation.
export function getLevelTwoInvestigation(selection, state) {
    if (!selection) return null;

    if (selection.kind === 'server') {
        return createInvestigationContext(content.server, {
            objectId: selection.objectId ?? 'server',
            dynamicFacts: [
                ['Packets processed', state?.processedUdpPackets ?? 0],
                ['Dropped packets', state?.droppedPackets ?? 0],
            ],
        });
    }

    if (selection.kind === 'client') {
        const client = selection.client;

        const definition = client.behavior === 'suspicious' ? content.suspiciousClient : client.behavior === 'disrupted' ? content.disruptedClient : content.client;

        return createInvestigationContext(definition, { objectId: client.id });
    }

    if (selection.kind === 'packet') {
        const packet = selection.packet;
        const definition = packet.type === 'UDP Response' ? content.response : packet.isAttack && state?.attackDatagramsGenerated >= 2 ? content.suspiciousDatagram : content.datagram;

        return createInvestigationContext(definition, {objectId: packet.id,dynamicFacts: getPacketFacts(packet), });
    }
  return null;
}

function getLevelTwoServerState(state) {
    let statusLabel = 'Online';

    if (state.udpTrafficBlocked) statusLabel = 'UDP Blocked';
    else if (state.upstreamFilteringActive) statusLabel = state.recoveryComplete ? 'Traffic Normal' : 'Filtering UDP';
    else if (state.activeMitigationId === 'increase-bandwidth') statusLabel = state.serverShutdown ? 'Server Unresponsive' : 'Bandwidth Increased';
    else if (state.rateLimitingActive) statusLabel = state.serverShutdown? 'Rate Limiting - Unresponsive': 'Rate Limiting';
    else if (state.serverShutdown) statusLabel = 'Server Unresponsive';
    else if (state.congestionActive) statusLabel = 'Congested';
    else if (state.highUtilizationActive) statusLabel = 'High Traffic';

    return {
        statusLabel,
        underPressure: state.serverShutdown || state.congestionActive || state.udpTrafficBlocked,
        recovering: state.upstreamFilteringActive && !state.recoveryComplete,
        protected: state.upstreamFilteringActive,
        showBlockOverlay: state.udpTrafficBlocked || state.upstreamFilteringActive,
        blockOverlayActive: state.upstreamFilteringActive ? state.filteredIndicatorActive: state.blockedIndicatorActive,
        blockOverlayLabel: state.upstreamFilteringActive? 'UDP Filter': 'UDP Blocked',
        blockOverlayAllClients: state.upstreamFilteringActive,
        blockOverlaySlot: state.upstreamFilteringActive? state.attackClientSlot: null,
    };
}

export const levelTwoMission = defineNetworkMission({
    id: 'udp-flood',
    instructions: 'Observe how clients exchange UDP datagrams with the server. Watch the incoming traffic, bandwidth demand, and packet loss to identify behavior that disrupts legitimate communication.',
    blockOverlayLabel: 'UDP Blocked',
    statistics: [
    {
        key: 'bandwidthPercent',
        label: 'Bandwidth Demand',
        primary: true,

        format: (value = 0, state) =>`${value.toFixed(0)}% of ${state.networkCapacityKbps} kbps`,
        capacity: (state) => state.bandwidthPercent,

        status(state) {
            if (state.upstreamFilteringActive) {
                return {
                    label: state.recoveryComplete ? 'Stable' : 'Filtering',
                    tone: 'success',
                };
            }

            if (state.udpTrafficBlocked) return { label: 'UDP Blocked', tone: 'warning' };
            if (state.congestionActive) return { label: 'Packet Loss', tone: 'warning' };
            if (state.highUtilizationActive) return { label: 'High Traffic', tone: 'warning' };
            if (state.bandwidthPercent >= 55) return { label: 'Increasing', tone: 'warning' };

            return { label: 'Normal', tone: 'neutral' };
        },
    },

    {
        key: 'processedUdpPackets',
        label: 'Packets Processed',
    },

    {
        key: 'droppedPackets',
        label: 'Dropped Packets',
    },
  ],

    report: levelTwoReport,
    mitigation: levelTwoMitigations,

    diagramTitle: 'UDP client and server network',
    createSimulation: createLevelTwoNetworkSimulation,
    getInvestigation: getLevelTwoInvestigation,
    hints: levelTwoHints,

    getRecoveryState: (state) => state.recoveryComplete ? 'complete': state.upstreamFilteringActive ? 'recovering' : 'inactive',

    statusIndicator: {
        label: 'Mitigation Active',

        isActive: (state) => Boolean(state.activeMitigationId),

        getLabel(state) {
            if (state.upstreamFilteringActive) return state.recoveryComplete ? 'Upstream UDP Filter: Network Stabilized' : 'Upstream UDP Filter: Active';
            if (state.udpTrafficBlocked) return 'Inbound UDP Block: Active';
            if (state.rateLimitingActive) return 'Server UDP Rate Limit: Active';
            if (state.activeMitigationId === 'increase-bandwidth') return 'Network Bandwidth Increased';

            return 'Mitigation Active';
        },
    },

    clientStatusLabels: {
        communicating: 'Communicating',
        disrupted: 'Waiting for Response',
    },

    getServerState: getLevelTwoServerState,

    completion: {
        defenseName: 'Apply Upstream UDP Filtering',
        nextMissionId: 'http-flood',
        continueLabel: 'Continue to Level Three',
    },
});
