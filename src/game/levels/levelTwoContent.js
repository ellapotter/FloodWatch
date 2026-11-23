/**
 * Educational content for Level 2: UDP Flood.
 *
 * Keeps explanations separate from simulation behavior.
 */
const missionId = 'udp-flood';

function evidence(id, description, sourceType, variant = 'default') {
  return {
    id,
    description,
    missionId,
    sourceType,
    variant,
  };
}

export const levelTwoInvestigationContent = Object.freeze({
  client: {
    title: 'Client',
    details:'This is a client communicating with the server. It is currently sending UDP datagrams containing information for the server to receive and process.',
    meaning:'A client is a device that requests information or services from a server. When communicating using UDP, the client can send information directly to the server without first establishing a connection through a three-way handshake like TCP.',
    learnMore:'UDP stands for User Datagram Protocol. It is a connectionless transport protocol that allows devices to send independent messages called datagrams. Unlike TCP, UDP does not establish a connection before sending data and does not provide guaranteed delivery, in-order delivery, or automatic retransmission of lost datagrams. This makes UDP useful for applications where low delay is important, such as online gaming.',
    evidence: evidence('udp-client-communicating','Client communicating with the server using UDP','client',),
  },

  datagram: {
    title: 'UDP Datagram',
    details:'This is a UDP datagram traveling from the client to the server. It contains information being sent from one device to another.',
    meaning:'UDP datagrams allow clients to send information to a server without first establishing a connection. Each datagram is sent independently, meaning the client does not need to wait for the server to respond to previous datagrams before sending additional ones.',
    learnMore:'A UDP datagram contains a header and application data. The UDP header includes four fields: source port, destination port, length, and checksum. The port numbers help identify which applications are communicating, the length indicates the size of the UDP datagram, and the checksum helps detect errors.',
    evidence: evidence('udp-datagram','UDP traffic is being sent toward the server','packet',),
  },

  response: {
    title: 'UDP Response',
    details:'This is a UDP datagram being sent from the server back to a client. It contains information the server is sending after processing the client’s request.',
    meaning:'When the server receives a request, the application processes the information and may send a UDP response back to the client if necessary.',
    learnMore:'UDP is a connectionless protocol, meaning each datagram is handled independently. It does not automatically send acknowledgements or guarantee that a response will be delivered. Whether a response is sent or not depends on the application.',
    evidence: evidence('udp-response','UDP response from server to client', 'packet',),
  },

  server: {
    title: 'Server',
    details:'This is the main web server you are in charge of protecting. It is currently experiencing UDP traffic from clients.',
    meaning:'The server receives information from clients and processes it according to the application being used. When using UDP, the server can receive and send datagrams without first establishing a connection with each client.',
    learnMore:'Servers can communicate using different transport protocols, like UDP and TCP. Unlike TCP, UDP does not require a three-way handshake or the maintenance of a connection state for each client. Instead, applications receive individual datagrams.',
    evidence: evidence('udp-server','Server is receiving and sending UDP traffic','server',),
  },

  suspiciousClient: {
    title: 'Suspicious Client',
    details:'This client is sending a large number of UDP datagrams toward the server.',
    meaning:'Normally, clients send UDP datagrams when they need to communicate with the server. However, this client is sending a large amount of traffic in a short amount of time. This is causing the server and network to spend more resources receiving and processing these datagrams.',
    learnMore:'Since UDP does not require a connection to be established before sending data, a device can transmit large numbers of UDP datagrams without a connection. Every datagram uses network resources, and when traffic arrives faster than the network or server can handle, packets may begin to be dropped and communication may be disrupted.',
    evidence: evidence('suspicious-udp-client','Client is sending a large number of UDP datagrams','client','warning',),
  },

  suspiciousDatagram: {
    title: 'High UDP Traffic',

    details: 'A large number of UDP datagrams are traveling toward the server.',
    meaning:'Every UDP datagram uses a part of the network’s available bandwidth. When too many datagrams are sent at once, the network may not have enough capacity to deliver all of them. This can cause packets to be delayed or dropped before reaching the server.',
    learnMore:'Network bandwidth is the amount of data that can be transmitted over a network connection within a certain amount of time. Network traffic can be measured in bits per second, while packet rate is measured in packets per second. A large volume of UDP traffic can overwhelm a network link by consuming its available bandwidth. High packet rates can also overwhelm routers or servers because they must process the packets.',
    evidence: evidence('high-udp-traffic','Incoming UDP traffic is increasing','packet','warning',),
  },

  highTraffic: {
    title: 'Network Congestion',
    details:"The incoming UDP traffic is exceeding the network's available capacity, causing some datagrams to be dropped.",
    meaning:'When too many datagrams are sent toward a network, the link may not have enough capacity to carry all incoming traffic. This can disrupt legitimate clients.',
    learnMore:'Network capacity is limited. In this educational model, datagrams exceeding the rolling-window admission budget are dropped immediately. Real networks may also use buffers and queues, but this simulation does not model those mechanisms.',
    evidence: evidence('udp-network-congestion','Incoming traffic is causing network packet loss','server','warning',),
  },

  disruptedClient: {
    title: 'Delayed Client',
    details:'This client is attempting to communicate with the server but is experiencing delays.',
    meaning:'The client is trying to use the server normally, but the large amount of UDP traffic is affecting the network’s performance. When the network is overwhelmed, some datagrams may be delayed or dropped.',
    learnMore:'UDP does not guarantee that datagrams will be delivered successfully. When a network becomes congested, network devices may drop packets because they are not able to process them quickly enough. Unlike TCP, UDP will not automatically retransmit these lost datagrams.',
    evidence: evidence('udp-client-disrupted','Client is experiencing delays','client','warning',),
  },
});

