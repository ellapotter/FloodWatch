import {
  BookOpen,
  ChartNoAxesCombined,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  Clock,
  createElement,
  Database,
  Eye,
  Gauge,
  Globe,
  Lightbulb,
  Lock,
  Monitor,
  Network,
  Package,
  Play,
  RotateCcw,
  Router,
  Search,
  Send,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Trophy,
} from 'lucide';

const iconNodes = Object.freeze({
  'book-open': BookOpen,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  'clipboard-list': ClipboardList,
  clock: Clock,
  database: Database,
  eye: Eye,
  gauge: Gauge,
  globe: Globe,
  lightbulb: Lightbulb,
  lock: Lock,
  monitor: Monitor,
  network: Network,
  package: Package,
  play: Play,
  'rotate-ccw': RotateCcw,
  router: Router,
  search: Search,
  send: Send,
  server: Server,
  settings: Settings,
  'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck,
  'triangle-alert': TriangleAlert,
  trophy: Trophy,
});

const categoryIcons = Object.freeze({
  client: 'monitor',
  packet: 'package',
  server: 'server',
  router: 'router',
  backlog: 'database',
  network: 'network',
  evidence: 'clipboard-list',
});

export const evidenceIconMappings = Object.freeze({
  'client-communicating': { category: 'client', primary: 'monitor' },
  'client-syn-request': { category: 'packet', primary: 'package' },
  'server-syn-ack-response': { category: 'packet', primary: 'package' },
  'client-ack-completes-connection': { category: 'packet', primary: 'package' },
  'server-connection-requests': { category: 'server', primary: 'server' },
  'suspicious-client': {
    category: 'client', primary: 'monitor', secondary: 'triangle-alert', variant: 'warning',
  },
  'client-connection-delays': {
    category: 'client', primary: 'monitor', secondary: 'clock', variant: 'warning',
  },
  'repeated-syn': {
    category: 'packet', primary: 'package', secondary: 'triangle-alert', variant: 'warning',
  },
  'established-connection-data': { category: 'packet', primary: 'package' },
});

export const panelIconMappings = Object.freeze({
  networkObserver: 'network',
  evidence: 'clipboard-list',
  statistics: 'chart-no-axes-combined',
  backlog: 'database',
  investigation: 'search',
  report: 'triangle-alert',
  mitigation: 'shield-check',
  completion: 'trophy',
});

export const missionIconMappings = Object.freeze({
  'syn-flood': 'shield-alert',
  'udp-flood': 'send',
  'http-flood': 'globe',
  'dns-amplification': 'network',
  'final-mission': 'trophy',
});

export const missionStatusIconMappings = Object.freeze({
  Locked: 'lock',
  Available: 'play',
  Completed: 'circle-check',
});

export const gameFlowIconMappings = Object.freeze({
  Observe: 'eye',
  Investigate: 'search',
  'Collect Evidence': 'clipboard-list',
  Report: 'triangle-alert',
  'Report Attack': 'triangle-alert',
  Defend: 'shield-check',
  Mitigate: 'shield-check',
  Complete: 'circle-check',
});

export const helpSectionIconMappings = Object.freeze({
  welcome: 'circle-help',
  'how-to-play': 'book-open',
  controls: 'settings',
  fundamentals: 'network',
  communication: 'network',
  'dos-ddos': 'triangle-alert',
});

export const settingsIconMappings = Object.freeze({
  page: 'settings',
  speed: 'gauge',
  hints: 'lightbulb',
  reset: 'rotate-ccw',
});

export function hasIcon(iconName) {
  return Boolean(iconNodes[iconName]);
}

export function createIcon(iconName, {
  size = 20,
  className = '',
} = {}) {
  const iconNode = iconNodes[iconName] ?? ClipboardList;
  return createElement(iconNode, {
    width: size,
    height: size,
    class: ['app-icon', className].filter(Boolean).join(' '),
    'aria-hidden': 'true',
    focusable: 'false',
  });
}

export function decorateHeading(heading, iconName, { size = 21 } = {}) {
  if (!heading || heading.querySelector(':scope > .app-icon')) return heading;
  heading.classList.add('heading-with-icon');
  heading.prepend(createIcon(iconName, { size, className: 'heading-icon' }));
  return heading;
}

export function getEvidenceIconConfig(evidence) {
  const compatibility = evidenceIconMappings[evidence.id] ?? {};
  const category = evidence.sourceType ?? compatibility.category ?? 'evidence';
  const variant = evidence.variant ?? compatibility.variant ?? 'default';
  return {
    category,
    variant,
    primary: compatibility.primary ?? categoryIcons[category] ?? 'clipboard-list',
    secondary: compatibility.secondary ?? null,
  };
}

export function createEvidenceIcon(evidence) {
  const configuration = getEvidenceIconConfig(evidence);
  const badge = document.createElement('span');
  badge.className = 'evidence-icon';
  badge.dataset.category = configuration.category;
  badge.dataset.variant = configuration.variant;
  badge.setAttribute('aria-hidden', 'true');
  badge.append(createIcon(configuration.primary, {
    size: 19,
    className: 'evidence-icon__primary',
  }));
  if (configuration.secondary) {
    badge.append(createIcon(configuration.secondary, {
      size: 11,
      className: 'evidence-icon__secondary',
    }));
  }
  return badge;
}
