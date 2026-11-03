import { createNavigationPanel } from '../panels/navigationPanel.js';
import { applyGlossaryTerms } from '../glossary/glossaryText.js';

const helpSections = [
  {
    id: 'welcome',
    title: 'Welcome to FloodWatch',
    content: `
      <p>
        FloodWatch is an educational network-security simulation. You play as a
        <strong>Network Defender</strong> responsible for monitoring traffic and keeping a web
        server available to legitimate users.
      </p>
      <p>
        During each mission, you observe network activity, investigate objects, collect evidence,
        report a suspected attack, and select a defense. Missions become more challenging as you
        learn how different denial-of-service attacks affect a network.
      </p>
      <p>
        FloodWatch is a learning simulation. Its network objects and traffic are simplified so new
        defenders can understand the main ideas before studying the protocols in greater detail.
      </p>
    `,
  },
  {
    id: 'how-to-play',
    title: 'How to Play',
    content: `
      <ol class="help-steps">
        <li><strong>Observe:</strong> Watch clients, packets, and servers communicate normally. As the scenario develops, look for changes or unusual behavior.</li>
        <li><strong>Investigate:</strong> Select network objects such as clients, servers, packets, and connections to learn what they are doing.</li>
        <li><strong>Collect Evidence:</strong> Save important observations from the Investigation panel. Evidence helps explain what is happening on the network.</li>
        <li><strong>Report Attack:</strong> Use your observations and evidence to select the attack that best matches the behavior. Incorrect answers provide feedback and can be retried.</li>
        <li><strong>Mitigate:</strong> After identifying the attack, choose an appropriate defense. Incorrect defenses also provide feedback and can be retried.</li>
        <li><strong>Complete:</strong> Finish the mission after the network has been defended. Missions must be completed in order, and the final mission unlocks after Levels One through Four.</li>
      </ol>
      <div class="help-flow" aria-label="Game flow">
        <span>Observe</span><b aria-hidden="true">→</b><span>Investigate</span><b aria-hidden="true">→</b><span>Report</span><b aria-hidden="true">→</b><span>Defend</span><b aria-hidden="true">→</b><span>Complete</span>
      </div>
    `,
  },
  {
    id: 'controls',
    title: 'Game Controls and Features',
    content: `
      <dl class="help-definitions">
        <div><dt>Network Observer</dt><dd>The main mission area. Devices, connection lines, and moving packets represent network activity.</dd></div>
        <div><dt>Play</dt><dd>Starts or resumes the network simulation.</dd></div>
        <div><dt>Pause</dt><dd>Temporarily stops the simulation so you can examine the network more closely.</dd></div>
        <div><dt>Restart</dt><dd>Restarts the simulation and clears temporary mission state such as investigations, evidence, and unanswered reports.</dd></div>
        <div><dt>Investigate</dt><dd>Selects a network object and opens information about its current role and behavior.</dd></div>
        <div><dt>Learn More</dt><dd>Expands an additional beginner-friendly explanation about the selected object or concept.</dd></div>
        <div><dt>Evidence Collected</dt><dd>Lists observations you saved while investigating. At least one evidence item is required before reporting an attack.</dd></div>
        <div><dt>Network Statistics</dt><dd>Shows measurements of network activity. The measurements can change between missions and attack types.</dd></div>
        <div><dt>Report Attack</dt><dd>Lets you identify the suspected attack after collecting evidence.</dd></div>
        <div><dt>Mitigate</dt><dd>Lets you select a defense after correctly identifying the attack.</dd></div>
      </dl>
    `,
  },
  {
    id: 'fundamentals',
    title: 'Network Fundamentals',
    content: `
      <dl class="help-definitions">
        <div><dt>Client</dt><dd>A device or application that requests information or services from another device called a server. For example, a web browser acts as a client when requesting a web page.</dd></div>
        <div><dt>Server</dt><dd>A device or application that provides information or services to clients over a network. A web server receives requests from clients and sends back web pages or other resources.</dd></div>
        <div><dt>Router</dt><dd>A network device that forwards packets between different networks so they can reach the correct destination. Routers examine the destination IP address to determine where packets should be sent next.</dd></div>
        <div><dt>Packet</dt><dd>A unit of data transmitted over a network. Packets contain information needed to deliver the data, such as source and destination addresses, as well as the data being transmitted.</dd></div>
        <div><dt>IP Address</dt><dd>A numerical address used to uniquely identify network devices and help deliver packets to the correct destination. It works somewhat like a mailing address for network communication. Example IP Address: 129.0.2.15</dd></div>
        <div><dt>Port</dt><dd>A number that helps a device direct incoming information to the correct application or service. It works somewhat like a room number within a building. Example Port Number: 30</dd></div>
        <div><dt>Connection</dt><dd>A communication link established between two devices or applications so they can exchange information. Some types of communication, such as TCP, require a connection to be established first.</dd></div>
      </dl>
      <div class="help-flow" aria-label="Basic request and response flow">
        <span>Client request</span><b aria-hidden="true">→</b><span>Router</span><b aria-hidden="true">→</b><span>Server</span><b aria-hidden="true">→</b><span>Response to client</span>
      </div>
    `,
  },
  {
    id: 'communication',
    title: 'Understanding Network Communication',
    content: `
      <h3>TCP Three-Way Handshake</h3>
      <p>TCP establishes a connection before exchanging application data:</p>
      <ol>
        <li>The client sends a <strong>SYN</strong> packet to request a connection.</li>
        <li>The server responds with a <strong>SYN-ACK</strong> packet.</li>
        <li>The client sends an <strong>ACK</strong> packet, completing the connection.</li>
      </ol>
      <div class="help-flow" aria-label="TCP three-way handshake"><span>SYN</span><b aria-hidden="true">→</b><span>SYN-ACK</span><b aria-hidden="true">→</b><span>ACK</span></div>

      <h3>UDP Communication</h3>
      <p>UDP is connectionless. A device can send independent messages called datagrams without first completing TCP's three-way handshake. UDP does not guarantee delivery or automatically put lost datagrams back in order.</p>

      <h3>HTTP Request and Response</h3>
      <p>A browser sends an HTTP request for a webpage or resource. The web server processes it and returns an HTTP response. Large numbers of repeated or resource-intensive requests can place additional load on the server.</p>

      <h3>DNS Resolution</h3>
      <ol>
        <li>A client wants to access a website by its domain name.</li>
        <li>The client sends a query to a DNS resolver.</li>
        <li>The resolver returns the relevant IP address.</li>
        <li>The client uses that address to contact the website's server.</li>
      </ol>

      <h3>Reading the Network Observer</h3>
      <p>Packets moving toward a server represent client traffic, while packets returning toward clients represent server responses. Multiple clients may communicate at once. During later scenarios, changes in traffic volume and network statistics can help reveal abnormal behavior. Packet meanings are explained within each mission rather than assigned a universal color or symbol.</p>
    `,
  },
  {
    id: 'dos-ddos',
    title: 'Introduction to Denial of Service Attacks',
    content: `
      <p><strong>Denial of Service</strong>: An attack that tries to make a website or service unavailable to normal users, often by overwhelming it with too much traffic.</p>
    `,
  },
];

// Builds the Help page
export function renderHelpPage({ returnRoute = null } = {}) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  main.className = 'page-layout help-page';
  main.innerHTML = `
    <header class="panel help-header">
      <div>
        <h1>Help</h1>
        <p>Learn how to play FloodWatch and review the network basics used in each mission.</p>
      </div>
      ${returnRoute ? `<a class="button-link" href="#${returnRoute}">Return to Active Mission</a>` : '<a class="button-link" href="#home">Return to Home</a>'}
    </header>
    <div class="help-sections">
      ${helpSections
        .map(
          (section, index) => `
            <details class="help-section" ${index === 0 ? 'open' : ''}>
              <summary><span>${section.title}</span></summary>
              <div class="help-section__content">${section.content}</div>
            </details>
          `,
        )
        .join('')}
    </div>
  `;
  main.querySelectorAll('.help-section__content').forEach(applyGlossaryTerms);
  page.append(createNavigationPanel(), main);
  return page;
}
