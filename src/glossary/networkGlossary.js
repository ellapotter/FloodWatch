
function entry(id, term, definition, aliases = []) {
  return Object.freeze({ id, term, definition, aliases: Object.freeze(aliases) });
}

// These are all the glossary entries for the network concepts used in the game.
// Each entry has a unique ID, a term, a definition, and optional aliases that can be used to reference the same concept.
// This will help players with little networking experience understand the concepts better
export const networkGlossary = Object.freeze([
  entry('network', 'Network', 'A group of connected devices that can communicate and exchange information with one another. Networks allow devices to share data, access services, and communicate over connections such as the Internet.', ['Networks']),
  entry('client', 'Client', 'A device or application that requests information or services from another device called a server. For example, a web browser acts as a client when requesting a web page.', ['Clients']),
  entry('server', 'Server', 'A device or application that provides information or services to clients over a network. A web server receives requests from clients and sends back web pages or other resources.', ['Servers', 'Web Server', 'Web Servers']),
  entry('router', 'Router', 'A network device that forwards packets between different networks so they can reach the correct destination. Routers examine the destination IP address to determine where packets should be sent next.', ['Routers']),
  entry('packet', 'Packet', 'A unit of data transmitted over a network. Packets contain information needed to deliver the data, such as source and destination addresses, as well as the data being transmitted.', ['Packets']),
  entry('protocol', 'Protocol', 'A set of rules that determines how devices communicate and exchange information over a network. Some common protocols include TCP, UDP, HTTP, and DNS.', ['Protocols']),
  entry('ip-address', 'IP Address', 'A numerical address used to uniquely identify network devices and help deliver packets to the correct destination. It works somewhat like a mailing address for network communication. Example IP Address: 129.0.2.15', ['IP Addresses']),
  entry('port', 'Port', 'A number that helps a device direct incoming information to the correct application or service. It works somewhat like a room number within a building. Example Port Number: 30', ['Ports', 'Port Number', 'Port Numbers']),
  entry('network-traffic', 'Network Traffic', 'The information being sent and received between devices on a network.'),
  entry('connection', 'Connection', 'A communication link established between two devices or applications so they can exchange information. Some types of communication, such as TCP, require a connection to be established first.', ['Connections']),
  entry('request', 'Request', 'A message sent by a device asking for information or a service. For example, opening a website causes your browser to request a webpage.', ['Requests']),
  entry('response', 'Response', 'A message sent back after receiving a request. For example, a web server responds to your browser by sending the requested webpage.', ['Responses']),
  entry('source', 'Source', 'Where a packet appears to have come from.'),
  entry('destination', 'Destination', 'Where a packet is supposed to go.', ['Destinations']),
  entry('header', 'Header', 'A section of a packet that contains information about how it should be handled, such as the source and destination information.', ['Headers']),
  entry('payload', 'Payload', 'The information or data a packet is carrying, separate from the header information used to deliver it.'),
  entry('bandwidth', 'Bandwidth', 'The amount of information a network connection can carry in a certain amount of time. More bandwidth means the connection can carry more information at once.'),
  entry('network-congestion', 'Network Congestion', 'When too much information is trying to travel through a network at once, causing delays or lost packets. It is like a traffic jam on a busy road.'),
  entry('packet-loss', 'Packet Loss', 'When information sent across the network does not successfully reach its destination.'),
  entry('cyberattack', 'Cyberattack', 'An intentional attempt to disrupt, damage, or gain unauthorized access to a computer, network, or network service.', ['Cyberattacks']),
  entry('denial-of-service', 'Denial of Service', 'An attack that tries to make a website or service unavailable to normal users, often by overwhelming it with too much traffic.', ['Denial-of-Service', 'Denial-of-Service Attacks']),
  entry('attacker', 'Attacker', 'A person or system attempting to disrupt a network or service.', ['Attackers']),
  entry('ip-spoofing', 'IP Spoofing', 'When someone changes the source IP address in a packet to make it appear as though the packet came from a different device.'),
  entry('firewall', 'Firewall', 'A security tool that checks network traffic and decides what should be allowed or blocked based on security rules.', ['Firewalls']),
  entry('rate-limiting', 'Rate Limiting', 'A method of restricting how many requests or packets are allowed during a certain amount of time.'),
  entry('traffic-filtering', 'Traffic Filtering', 'Checking network traffic and blocking or limiting information that matches certain rules.'),
  entry('mitigation', 'Mitigation', 'An action taken to reduce or stop the effects of an attack.', ['Mitigations']),
  entry('domain-name', 'Domain Name', 'The readable name of a website, such as google.com, that people use instead of its numerical IP address.', ['Domain Names']),
  entry('dns', 'DNS', 'Domain Name System. It helps devices find the IP addresses associated with a website’s domain name so they know where to send the request.'),
  entry('dns-server', 'DNS Server', 'A server that provides information about domain names. Some DNS servers store information about websites, while others help devices find that information.', ['DNS Servers']),
  entry('dns-resolver', 'DNS Resolver', 'A type of DNS server that helps devices find the IP address or other information associated with a domain name. It may already know the answer, or it may have to ask other DNS servers to find it.', ['DNS Resolvers']),
  entry('dns-query', 'DNS Query', 'A request asking a DNS resolver for information about a domain name.', ['DNS Queries']),
  entry('reflection', 'Reflection', 'When an attacker tricks other servers into sending information to a victim instead of back to the attacker.'),
  entry('amplification', 'Amplification', 'When an attacker causes a small request to generate a much larger response, increasing the amount of traffic sent toward a victim.'),
]);

export const networkGlossaryById = new Map(
  networkGlossary.map((glossaryEntry) => [glossaryEntry.id, glossaryEntry]),
);
