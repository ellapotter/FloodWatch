import {
  createAttackHints,
  createInvestigationContext,
  createNetworkSimulation,
  defineNetworkMission,
  getPacketFacts,
  networkSimulationTiming,
} from '../gameEngine.js';
import { LevelThreeSimulation } from './levelThreeSimulation.js';
import {
  levelThreeInvestigationContent as content,
  levelThreeMitigations,
  levelThreeReport,
} from './levelThreeContent.js';

export const levelThreeSimulation = Object.freeze({
  ...networkSimulationTiming,
  responseDelay: 0,
  maxConcurrentRequests: 1,
  increasedConcurrentRequests: 2,
  processingDuration: 1000,
  maxQueuedRequests: 5,
  increasedQueuedRequests: 10,
  overloadShutdownDelay: 3000,
  normalRequestInterval: 750,
  requestsPerClient: 3,
  replacementDelay: 1000,
  floodInterval: 800,
  floodAnimationInterval: 1000,
  clientResponseTimeout: 18000,
  increasedResponseTimeout: 26000,
  waitingThreshold: 13000,
  disruptedClientDuration: 4000,
  statisticsWindow: 10000,
  normalRequestPaths: Object.freeze(['/', '/about', '/support', '/products']),
  attackRequestPath: '/products',
});

export function createLevelThreeNetworkSimulation(options) {
  return createNetworkSimulation(LevelThreeSimulation, levelThreeSimulation, options);
}

const levelThreeHints = createAttackHints({
  packetType: 'HTTP GET',
  counterKey: 'attackRequestsGenerated',
  threshold: 2,
});

export const shouldHintLevelThreeClient = levelThreeHints.shouldHintClient;
export const shouldHintLevelThreePacket = levelThreeHints.shouldHintPacket;

export function getLevelThreeInvestigation(selection, state) {
  if (!selection) return null;
  if (selection.kind === 'server') {
    const definition = state?.serverProcessingQueue > 0 ? content.delayedRequests : content.server;
    return createInvestigationContext(definition, {
      objectId: selection.objectId ?? 'server',
      dynamicFacts: [
        ['Processing now', state?.activeProcessingRequests ?? 0],
        ['Waiting in queue', state?.serverProcessingQueue ?? 0],
      ],
    });
  }

  if (selection.kind === 'client') {
    const client = selection.client;
    const definition = client.behavior === 'suspicious'
      ? content.suspiciousClient
      : ['waiting', 'disrupted'].includes(client.behavior)
        ? content.waitingClient
        : content.client;
    return createInvestigationContext(definition, { objectId: client.id });
  }

  if (selection.kind === 'packet') {
    const packet = selection.packet;
    let definition = packet.type === 'HTTP Response' ? content.response : content.getRequest;
    if ( packet.type === 'HTTP GET' && packet.isAttack && (state?.attackRequestsGenerated ?? 0) >= 2) definition = content.highTraffic;
    const dynamicFacts = getPacketFacts(packet);
    if (packet.path) dynamicFacts.push(['Requested Path', packet.path]);
    if (packet.statusCode) dynamicFacts.push(['HTTP Status', packet.statusCode]);
    return createInvestigationContext(definition, {
      objectId: packet.id,
      dynamicFacts,
    });
  }
  return null;
}

export function getLevelThreeServerState(state) {
  const processingPressure = state.serverProcessingQueue >= 3;
  let statusLabel = 'Application Online';
  if (state.wafRateLimitingActive) {
    statusLabel = state.recoveryComplete ? 'Traffic Normal' : 'Queue Recovering';
  } else if (state.serverShutdown) statusLabel = 'Server Unresponsive';
  else if (processingPressure) statusLabel = 'Processing Delayed';
  else if (state.activeMitigationId === 'increase-processing-capacity') {
    statusLabel = 'Processing Capacity Increased';
  } else if (state.activeMitigationId === 'increase-http-timeout') {
    statusLabel = 'HTTP Timeout Increased';
  }

  return {
    statusLabel,
    underPressure: !state.wafRateLimitingActive && (state.serverShutdown || processingPressure),
    recovering: state.wafRateLimitingActive && !state.recoveryComplete,
    protected: state.wafRateLimitingActive,
    showBlockOverlay: state.wafRateLimitingActive,
    blockOverlayActive: state.wafFilteredIndicatorActive,
    blockOverlayAllClients: state.wafRateLimitingActive,
    blockOverlaySlot: state.attackClientSlot,
    blockOverlayLabel: 'WAF Rate Limit',
  };
}

export const levelThreeMission = defineNetworkMission({
  id: 'http-flood',
  instructions: 'Observe how browsers request website resources using HTTP. Watch the incoming request rate, response times, and application processing queue to identify behavior that disrupts legitimate visitors.',
  blockOverlayLabel: 'WAF Rate Limit',
  statistics: [
    {
      key: 'incomingHttpRequestsPerSecond',
      label: 'Incoming HTTP Requests',
      primary: true,
      format: (value = 0) => `${value.toFixed(1)} requests/sec`,
      status(state) {
        if (state.wafRateLimitingActive) return { label: 'Rate Limited', tone: 'success' };
        if (state.serverProcessingQueue >= 3 && state.incomingHttpRequestsPerSecond >= 1) {
          return { label: 'High Traffic', tone: 'warning' };
        }
        return { label: 'Normal', tone: 'neutral' };
      },
    },
    {
      key: 'averageResponseTime',
      label: 'Average Response Time',
      format: (value) => Number.isFinite(value)
        ? value >= 1000
          ? `${(value / 1000).toFixed(1)} s`
          : `${Math.round(value)} ms`
        : 'No recent responses',
    },
    {
      key: 'serverProcessingQueue',
      label: 'Server Processing Queue',
      capacity: (state) => state.serverProcessingQueue / state.processingQueueCapacity * 100,
    },
    {
      key: 'droppedHttpRequests',
      label: 'Dropped HTTP Requests',
    },
  ],
  report: levelThreeReport,
  mitigation: levelThreeMitigations,
  diagramTitle: 'HTTP client and web application network',
  createSimulation: createLevelThreeNetworkSimulation,
  getInvestigation: getLevelThreeInvestigation,
  hints: levelThreeHints,
  getRecoveryState: (state) => state.recoveryComplete
    ? 'complete'
    : state.wafRateLimitingActive
      ? 'recovering'
      : 'inactive',
  statusIndicator: {
    label: 'Mitigation Active',
    isActive: (state) => Boolean(state.activeMitigationId),
    getLabel(state) {
      if (state.wafRateLimitingActive) return 'WAF Rate Limiting Active';
      if (state.activeMitigationId === 'increase-processing-capacity') {
        return 'Processing Capacity Increased';
      }
      return 'HTTP Request Timeout Increased';
    },
  },
  clientStatusLabels: {
    communicating: 'Communicating',
    waiting: 'Waiting for Response',
  },
  getServerState: getLevelThreeServerState,
  completion: {
    defenseName: 'Apply HTTP Rate Limiting Using a WAF',
    nextMissionId: 'dns-amplification',
    continueLabel: 'Continue to Level Four',
  },
});
