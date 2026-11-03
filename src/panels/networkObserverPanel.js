/**
 * Renders a client/server diagram as an interactive SVG and
 * connects its controls and investigable objects to the mission page.
 */


export function createNetworkObserverPanel({
  diagram,
  createSimulation,
  statusIndicator = null,
  isPacketInvestigable = () => true,
  shouldHintClient = () => false,
  onStateChange,
  onInvestigate = () => {},
  onRestart = () => {},
  speedMultiplier = 1,
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
    <svg class="network-diagram" viewBox="${diagram.viewBox ?? '0 0 900 420'}" role="img" aria-labelledby="network-title network-description">
      <title id="network-title"></title>
      <desc id="network-description"></desc>

      <g class="connection-lines"></g>
      <g class="network-packets"></g>
      <g class="network-devices"></g>
    </svg>
    <div class="simulation-controls" aria-label="Simulation controls">
      <button type="button" data-action="play" aria-pressed="false">Play</button>
      <button type="button" data-action="pause" aria-pressed="false">Pause</button>
      <button type="button" data-action="restart">Restart</button>
    </div>
    <span class="investigation-hover-hint" aria-hidden="true" hidden>🔍</span>
  `;

  section.querySelector('#observer-title').textContent = diagram.heading ?? 'Network Observer';
  section.querySelector('#network-title').textContent = diagram.title;
  section.querySelector('#network-description').textContent = diagram.description;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const linesGroup = section.querySelector('.connection-lines');
  const devicesGroup = section.querySelector('.network-devices');
  const packetsGroup = section.querySelector('.network-packets');
  const hoverHint = section.querySelector('.investigation-hover-hint');
  const observerStatusIndicator = section.querySelector('.observer-status-indicator');
  if (statusIndicator) {
    observerStatusIndicator.textContent = statusIndicator.label;
  }
  const clientSlotElements = [];
  const visibleClientsBySlot = new Map();
  const packetElements = new Map();
  let showHints = hintsEnabled;

  // Updates the reusable client positions from the latest simulation state.
  function renderClients(state) {
    // SVG positions are reusable slots; the client occupying a slot changes over time.
    visibleClientsBySlot.clear();
    state.visibleClients.forEach((client) => {
      visibleClientsBySlot.set(client.slotIndex, client);
    });

    clientSlotElements.forEach((slotElements, slotIndex) => {
      const client = visibleClientsBySlot.get(slotIndex);
      const visibility = client ? 'visible' : 'hidden';
      if (client) {
        slotElements.label.textContent = client.label;
        slotElements.device.dataset.objectId = client.id;
        slotElements.device.investigationContext = { kind: 'client', client };
        slotElements.device.setAttribute('aria-label', `Investigate ${client.label}`);
      } else {
        delete slotElements.device.dataset.objectId;
        slotElements.device.investigationContext = null;
      }
      slotElements.device.classList.toggle(
        'is-hinted',
        Boolean(client && showHints && shouldHintClient(client, state)),
      );
      slotElements.line.setAttribute('visibility', visibility);
      slotElements.connectionHitArea.setAttribute('visibility', visibility);
      slotElements.device.setAttribute('visibility', visibility);
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
    element.addEventListener('pointerenter', showHoverHint);
    element.addEventListener('pointermove', showHoverHint);
    element.addEventListener('pointerleave', hideHoverHint);
  }

  diagram.clients.forEach((client, slotIndex) => {
    const line = document.createElementNS(svgNamespace, 'line');
    line.setAttribute('x1', client.x + 55);
    line.setAttribute('y1', client.y);
    line.setAttribute('x2', diagram.server.x - 65);
    line.setAttribute('y2', diagram.server.y);
    line.setAttribute('visibility', 'hidden');
    linesGroup.append(line);

    const connectionHitArea = line.cloneNode();
    connectionHitArea.classList.add('connection-hit-area');
    connectionHitArea.setAttribute('visibility', 'hidden');
    makeInvestigable(
      connectionHitArea,
      `connection-${slotIndex}`,
      `packet connection between ${client.label} and ${diagram.server.label}`,
    );
    linesGroup.append(connectionHitArea);

    const device = document.createElementNS(svgNamespace, 'g');
    device.classList.add('network-device');
    device.setAttribute('visibility', 'hidden');
    device.setAttribute('transform', `translate(${client.x} ${client.y})`);
    device.innerHTML = `
      <rect x="-55" y="-30" width="110" height="60" rx="4"></rect>
      <text text-anchor="middle" dominant-baseline="middle">${client.label}</text>
    `;
    makeInvestigable(device, client.id, client.label, () => {
      const visibleClient = visibleClientsBySlot.get(slotIndex);
      return visibleClient
        ? { kind: client.investigationKind ?? 'client', client: visibleClient }
        : null;
    });
    devicesGroup.append(device);
    clientSlotElements[slotIndex] = {
      line,
      connectionHitArea,
      device,
      label: device.querySelector('text'),
    };
  });

  const serverDevice = document.createElementNS(svgNamespace, 'g');
  serverDevice.classList.add('network-device', 'network-device--server');
  serverDevice.setAttribute(
    'transform',
    `translate(${diagram.server.x} ${diagram.server.y})`,
  );
  serverDevice.innerHTML = `
    <rect x="-65" y="-45" width="130" height="90" rx="4"></rect>
    <text text-anchor="middle" dominant-baseline="middle">${diagram.server.label}</text>
  `;
  makeInvestigable(serverDevice, diagram.server.id, diagram.server.label);
  serverDevice.investigationContext = {
    kind: diagram.server.investigationKind ?? 'server',
  };
  devicesGroup.append(serverDevice);

  const playButton = section.querySelector('[data-action="play"]');
  const pauseButton = section.querySelector('[data-action="pause"]');

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

    packets.forEach((packet) => {
      let element = packetElements.get(packet.id);
      if (!element) {
        element = document.createElementNS(svgNamespace, 'g');
        element.classList.add('network-packet');
        element.innerHTML = `
          <rect class="network-packet__hit-area" x="-38" y="-21" width="76" height="42"></rect>
          <rect class="network-packet__body" x="-34" y="-17" width="68" height="34" rx="3"></rect>
          <text class="network-packet__label" text-anchor="middle" dominant-baseline="middle"></text>
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
      element.setAttribute('transform', `translate(${packet.x} ${packet.y})`);
      element.setAttribute(
        'aria-label',
        `Investigate ${packet.type} packet from ${packet.sourceId} to ${packet.destinationId}`,
      );
      element.querySelector('.network-packet__label').textContent = packet.type;
      const slotElements = clientSlotElements[packet.slotIndex];
      if (slotElements && isPacketInvestigable(packet)) {
        slotElements.connectionHitArea.dataset.objectId = packet.id;
        slotElements.connectionHitArea.investigationContext = {
          kind: 'packet',
          packet,
        };
        slotElements.connectionHitArea.setAttribute(
          'aria-label',
          `Investigate ${packet.type} packet path`,
        );
      }
    });
  }

  const simulation = createSimulation({
    clients: diagram.clients,
    server: diagram.server,
    speedMultiplier,
    onPacketsChange: renderPackets,
    
    onStateChange(state) {
      playButton.classList.toggle('is-active', state.isPlaying);
      pauseButton.classList.toggle('is-active', !state.isPlaying);
      playButton.setAttribute('aria-pressed', state.isPlaying);
      pauseButton.setAttribute('aria-pressed', !state.isPlaying);
      observerStatusIndicator.hidden = !statusIndicator?.isActive(state);
      renderClients(state);
      onStateChange(state);
    },
  });

  // Starts or resumes the simulation from the Play button.
  playButton.addEventListener('click', () => simulation.play());
  // Freezes the simulation from the Pause button.
  pauseButton.addEventListener('click', () => simulation.pause());
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
    // Turns mission-defined client hints on or off without restarting the simulation.
    setHints(isEnabled) {
      showHints = Boolean(isEnabled);
      renderClients(simulation.getState());
    },
  };
}
