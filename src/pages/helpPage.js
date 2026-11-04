import { createNavigationPanel } from '../panels/navigationPanel.js';
import { networkGlossaryById } from '../glossary/networkGlossary.js';
import { createIcon, decorateHeading, gameFlowIconMappings } from '../icons/iconSystem.js';

const steps = [
  ['Observe', 'Watch clients, packets, and servers communicate normally. As the scenario develops, look for changes or unusual behavior.'],
  ['Investigate', 'Select network objects such as clients, servers, packets, and connections to learn what they are doing.'],
  ['Collect Evidence', 'Save important observations from the Investigation panel. Evidence helps explain what is happening on the network.'],
  ['Report Attack', 'Use your observations and evidence to select the attack that best matches the behavior. Incorrect answers provide feedback and can be retried.'],
  ['Mitigate', 'After identifying the attack, choose an appropriate defense. Incorrect defenses also provide feedback and can be retried.'],
  ['Complete', 'Finish the mission after the network has been defended. Missions must be completed in order, and the final mission unlocks after Levels One through Four.'],
];

const controls = [
  ['Network Observer', 'The main mission area. Devices, connection lines, and moving packets represent network activity.', 'network'],
  ['Play', 'Starts or resumes the network simulation.', 'play'],
  ['Pause', 'Temporarily stops the simulation so you can examine the network more closely.', 'pause'],
  ['Restart', 'Restarts the simulation and clears temporary mission state such as investigations, evidence, and unanswered reports.', 'rotate-ccw'],
  ['Investigate', 'Selects a network object and opens information about its current role and behavior.', 'search'],
  ['Learn More', 'Expands an additional beginner-friendly explanation about the selected object or concept.', 'book-open'],
  ['Evidence Collected', 'Lists observations you saved while investigating. At least one evidence item is required before reporting an attack.', 'clipboard-list'],
  ['Network Statistics', 'Shows measurements of network activity. The measurements can change between missions and attack types.', 'chart-no-axes-combined'],
  ['Report Attack', 'Lets you identify the suspected attack after collecting evidence.', 'triangle-alert'],
  ['Mitigate', 'Lets you select a defense after correctly identifying the attack.', 'shield-check'],
];

const fundamentals = [
  ['Client', 'A device or application that requests information or services from another device called a server. For example, a web browser acts as a client when requesting a web page.', 'monitor'],
  ['Server', 'A device or application that provides information or services to clients over a network. A web server receives requests from clients and sends back web pages or other resources.', 'server'],
  ['Router', 'A network device that forwards packets between different networks so they can reach the correct destination. Routers examine the destination IP address to determine where packets should be sent next.', 'router'],
  ['Packet', 'A unit of data transmitted over a network. Packets contain information needed to deliver the data, such as source and destination addresses, as well as the data being transmitted.', 'package'],
  ['IP Address', 'A numerical address used to uniquely identify network devices and help deliver packets to the correct destination. It works somewhat like a mailing address for network communication. Example IP Address: 129.0.2.15', 'network'],
  ['Port', 'A number that helps a device direct incoming information to the correct application or service. It works somewhat like a room number within a building. Example Port Number: 30', 'send'],
  ['Connection', 'A communication link established between two devices or applications so they can exchange information. Some types of communication, such as TCP, require a connection to be established first.', 'network'],
];

const topics = [
  ['getting-started', 'Getting Started', 'book-open'],
  ['game-controls', 'Game Controls', 'settings'],
  ['network-basics', 'Network Basics', 'network'],
  ['network-communication', 'Network Communication', 'send'],
  ['dos-ddos', 'DoS & DDoS Attacks', 'shield-alert'],
];

function topicShell(id, title) {
  const article = document.createElement('article');
  article.className = 'help-topic';
  article.dataset.topic = id;
  article.setAttribute('aria-labelledby', `help-topic-${id}`);
  article.innerHTML = `<h2 id="help-topic-${id}" tabindex="-1">${title}</h2>`;
  return article;
}

