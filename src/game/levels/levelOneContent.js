// Investigation, reporting, and mitigation content for Level 1.
const missionId = 'syn-flood';

// Creates an evidence item that is automatically tied to Level 1.
function evidence(id, description, sourceType, variant = 'default') {
  return { id, description, missionId, sourceType, variant };
}

export const levelOneInvestigationContent = Object.freeze({
  client: {
    title: 'Client',
    connectedDetails:
      'This is a client trying to communicate with the web server. (It is currently connected and sending data to the server)',
    connectingDetails:
      'This is a client trying to communicate with the web server. (It is currently attempting to connect to the server through a three-way handshake)',
    meaning:
      'A client is a device that requests information or services from a server. To communicate with TCP, the client first establishes a connection through a process called a three-way handshake.',
    learnMore:
      'Network protocols are rules for how devices and different parts of the network communicate. TCP (Transmission Control Protocol) is a protocol that establishes a connection before transferring data. It uses the process of a three-way handshake to establish the connection and make sure the data is delivered reliably and in the correct order using sequence numbers and acknowledgements to keep track of the data being exchanged.',
    evidence: evidence('client-communicating', 'Client communicating with the server', 'client'),
  },
  synPacket: {
    title: 'SYN packet',
    details:
      'This is a SYN packet. It is the first step in a process called the three-way handshake, which is used to establish a TCP connection between a client and server.',
    meaning:
      'Before a client can communicate with the server using TCP, it must establish a connection. The first step is the client sending a SYN packet to let the server know it wants to connect.',
    learnMore:
      'SYN stands for synchronize. It is a control flag in the TCP header that is used when starting a connection. The SYN packet includes an initial sequence number that helps the client and server keep track of the data being exchanged and stay synchronized.',
    evidence: evidence(
      'client-syn-request',
      'Client sends SYN packet to request a connection (Step 1)',
      'packet',
    ),
  },
  synAckPacket: {
    title: 'SYN-ACK packet',
    details:
      'This is a SYN-ACK packet. It is the second step in the three-way handshake and is sent by the server in response to a client’s SYN packet.',
    meaning:
      'After receiving the client’s connection request, the server responds with a SYN-ACK packet. This lets the client know the server received the request and is ready to continue establishing a connection.',
    learnMore:
      'This TCP packet has both the SYN (synchronize) and ACK (acknowledgment) flags set. The ACK acknowledges the client’s initial sequence number, while the SYN provides the server’s initial sequence number. The server then waits for the client’s final ACK to complete the handshake.',
    evidence: evidence(
      'server-syn-ack-response',
      'Server responds with a SYN-ACK packet (Step 2)',
      'packet',
    ),
  },
  ackPacket: {
    title: 'ACK packet',
    details:
      'This is an ACK packet. It is the final step in the three-way handshake and is sent by the client to complete the connection.',
    meaning:
      'The client began the connection process by sending a SYN packet. The server accepted the request with a SYN-ACK, and now the client sends an ACK to confirm that it received the server’s response. This completes the three-way handshake, establishes the connection, and allows the server and client to begin exchanging data.',
    learnMore:
      'ACK stands for acknowledgment. It is a flag in the TCP header that indicates the packets have been successfully received and the server’s initial sequence number is valid.',
    evidence: evidence(
      'client-ack-completes-connection',
      'Client sends an ACK packet, completing the TCP connection (Step 3)',
      'packet',
    ),
  },
  dataPacket: {
    title: 'Data Packet',
    details:
      'This is a data packet traveling between a client and the web server. It contains information being exchanged after the TCP three-way handshake has successfully established a connection.',
    meaning:
      'Once the client and server have completed the three-way handshake, they can begin exchanging data through the established TCP connection. The client can send information or requests to the server, and the server can send responses back to the client. This communication continues until the connection is closed.',
    learnMore:
      'TCP allows devices to exchange data reliably after a connection has been established. Data is divided into smaller pieces called segments, which are transmitted across the network. TCP uses sequence numbers and acknowledgments to keep track of the data being exchanged, detect missing information, and ensure it is delivered in the correct order. When the devices are finished communicating, the TCP connection can be closed.',
    evidence: evidence(
      'established-connection-data',
      'Client and server are exchanging data through an established TCP connection.',
      'packet',
    ),
  },
  webServer: {
    title: 'Web Server',
    details:
      'This is the main web server you are responsible for protecting. It receives connection requests from clients and sends responses so they can access the website.',
    meaning:
      'When a client requests a TCP connection, the server responds and waits for the handshake to finish. The server keeps track of these connections while also handling new requests from other clients.',
    learnMore: null,
    evidence: evidence(
      'server-connection-requests',
      'Server handles connection requests from clients',
      'server',
    ),
  },
  suspiciousClient: {
    title: 'Suspicious Client',
    details:
      'This client is sending many SYN packets toward the web server. The server is responding with a SYN-ACK, but the client is not sending the final ACK needed to complete the connections.',
    meaning:
      'Normally, a client completes the three-way handshake before exchanging data. This client keeps starting new connections without completing them, causing the server to keep track of multiple unfinished connection requests.',
    learnMore:
      'TCP keeps track of connections using connection states. After receiving a SYN and sending a SYN-ACK, the server normally enters the SYN-RECEIVED state while waiting for the final ACK. If too many connections remain in this state, they may use up resources needed to handle new requests.',
    evidence: evidence(
      'suspicious-client',
      'Client is sending many SYN requests',
      'client',
      'warning',
    ),
  },
  waitingClient: {
    title: 'Waiting Client',
    details:
      'This client is trying to connect to the web server but has not been able to establish a connection successfully.',
    meaning:
      'The client has sent a connection request but is still waiting for the connection to be established. The server is currently handling a large number of incomplete connection requests, which may be affecting its ability to accept new clients.',
    learnMore:
      'TCP uses retransmission timers to handle packets that may have been lost. If the client does not receive the expected response, it may retransmit its SYN packet. When a server becomes overwhelmed, clients may experience delays, failed connection attempts, or timeouts.',
    evidence: evidence(
      'client-connection-delays',
      'Client is experiencing connection delays',
      'client',
      'warning',
    ),
  },
  repeatedSynPacket: {
    title: 'Repeated SYN packet',
    details:
      'A large number of SYN packets are being sent toward the web server. These packets are starting new TCP connection attempts, but the server is not receiving the final ACK needed to complete many of them.',
    meaning:
      'SYN packets are normally used to begin TCP connections. However, when the client does not send the final ACK packet, the connection is never established.',
    learnMore:
      'TCP uses the SYN flag to begin connection establishment. A server that receives a SYN normally responds with a SYN-ACK and waits for the final ACK. While waiting, it may temporarily store information about the incomplete connection.',
    evidence: evidence(
      'repeated-syn',
      'High number of new SYN requests',
      'packet',
      'warning',
    ),
  },
});

