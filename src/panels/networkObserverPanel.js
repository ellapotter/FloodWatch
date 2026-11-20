/**
 * Renders a client/server diagram as an interactive SVG and
 * connects its controls and investigable objects to the mission page.
 */
import { createIcon, decorateHeading, panelIconMappings } from '../icons/iconSystem.js';

const defaultClientStatusLabels = Object.freeze({
  waiting: 'Waiting...',
  disrupted: 'Communication disrupted',
  hinted: 'Review activity',
  connected: 'Connected',
  default: 'Connecting',
});

export function getClientPresentation(client, showHints = false, statusLabels = {}) {
  if (!client) return null;
  const labels = { ...defaultClientStatusLabels, ...statusLabels };
  const isDisrupted = client.behavior === 'disrupted';
  const isWaiting = client.behavior === 'waiting' || isDisrupted;
  const isSuspicious = client.behavior === 'suspicious';
  const statusLabel = isWaiting
    ? isDisrupted ? labels.disrupted : labels.waiting
    : isSuspicious && showHints
      ? labels.hinted
      : labels[client.state] ?? labels.default;
  return {
    isWaiting,
    statusLabel,
    ariaLabel: isWaiting
      ? isDisrupted
        ? `Investigate ${client.label}, communication disrupted by packet loss`
        : `Investigate ${client.label}, connection delayed`
      : `Investigate ${client.label}`,
  };
}

export function getPacketVisualPosition(packet, diagram) {
  const client = diagram.clients[packet.slotIndex];
  if (!client) return { x: packet.x, y: packet.y };
  const progress = Math.min(
    packet.willBeBlocked || packet.willBeDropped ? 0.88 : 1,
    Math.max(0, packet.progress ?? 0),
  );
  // Keep the full packet card between the device cards, not over their edges.
  const cardInset = 58;
  const clientBoundary = { x: client.x + 70 + cardInset, y: client.y };
  const serverBoundary = { x: diagram.server.x - 80 - cardInset, y: diagram.server.y };
  const toServer = packet.direction === 'client-to-server';
  const source = toServer ? clientBoundary : serverBoundary;
  const destination = toServer ? serverBoundary : clientBoundary;
  const laneOffset = (toServer ? -9 : 9) + (packet.visualLaneOffset ?? 0);
  return {
    x: source.x + (destination.x - source.x) * progress,
    y: source.y + (destination.y - source.y) * progress + laneOffset,
  };
}

// Describes the diagram without revealing mission-specific behavior or attack clues.
export function getNetworkDiagramDescription(diagram) {
  const clientCount = diagram.clients.length;
  return `Interactive network diagram with ${clientCount} client${clientCount === 1 ? '' : 's'} and one server. Select a device or packet to investigate.`;
}