function createGettingStarted() {
  const article = topicShell('getting-started', 'Getting Started');
  article.insertAdjacentHTML('beforeend', `
    <section class="help-content-section help-welcome" aria-labelledby="help-welcome-title">
      <h3 id="help-welcome-title">Welcome to FloodWatch</h3>
      <div class="help-reading-width">
        <p>FloodWatch is an educational network-security simulation. You play as a <strong>Network Defender</strong> responsible for monitoring traffic and keeping a web server available to legitimate users.</p>
        <p>During each mission, you observe network activity, investigate objects, collect evidence, report a suspected attack, and select a defense. Missions become more challenging as you learn how different denial-of-service attacks affect a network.</p>
        <p>FloodWatch is a learning simulation. Its network objects and traffic are simplified so new defenders can understand the main ideas before studying the protocols in greater detail.</p>
      </div>
    </section>
    <section class="help-content-section" aria-labelledby="help-play-title">
      <h3 id="help-play-title">How to Play</h3>
      <ol class="help-step-grid"></ol>
    </section>
  `);
  const list = article.querySelector('.help-step-grid');
  steps.forEach(([title, description], index) => {
    const item = document.createElement('li');
    item.className = 'help-step-card';
    item.innerHTML = `<span class="help-step-number" aria-hidden="true">${index + 1}</span><span class="help-card-icon" aria-hidden="true"></span><div><h4>${title}</h4><p>${description}</p></div>`;
    item.querySelector('.help-card-icon').append(createIcon(gameFlowIconMappings[title], { size: 19 }));
    list.append(item);
  });
  return article;
}

function createCardGrid(items, className = '') {
  const list = document.createElement('dl');
  list.className = `help-card-grid ${className}`;
  items.forEach(([term, definition, iconName]) => {
    const card = document.createElement('div');
    card.className = 'help-info-card';
    const heading = document.createElement('dt');
    heading.append(createIcon(iconName, { size: 19 }), document.createTextNode(term));
    const description = document.createElement('dd');
    description.textContent = definition;
    card.append(heading, description);
    list.append(card);
  });
  return list;
}

function createGameControls() {
  const article = topicShell('game-controls', 'Game Controls and Features');
  article.append(createCardGrid(controls, 'help-control-grid'));
  return article;
}