export const levelOneReport = {
  missionId,
  correctChoiceId: 'syn-flood',
  minimumEvidenceCount: 1,
  requiredEvidenceIds: [],
  qualifyingEvidenceIds: ['repeated-syn', 'suspicious-client'],
  prompt:
    'After collecting at least one relevant evidence item (Repeated SYN or Suspicious Client), the Report Attack button will become available. Once reported, the player will be given the following options.',
  choices: [
    {
      id: 'syn-flood',
      name: 'SYN Flood',
      description:
        'An attack that sends a large number of TCP connection requests without completing the three-way handshake, causing the server to keep track of unfinished connections.',
      feedback:
        'Correct! A SYN flood is a denial-of-service attack that overwhelms a server with incomplete TCP connection requests. The attacker repeatedly sends SYN packets, causing the server to respond with SYN-ACK packets and wait for the final ACK that never arrives. This can exhaust the server’s available resources for pending connections, preventing legitimate clients from connecting. This matches the evidence collected because the suspicious client was sending many SYN packets without completing the handshake.',
    },
    {
      id: 'tcp-ack-flood',
      name: 'TCP ACK Flood',
      description:
        'An attack that sends large numbers of TCP packets with the ACK flag set to overwhelm a server or network devices.',
      feedback:
        'Incorrect. A TCP ACK flood attempts to overwhelm a target by sending excessive packets with the ACK flag set. These packets can consume bandwidth or processing resources, particularly when network devices must inspect or track them. However, the packets observed in this mission were primarily SYN packets, not ACK packets.',
    },
    {
      id: 'established-connection-exhaustion',
      name: 'Established Connection Exhaustion',
      description:
        'An attack that opens and maintains many TCP connections to consume the server’s available connection resources and prevent new clients from connecting.',
      feedback:
        'Incorrect. Established connection exhaustion attacks consume server resources by creating and maintaining large numbers of completed connections. This is like a SYN flood because both can prevent legitimate clients from connecting. However, the connections observed in this mission never completed the three-way handshake. The server was waiting for final packets rather than managing large numbers of established connections.',
    },
    {
      id: 'http-flood',
      name: 'HTTP Flood',
      description:
        "An attack that sends large numbers of website requests to overwhelm the server's ability to process and respond to legitimate users.",
      feedback:
        'Incorrect. An HTTP flood targets a web server by sending excessive HTTP requests, such as requests to load web pages or retrieve information. These requests consume application processing resources. In this mission, the suspicious behavior occurred during the TCP connection process, before HTTP requests were being exchanged.',
    },
  ],
};

export const levelOneMitigations = {
  missionId,
  correctChoiceId: 'enable-syn-cookies',
  identifiedAttack: {
    name: 'SYN Flood',
    description:
      'An attack that sends a large number of TCP connection requests without completing the three-way handshake, causing the server to keep track of unfinished connections.',
  },
  instructions:
    'Once the correct attack has been detected, the player will choose one of the following mitigation strategies. If correct, the network will go back to normal.',
  choices: [
    {
      id: 'enable-syn-cookies',
      name: 'Enable SYN cookies',
      feedback:
        "Correct. SYN cookies are a defense mechanism designed to help protect servers against SYN flood attacks. Normally, when a server receives a SYN packet, it may temporarily store information about the incomplete connection while waiting for the final ACK. SYN cookies allow the server to encode information about the connection into the initial sequence number of its SYN-ACK response instead of immediately storing the usual connection state. When the client returns a valid final ACK, the server can verify the information and establish the connection. This helps prevent large numbers of incomplete requests from exhausting the server's connection backlog, allowing legitimate clients to connect.",
    },
    {
      id: 'increase-tcp-backlog',
      name: 'Increase TCP backlog',
      feedback:
        'Incorrect. The TCP backlog controls how many pending connection requests a server can manage while waiting for the three-way handshake to finish. Increasing the backlog allows the server to hold more incomplete connections, which may temporarily reduce connection failures. However, this does not prevent an attacker from continuing to send new SYN requests. If enough requests arrive, the larger backlog can eventually become overwhelmed as well. This may provide temporary relief, but it does not directly address the cause of the attack.',
    },
    {
      id: 'block-all-tcp-traffic',
      name: 'Block TCP traffic',
      feedback:
        'Incorrect. Blocking all incoming TCP traffic would prevent the malicious SYN packets from reaching the server. However, it would also prevent legitimate clients from establishing TCP connections and accessing the website. Since the goal is to keep the server available to real users, blocking all TCP traffic would stop the attack traffic at the cost of making the server unavailable.',
    },
  ],
};
