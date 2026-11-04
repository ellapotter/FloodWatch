import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evidenceIconMappings,
  gameFlowIconMappings,
  getEvidenceIconConfig,
  hasIcon,
  helpSectionIconMappings,
  missionIconMappings,
  missionStatusIconMappings,
  panelIconMappings,
  settingsIconMappings,
} from '../src/icons/iconSystem.js';

test('every configured icon exists in the installed Lucide version', () => {
  const configuredNames = [
    ...Object.values(panelIconMappings),
    ...Object.values(missionIconMappings),
    ...Object.values(missionStatusIconMappings),
    ...Object.values(gameFlowIconMappings),
    ...Object.values(helpSectionIconMappings),
    ...Object.values(settingsIconMappings),
    ...Object.values(evidenceIconMappings).flatMap(({ primary, secondary }) =>
      [primary, secondary].filter(Boolean)),
    'monitor',
    'package',
    'server',
    'router',
    'database',
    'network',
    'clipboard-list',
  ];

  configuredNames.forEach((iconName) => assert.equal(hasIcon(iconName), true, iconName));
});

test('Level 1 evidence IDs use the required primary and secondary mappings', () => {
  assert.deepEqual(evidenceIconMappings, {
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
});

test('evidence metadata takes priority and unknown evidence receives the fallback icon', () => {
  assert.deepEqual(getEvidenceIconConfig({
    id: 'future-router-evidence', sourceType: 'router', variant: 'default',
  }), {
    category: 'router', variant: 'default', primary: 'router', secondary: null,
  });
  assert.deepEqual(getEvidenceIconConfig({ id: 'future-unknown-evidence' }), {
    category: 'evidence',
    variant: 'default',
    primary: 'clipboard-list',
    secondary: null,
  });
});