function createNetworkDiagram() {
  const section = document.createElement('section');
  section.className = 'help-network-basics';
  section.setAttribute('aria-labelledby', 'network-basics-demo-title');
  section.innerHTML = `
    <h3 id="network-basics-demo-title">Interactive Network Basics</h3>
    <div class="help-network-demo">
      <div class="help-network-visual">
        <svg class="help-network-diagram" viewBox="0 0 720 270" role="group" aria-labelledby="help-network-title help-network-description">
          <title id="help-network-title">Client, router, and server communication</title>
          <desc id="help-network-description">A client sends a request packet through a router to a server. A response packet travels from the server through the router to the client. Select any component for its definition.</desc>
          <defs><marker id="help-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 8 4 0 8Z"></path></marker></defs>
          <path class="help-network-path help-network-path--request" d="M135 115 H585" marker-end="url(#help-arrow)"></path>
          <path class="help-network-path help-network-path--response" d="M585 155 H135" marker-end="url(#help-arrow)"></path>
          <g class="help-network-devices"></g><g class="help-network-packets"></g>
        </svg>
        <div class="help-component-controls" aria-label="Select a network component"></div>
      </div>
      <aside class="help-network-information" aria-live="polite"></aside>
    </div>
  `;
  const ns = 'http://www.w3.org/2000/svg';
  const devices = section.querySelector('.help-network-devices');
  const packets = section.querySelector('.help-network-packets');
  const buttons = section.querySelector('.help-component-controls');
  const information = section.querySelector('.help-network-information');
  const selectables = [];

  function select(glossaryId, key) {
    const entry = networkGlossaryById.get(glossaryId);
    information.innerHTML = '<h4>More Information</h4>';
    const term = document.createElement('h5');
    term.textContent = entry.term;
    const definition = document.createElement('p');
    definition.textContent = entry.definition;
    information.append(term, definition);
    selectables.forEach(({ element, id }) => {
      const selected = id === key;
      element.classList.toggle('is-selected', selected);
      element.setAttribute('aria-pressed', String(selected));
    });
  }

  function interactive(element, glossaryId, label, key) {
    element.classList.add('help-network-object');
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `Learn more about ${label}`);
    element.setAttribute('aria-pressed', 'false');
    const activate = () => select(glossaryId, key);
    element.addEventListener('click', activate);
    element.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      activate();
    });
    selectables.push({ element, id: key });
  }

  const positions = [['client', 90, 'Client', 'monitor'], ['router', 360, 'Router', 'router'], ['server', 630, 'Server', 'server']];
  positions.forEach(([id, x, label, icon]) => {
    const device = document.createElementNS(ns, 'g');
    device.setAttribute('transform', `translate(${x} 135)`);
    const symbols = {
      client: '<rect x="-18" y="-25" width="36" height="24" rx="3"></rect><path d="M-8 5h16M0-1v6"></path>',
      router: '<rect x="-22" y="-18" width="44" height="25" rx="5"></rect><path d="M-12-6h24M-8-11-13-6-8-1M8-11 13-6 8-1"></path>',
      server: '<rect x="-24" y="-29" width="48" height="17" rx="3"></rect><rect x="-24" y="-8" width="48" height="17" rx="3"></rect><circle cx="15" cy="-20.5" r="2"></circle><circle cx="15" cy=".5" r="2"></circle>',
    };
    device.innerHTML = `<rect class="help-device-card" x="-58" y="-47" width="116" height="94" rx="10"></rect><g class="help-device-symbol" aria-hidden="true">${symbols[id]}</g><text y="31" text-anchor="middle">${label}</text>`;
    interactive(device, id, label, id);
    devices.append(device);
    const button = document.createElement('button');
    button.type = 'button';
    button.append(createIcon(icon, { size: 17 }), document.createTextNode(label));
    interactive(button, id, label, id);
    buttons.append(button);
  });

  const packetLegs = [
    ['request-client-router', 'request packet from client to router', '0s'],
    ['request-router-server', 'request packet from router to server', '0s'],
    ['response-server-router', 'response packet from server to router', '0s'],
    ['response-router-client', 'response packet from router to client', '0s'],
  ];
  packetLegs.forEach(([leg, label, delay]) => {
    const packet = document.createElementNS(ns, 'g');
    packet.classList.add('help-network-packet', `help-network-packet--${leg}`);
    packet.innerHTML = '<rect x="-31" y="-15" width="62" height="30" rx="7"></rect><text text-anchor="middle" dominant-baseline="middle">Packet</text>';
    packet.style.setProperty('--packet-delay', delay);
    interactive(packet, 'packet', label, 'packet');
    packets.append(packet);
  });
  const packetButton = document.createElement('button');
  packetButton.type = 'button';
  packetButton.append(createIcon('package', { size: 17 }), document.createTextNode('Packet'));
  interactive(packetButton, 'packet', 'packet', 'packet');
  buttons.append(packetButton);
  select('client', 'client');
  return section;
}

function createNetworkBasics() {
  const article = topicShell('network-basics', 'Network Fundamentals');
  article.append(createNetworkDiagram());
  const section = document.createElement('section');
  section.className = 'help-content-section';
  section.innerHTML = '<h3>Network Fundamentals Definitions</h3>';
  section.append(createCardGrid(fundamentals, 'help-definition-grid'));
  section.insertAdjacentHTML('beforeend', '<div class="help-flow" aria-label="Basic request and response flow"><span>Client request</span><b aria-hidden="true">→</b><span>Router</span><b aria-hidden="true">→</b><span>Server</span><b aria-hidden="true">→</b><span>Response to client</span></div>');
  article.append(section);
  return article;
}