export function createNetworkObserverPanel({
  diagram,
  createSimulation,
  statusIndicator = null,
  isPacketInvestigable = () => true,
  shouldHintClient = () => false,
  shouldHintPacket = () => false,
  clientStatusLabels = {},
  getServerState = () => ({ statusLabel: 'Online' }),
  blockOverlayLabel = '',
  attackPacketType = null,
  onStateChange,
  onInvestigate = () => {},
  onRestart = () => {},
  onSpeedChange = () => {},
  speedMultiplier = 1,
  speedOptions = [],
  hintsEnabled = false,
}) {
  const section = document.createElement('section');
  section.className = 'panel network-observer';
  section.setAttribute('aria-labelledby', 'observer-title');
  section.innerHTML = `
    <div class="section-heading">
      <h2 id="observer-title"></h2>
      <span class="observer-status-indicator" hidden></span>
    </div>
    <svg class="network-diagram" viewBox="${diagram.viewBox ?? '0 0 900 420'}" role="group" aria-labelledby="network-title network-description">
      <title id="network-title"></title>
      <desc id="network-description"></desc>

      <defs>
        <marker id="packet-arrow-forward" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0 0 8 4 0 8Z"></path>
        </marker>
        <marker id="packet-arrow-reverse" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="5" markerHeight="5" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M8 0 0 4 8 8Z"></path>
        </marker>
      </defs>

      <g class="connection-lines"></g>
      <g class="network-packets"></g>
      <g class="tcp-filter" aria-hidden="true" hidden>
        <rect x="-9" y="-48" width="18" height="96" rx="7"></rect>
        <path d="M-4-16 4-16M-4-8 4-8M-4 0 4 0M-4 8 4 8M-4 16 4 16"></path>
        <text class="traffic-block-label" y="65" text-anchor="middle"></text>
      </g>
      <g class="network-devices"></g>
    </svg>
    <div class="simulation-controls" aria-label="Simulation controls">
      <div class="simulation-playback-controls">
        <button class="button--primary" type="button" data-action="play" aria-pressed="false">Play</button>
        <button class="button--secondary" type="button" data-action="pause" aria-pressed="false">Pause</button>
        <button class="button--secondary" type="button" data-action="restart">Restart</button>
      </div>
      <div class="simulation-speed-control" role="group" aria-label="Simulation speed">
        <span>Speed</span>
        <div class="simulation-speed-options">
          ${speedOptions.map((option) => `
            <button
              class="simulation-speed-button${option.multiplier === speedMultiplier ? ' is-selected' : ''}"
              type="button"
              data-speed="${option.multiplier}"
              aria-label="${option.label}, ${option.multiplier} times speed"
              aria-pressed="${option.multiplier === speedMultiplier}"
            >${option.multiplier}×</button>
          `).join('')}
        </div>
      </div>
    </div>
    <span class="investigation-hover-hint" aria-hidden="true" hidden></span>
  `;

  section.querySelector('#observer-title').textContent = diagram.heading ?? 'Network Observer';
  decorateHeading(section.querySelector('#observer-title'), panelIconMappings.networkObserver);
  section.querySelector('#network-title').textContent = diagram.title;
  section.querySelector('#network-description').textContent = getNetworkDiagramDescription(diagram);

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const linesGroup = section.querySelector('.connection-lines');
  const devicesGroup = section.querySelector('.network-devices');
  const packetsGroup = section.querySelector('.network-packets');
  const hoverHint = section.querySelector('.investigation-hover-hint');
  hoverHint.append(createIcon('search', { size: 16 }));
  const observerStatusIndicator = section.querySelector('.observer-status-indicator');
  if (statusIndicator) {
    observerStatusIndicator.textContent = statusIndicator.label;
  }
  const clientSlotElements = [];
  const packetElements = new Map();
  const blockOverlay = section.querySelector('.tcp-filter');
  blockOverlay.querySelector('.traffic-block-label').textContent = blockOverlayLabel;
  blockOverlay.setAttribute(
    'transform',
    `translate(${diagram.server.x - 105} ${diagram.server.y})`,
  );
  let showHints = hintsEnabled;
  let latestSimulationState = null;

  // Applies mission-defined packet hints to the packet nodes already on screen.
  function updatePacketHints(state = latestSimulationState) {
    packetElements.forEach((element) => {
      element.classList.toggle(
        'is-hinted',
        Boolean(showHints && element.packetData && shouldHintPacket(element.packetData, state)),
      );
    });
  }

  // Updates the reusable client positions from the latest simulation state.
  function renderClients(state) {
    const clientsBySlot = new Map(
      state.visibleClients.map((client) => [client.slotIndex, client]),
    );

    clientSlotElements.forEach((slotElements, slotIndex) => {
      const client = clientsBySlot.get(slotIndex);
      const presentation = getClientPresentation(client, showHints, clientStatusLabels);
      const visibility = client ? 'visible' : 'hidden';
      if (client) {
        if (slotElements.label.textContent !== client.label) {
          slotElements.label.textContent = client.label;
        }
        if (slotElements.device.dataset.objectId !== client.id) {
          slotElements.device.dataset.objectId = client.id;
        }
        if (slotElements.device.getAttribute('aria-label') !== presentation.ariaLabel) {
          slotElements.device.setAttribute('aria-label', presentation.ariaLabel);
        }
        slotElements.device.investigationContext = { kind: 'client', client };
      } else {
        delete slotElements.device.dataset.objectId;
        slotElements.device.investigationContext = null;
        slotElements.device.removeAttribute('aria-label');
      }
      slotElements.device.classList.toggle(
        'is-hinted',
        Boolean(client && showHints && shouldHintClient(client, state)),
      );
      slotElements.device.classList.toggle('is-waiting', presentation?.isWaiting === true);
      slotElements.device.classList.toggle(
        'is-connected',
        ['connected', 'communicating'].includes(client?.state),
      );
      slotElements.device.classList.toggle(
        'is-connecting',
        Boolean(
          client
          && !['connected', 'communicating'].includes(client.state)
          && !presentation?.isWaiting,
        ),
      );
      slotElements.statusLabel.textContent = presentation?.statusLabel ?? '';
      slotElements.statusLabel.setAttribute(
        'visibility',
        client ? 'visible' : 'hidden',
      );
      if (slotElements.device.getAttribute('visibility') !== visibility) {
        slotElements.outboundPath.setAttribute('visibility', visibility);
        slotElements.inboundPath.setAttribute('visibility', visibility);
        slotElements.device.setAttribute('visibility', visibility);
      }
      const tabIndex = client ? '0' : '-1';
      if (slotElements.device.getAttribute('tabindex') !== tabIndex) {
        slotElements.device.setAttribute('tabindex', tabIndex);
      }
    });
  }

  // Places the magnifying-glass beside an investigable object.
  function showHoverHint(event) {
    hoverHint.hidden = false;
    hoverHint.style.left = `${event.clientX + 14}px`;
    hoverHint.style.top = `${event.clientY + 14}px`;
  }

  function hideHoverHint() {
    hoverHint.hidden = true;
  }

  // Adds mouse investigation behavior to an SVG element.
  function makeInvestigable(element, objectId, label, getContext = null) {
    // Sends the selected object's current data back to the mission page.
    function investigate() {
      const context = getContext ? getContext() : element.investigationContext;
      if (!context) return;
      onInvestigate(element.dataset.objectId, context);
    }

    element.classList.add('investigable');
    element.dataset.objectId = objectId;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `Investigate ${label}`);
    element.addEventListener('click', investigate);
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      investigate();
    });
    element.addEventListener('pointerenter', showHoverHint);
    element.addEventListener('pointermove', showHoverHint);
    element.addEventListener('pointerleave', hideHoverHint);
  }

  diagram.clients.forEach((client, slotIndex) => {
    const outboundPath = document.createElementNS(svgNamespace, 'path');
    outboundPath.classList.add('connection-path', 'connection-path--outbound');
    outboundPath.setAttribute(
      'd',
      `M ${client.x + 70} ${client.y - 9} L ${diagram.server.x - 80} ${diagram.server.y - 9}`,
    );
    outboundPath.setAttribute('marker-end', 'url(#packet-arrow-forward)');
    outboundPath.setAttribute('visibility', 'hidden');
    linesGroup.append(outboundPath);

    const inboundPath = document.createElementNS(svgNamespace, 'path');
    inboundPath.classList.add('connection-path', 'connection-path--inbound');
    inboundPath.setAttribute(
      'd',
      `M ${client.x + 70} ${client.y + 9} L ${diagram.server.x - 80} ${diagram.server.y + 9}`,
    );
    inboundPath.setAttribute('marker-start', 'url(#packet-arrow-reverse)');
    inboundPath.setAttribute('visibility', 'hidden');
    linesGroup.append(inboundPath);

    const device = document.createElementNS(svgNamespace, 'g');
    device.classList.add('network-device');
    device.setAttribute('visibility', 'hidden');
    device.setAttribute('transform', `translate(${client.x} ${client.y})`);
    device.innerHTML = `
      <rect class="network-device__card" x="-65" y="-40" width="130" height="80" rx="8"></rect>
      <g class="network-device__icon network-device__icon--client" aria-hidden="true">
        <rect x="-18" y="-27" width="36" height="24" rx="3"></rect>
        <path d="M-7 3h14M0-3v6"></path>
      </g>
      <circle class="network-device__state-dot" cx="49" cy="-25" r="4"></circle>
      <text class="network-device__label" y="15" text-anchor="middle" dominant-baseline="middle">${client.label}</text>
      <text class="network-device__status" y="30" text-anchor="middle" dominant-baseline="middle" visibility="hidden"></text>
    `;
    makeInvestigable(device, client.id, client.label);
    devicesGroup.append(device);
    clientSlotElements[slotIndex] = {
      outboundPath,
      inboundPath,
      device,
      label: device.querySelector('.network-device__label'),
      statusLabel: device.querySelector('.network-device__status'),
    };
  });

  const serverDevice = document.createElementNS(svgNamespace, 'g');
  serverDevice.classList.add('network-device', 'network-device--server');
  serverDevice.setAttribute(
    'transform',
    `translate(${diagram.server.x} ${diagram.server.y})`,
  );
  serverDevice.innerHTML = `
    <rect class="network-device__card" x="-75" y="-55" width="150" height="110" rx="10"></rect>
    <g class="network-device__icon network-device__icon--server" aria-hidden="true">
      <rect x="-28" y="-38" width="56" height="19" rx="3"></rect>
      <rect x="-28" y="-15" width="56" height="19" rx="3"></rect>
      <circle cx="17" cy="-28.5" r="2"></circle>
      <circle cx="17" cy="-5.5" r="2"></circle>
      <path d="M-19-29h20M-19-6h20"></path>
    </g>
    <circle class="network-device__state-dot" cx="58" cy="-39" r="5"></circle>
    <text class="network-device__label" y="24" text-anchor="middle" dominant-baseline="middle">${diagram.server.label}</text>
    <text class="network-device__status" y="42" text-anchor="middle" dominant-baseline="middle">Online</text>
  `;
  makeInvestigable(serverDevice, diagram.server.id, diagram.server.label);
  serverDevice.investigationContext = {
    kind: diagram.server.investigationKind ?? 'server',
  };
  devicesGroup.append(serverDevice);
  const serverStatus = serverDevice.querySelector('.network-device__status');

  function renderServer(state) {
    const presentation = getServerState(state);
    serverDevice.classList.toggle('is-under-pressure', presentation.underPressure === true);
    serverDevice.classList.toggle('is-recovering', presentation.recovering === true);
    serverDevice.classList.toggle('is-protected', presentation.protected === true);
    serverStatus.textContent = presentation.statusLabel;
    blockOverlay.toggleAttribute('hidden', presentation.showBlockOverlay !== true);
    blockOverlay.classList.toggle('is-active', presentation.blockOverlayActive === true);
  }

  const playButton = section.querySelector('[data-action="play"]');
  const pauseButton = section.querySelector('[data-action="pause"]');
  const speedButtons = [...section.querySelectorAll('[data-speed]')];

  // Creates, moves, and removes packet elements 
  function renderPackets(packets) {
    // Packet IDs let existing SVG nodes move each frame without recreating the whole diagram.
    const activePacketIds = new Set(packets.map((packet) => packet.id));
    packetElements.forEach((element, packetId) => {
      if (!activePacketIds.has(packetId)) {
        element.remove();
        packetElements.delete(packetId);
      }
    });

    clientSlotElements.forEach(({ outboundPath, inboundPath }) => {
      outboundPath.classList.remove('is-active');
      inboundPath.classList.remove('is-active');
    });

    packets.forEach((packet) => {
      let element = packetElements.get(packet.id);
      if (!element) {
        element = document.createElementNS(svgNamespace, 'g');
        element.classList.add('network-packet');
        element.innerHTML = `
          <rect class="network-packet__hit-area" x="-60" y="-25" width="120" height="50" rx="10"></rect>
          <rect class="network-packet__body" x="-56" y="-21" width="112" height="42" rx="8"></rect>
          <text class="network-packet__type" y="-7" text-anchor="middle" dominant-baseline="middle"></text>
          <text class="network-packet__route" y="9" text-anchor="middle" dominant-baseline="middle"></text>
        `;
        if (isPacketInvestigable(packet)) {
          makeInvestigable(element, packet.id, `${packet.type} packet`);
        }
        packetsGroup.append(element);
        packetElements.set(packet.id, element);
      }
      if (isPacketInvestigable(packet)) {
        element.dataset.objectId = packet.id;
        element.investigationContext = { kind: 'packet', packet };
      }
      element.packetData = packet;
      element.classList.toggle(
        'is-hinted',
        Boolean(showHints && shouldHintPacket(packet, latestSimulationState)),
      );
      const position = getPacketVisualPosition(packet, diagram);
      element.classList.toggle('is-server-bound', packet.direction === 'client-to-server');
      element.classList.toggle('is-client-bound', packet.direction === 'server-to-client');
      element.classList.toggle('uses-syn-cookie', packet.usesSynCookie === true);
      element.classList.toggle('will-be-blocked', packet.willBeBlocked === true);
      element.classList.toggle(
        'is-attack-traffic',
        Boolean(attackPacketType) && packet.isAttack === true && packet.type === attackPacketType,
      );
      element.setAttribute('transform', `translate(${position.x} ${position.y})`);
      element.setAttribute(
        'aria-label',
        `Investigate ${packet.type} packet from ${packet.sourceLabel} to ${packet.destinationLabel}`,
      );
      element.querySelector('.network-packet__type').textContent =
        packet.usesSynCookie ? `${packet.type} · Cookie` : packet.type;
      element.querySelector('.network-packet__route').textContent =
        `${packet.sourceLabel} → ${packet.destinationLabel}`;
      const slotElements = clientSlotElements[packet.slotIndex];
      const activePath = packet.direction === 'client-to-server'
        ? slotElements?.outboundPath
        : slotElements?.inboundPath;
      activePath?.classList.add('is-active');
    });
  }

  const simulation = createSimulation({
    clients: diagram.clients,
    server: diagram.server,
    speedMultiplier,
    onPacketsChange: renderPackets,
    
    onStateChange(state) {
      latestSimulationState = state;
      playButton.classList.toggle('is-active', state.isPlaying);
      pauseButton.classList.toggle('is-active', !state.isPlaying);
      playButton.setAttribute('aria-pressed', state.isPlaying);
      pauseButton.setAttribute('aria-pressed', !state.isPlaying);
      observerStatusIndicator.hidden = !statusIndicator?.isActive(state);
      if (!observerStatusIndicator.hidden) {
        observerStatusIndicator.textContent = statusIndicator.getLabel?.(state)
          ?? statusIndicator.label;
      }
      section.querySelector('.network-diagram').classList.toggle('is-paused', !state.isPlaying);
      renderClients(state);
      updatePacketHints(state);
      renderServer(state);
      onStateChange(state);
    },
  });

  // Starts or resumes the simulation from the Play button.
  playButton.addEventListener('click', () => simulation.play());
  // Freezes the simulation from the Pause button.
  pauseButton.addEventListener('click', () => simulation.pause());
  // Changes the live simulation speed, highlights its button, and saves the preference.
  speedButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const multiplier = Number(button.dataset.speed);
      speedButtons.forEach((speedButton) => {
        const selected = speedButton === button;
        speedButton.classList.toggle('is-selected', selected);
        speedButton.setAttribute('aria-pressed', selected);
      });
      simulation.setSpeed(multiplier);
      onSpeedChange(multiplier);
    });
  });
  // Resets the simulation
  section.querySelector('[data-action="restart"]').addEventListener('click', () => {
    simulation.reset();
    hideHoverHint();
    onRestart();
  });

  return {
    element: section,
    simulation,
    // Highlights the SVG object selected by the player.
    selectObject(objectId) {
      section.querySelectorAll('.investigable').forEach((element) => {
        element.classList.toggle('is-selected', element.dataset.objectId === objectId);
      });
    },
    // Removes the selection highlight from every investigable object.
    clearSelection() {
      section.querySelectorAll('.investigable').forEach((element) => {
        element.classList.remove('is-selected');
      });
    },
    // Turns mission-defined client and packet hints on or off without restarting.
    setHints(isEnabled) {
      showHints = Boolean(isEnabled);
      latestSimulationState = simulation.getState();
      renderClients(latestSimulationState);
      updatePacketHints(latestSimulationState);
    },
  };
}