export const levelTwoReport = {
  missionId,
  correctChoiceId: 'udp-flood',

  minimumEvidenceCount: 1,
  requiredEvidenceIds: [],
  qualifyingEvidenceIds: ['suspicious-udp-client','high-udp-traffic','udp-network-congestion',],

  prompt:'Review the evidence you have collected and identify the attack affecting the network.',

  choices: [
    {
      id: 'udp-flood',
      name: 'UDP Flood',
      description: 'An attack that overwhelms a target by sending large amounts of UDP traffic, consuming network bandwidth or processing resources and disrupting legitimate communication.',
      feedback:'Correct! A UDP flood is a denial-of-service attack that sends excessive UDP datagrams toward a target. Since UDP does not require a connection to be established before sending data, an attacker can generate large amounts of traffic without completing a handshake. The incoming datagrams consume network bandwidth and may overwhelm devices responsible for processing the traffic. When the network becomes congested, legitimate packets may be delayed or dropped. This matches the observed behavior because the suspicious client is sending large amounts of UDP traffic directly toward the server, causing network capacity to decrease and legitimate clients to experience delays.',
    },

    {
      id: 'syn-flood',
      name: 'SYN Flood',
      description:'An attack that overwhelms the server with TCP connection requests that never complete the three-way handshake, consuming resources used to track unfinished connections.',
      feedback:'Incorrect. A TCP SYN flood targets the TCP connection establishment process by sending many SYN packets without completing the handshake. This causes the server to keep track of incomplete TCP connections. Although both attacks can prevent legitimate users from accessing a service, this mission involves excessive UDP datagrams rather than incomplete TCP handshakes. UDP does not use the TCP three-way handshake, so this is not a SYN flood.',
    },

    {
      id: 'udp-reflection',
      name: 'UDP Reflection',
      description:"An attack that sends requests to other servers using a victim's IP address, causing those servers to send unwanted UDP responses toward the victim.",
      feedback:'Incorrect. A UDP reflection attack occurs when an attacker sends requests to third-party servers using a spoofed source IP address belonging to the victim. The servers respond to the victim, causing it to receive traffic it never requested. Reflection attacks may also involve amplification if the responses are larger than the original request. However, the observed traffic in this mission is coming directly from the suspicious client rather than being sent by other servers in response to spoofed requests.',
    },

    {
      id: 'dns-amplification',
      name: 'DNS Amplification',
      description:'An attack that uses DNS resolvers to send large responses toward a target, overwhelming its network with traffic that the target did not request.',
      feedback:'Incorrect. DNS amplification is a type of reflection and amplification attack. The attacker sends DNS queries to DNS resolvers using the victim’s IP address as the spoofed source address. The DNS resolvers then send their responses to the victim instead of the attacker. If the responses are much larger than the original queries, the attacker can generate a large amount of traffic using a relatively small request. Although DNS amplification commonly uses UDP and can cause similar network congestion, the traffic in this mission is being sent directly from the suspicious client to the server rather than being reflected through DNS resolvers.',
    },
  ],
};

export const levelTwoMitigations = {
  missionId,
  correctChoiceId: 'apply-upstream-udp-filtering',

  instructions:'Choose a defense that reduces the unwanted UDP traffic while preserving legitimate communication.',

  choices: [
    {
      id: 'apply-upstream-udp-filtering',
      name: 'Apply Upstream UDP Filtering',
      feedback: "Correct! Upstream UDP filtering is a defense that identifies and blocks or limits unwanted UDP traffic before it reaches the server's network connection. Network providers can inspect traffic patterns and apply filtering rules to reduce excessive traffic while also allowing legitimate UDP communication to continue. Since this suspicious client is sending a large amount of UDP traffic directly towards the server, filtering the unwanted traffic before it reaches the link can reduce network congestion and restore our service for legitimate clients.",
    },

    {
      id: 'block-udp',
      name: 'Block UDP',
      feedback:'Incorrect. Blocking all UDP traffic would prevent the attack from reaching the server; however, it would also block legitimate UDP communication, including requests from clients that rely on UDP services. While this might stop the attack traffic, it would also make the UDP service unavailable to legitimate users.',
    },

    {
      id: 'increase-bandwidth',
      name: 'Increase Bandwidth',
      feedback:'Incorrect. Increasing the available network bandwidth allows the network to carry more traffic before becoming congested. This may temporarily improve performance and help the server handle a large volume of incoming packets. However, it does not identify or remove the malicious traffic. If the attacker continues sending more datagrams than the network can handle, the increased capacity may eventually become overwhelmed as well. Increasing bandwidth can be helpful as part of a larger defense strategy, but it does not directly stop the attack.',
    },

    {
      id: 'enable-udp-rate-limiting',
      name: 'Enable UDP Rate Limiting',
      feedback:'Incorrect. Rate limiting controls how much traffic a server or network device will accept or process during a certain amount of time. This can protect the server from excessive packet processing and reduce the resources used by unwanted traffic. However, if the attack has already overwhelmed the network connection leading to the server, rate limiting at the server will not prevent the packets from consuming the incoming bandwidth. In this mission, the traffic needs to be filtered before it reaches the congested network link.',
    },
  ],
};