function createCommunication() {
  const article = topicShell('network-communication', 'Understanding Network Communication');
  article.insertAdjacentHTML('beforeend', `
    <section class="help-communication-section"><h3>TCP Three-Way Handshake</h3><p>TCP establishes a connection before exchanging application data:</p><ol><li>The client sends a <strong>SYN</strong> packet to request a connection.</li><li>The server responds with a <strong>SYN-ACK</strong> packet.</li><li>The client sends an <strong>ACK</strong> packet, completing the connection.</li></ol><div class="help-protocol-flow" aria-label="TCP three-way handshake"><div><span>Client</span><b>→ SYN →</b><span>Server</span></div><div><span>Server</span><b>→ SYN-ACK →</b><span>Client</span></div><div><span>Client</span><b>→ ACK →</b><span>Server</span></div></div></section>
    <section class="help-communication-section"><h3>UDP Communication</h3><p>UDP is connectionless. A device can send independent messages called datagrams without first completing TCP's three-way handshake. UDP does not guarantee delivery or automatically put lost datagrams back in order.</p></section>
    <section class="help-communication-section"><h3>HTTP Request and Response</h3><p>A browser sends an HTTP request for a webpage or resource. The web server processes it and returns an HTTP response. Large numbers of repeated or resource-intensive requests can place additional load on the server.</p><div class="help-protocol-flow help-protocol-flow--compact" aria-label="HTTP request and response"><div><span>Client</span><b>→ Request →</b><span>Server</span></div><div><span>Server</span><b>→ Response →</b><span>Client</span></div></div></section>
    <section class="help-communication-section"><h3>DNS Resolution</h3><ol class="help-numbered-flow"><li>A client wants to access a website by its domain name.</li><li>The client sends a query to a DNS resolver.</li><li>The resolver returns the relevant IP address.</li><li>The client uses that address to contact the website's server.</li></ol></section>
    <section class="help-communication-section"><h3>Reading the Network Observer</h3><p>Packets moving toward a server represent client traffic, while packets returning toward clients represent server responses. Multiple clients may communicate at once. During later scenarios, changes in traffic volume and network statistics can help reveal abnormal behavior. Packet meanings are explained within each mission rather than assigned a universal color or symbol.</p></section>
  `);
  return article;
}

function createAttacks() {
  const article = topicShell('dos-ddos', 'Introduction to Denial of Service Attacks');
  article.insertAdjacentHTML('beforeend', '<section class="help-attack-intro"><span class="help-card-icon" aria-hidden="true"></span><p><strong>Denial of Service</strong>: An attack that tries to make a website or service unavailable to normal users, often by overwhelming it with too much traffic.</p></section>');
  article.querySelector('.help-card-icon').append(createIcon('shield-alert', { size: 24 }));
  return article;
}

const renderers = {
  'getting-started': createGettingStarted,
  'game-controls': createGameControls,
  'network-basics': createNetworkBasics,
  'network-communication': createCommunication,
  'dos-ddos': createAttacks,
};

export function renderHelpPage({ returnRoute = null } = {}) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  main.className = 'page-layout help-page';
  main.innerHTML = `
    <header class="panel help-header"><div><h1>Help Center</h1><p>Learn how to play FloodWatch and review the network basics used in each mission.</p></div>${returnRoute ? `<a class="button-link" href="#${returnRoute}">Return to Active Mission</a>` : '<a class="button-link" href="#home">Return to Home</a>'}</header>
    <div class="help-center"><nav class="panel help-topic-navigation" aria-label="Help topics"><h2>Topics</h2><div class="help-topic-buttons"></div></nav><section class="panel help-topic-content" aria-live="polite"></section></div>
  `;
  decorateHeading(main.querySelector('.help-header h1'), 'circle-help', { size: 24 });
  const buttonContainer = main.querySelector('.help-topic-buttons');
  const content = main.querySelector('.help-topic-content');
  let activeTopicId;
  function selectTopic(id, moveFocus = false) {
    if (!renderers[id]) return;
    if (id === activeTopicId) {
      if (moveFocus) content.querySelector('.help-topic > h2')?.focus({ preventScroll: true });
      return;
    }
    activeTopicId = id;
    const topic = renderers[id]();
    content.replaceChildren(topic);
    buttonContainer.querySelectorAll('button').forEach((button) => {
      const selected = button.dataset.topic === id;
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (moveFocus) topic.querySelector('h2').focus({ preventScroll: true });
  }
  topics.forEach(([id, label, icon]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.topic = id;
    button.append(createIcon(icon, { size: 19 }), document.createTextNode(label));
    button.addEventListener('click', () => selectTopic(id, true));
    buttonContainer.append(button);
  });
  selectTopic('getting-started');
  page.append(createNavigationPanel(), main);
  return page;
}
