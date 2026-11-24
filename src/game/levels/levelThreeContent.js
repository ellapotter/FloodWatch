/** Educational content for Level 3: HTTP Flood. */
const missionId = 'http-flood';

function evidence(id, description, sourceType, variant = 'default') {
  return { id, description, missionId, sourceType, variant };
}

export const levelThreeInvestigationContent = Object.freeze({
  client: {
    title: 'Client',
    details: 'This is a client trying to access our company’s website. It is currently sending an HTTP request to the web server to retrieve information from the website.',
    meaning: 'A client is a device or application that requests information from a server. When accessing a website, a web browser sends HTTP requests asking the server for webpages, images, or other resources.',
    learnMore: 'HTTP stands for Hypertext Transfer Protocol. It is an application-layer protocol that follows a request-and-response model. HTTP/1.1 commonly uses TCP. In this mission, the TCP connection is already established so the focus remains on HTTP processing.',
    evidence: evidence('http-client-communicating', 'Client is communicating with the web server using HTTP', 'client'),
  },
  server: {
    title: 'Web Server',
    details: 'This is the main web server you are responsible for protecting. It receives HTTP requests from clients and processes them so users can access the website.',
    meaning: 'Depending on the request, the server may retrieve stored files, run application code, or access a database before sending a response. Each request requires processing time and server resources.',
    learnMore: 'Web applications use resources such as CPU time, memory, database connections, and request-processing capacity. When requests exceed that capacity, they wait and response times increase even if the network connection itself is not congested.',
    evidence: evidence('http-server-processing', 'Web server is using processing resources to handle HTTP requests', 'server'),
  },
  getRequest: {
    title: 'HTTP GET',
    details: 'This is an HTTP GET request traveling from a client to the web server. The client is requesting information from a specific web page.',
    meaning: 'An HTTP GET request retrieves information from a server. It identifies the resource the client wants, and the server returns that information when available.',
    learnMore: 'HTTP requests contain a method, target resource, and header fields. For example, GET /products HTTP/1.1 requests the /products resource. Unlike POST or PUT, GET is normally used to retrieve a representation of a resource.',
    evidence: evidence('http-get-request', 'Client is sending an HTTP GET request', 'packet'),
  },
  response: {
    title: 'HTTP Response',
    details: 'This is an HTTP response being sent from the web server to a client. It contains the result of the client’s request.',
    meaning: 'The response contains a status code indicating whether the request succeeded or an error occurred, and may contain the requested webpage or resource.',
    learnMore: 'HTTP status codes include 200 OK for success, 404 Not Found when a resource is unavailable, and 503 Service Unavailable when the server temporarily cannot handle a request.',
    evidence: evidence('http-response', 'Server is processing HTTP requests and sending responses to clients', 'packet'),
  },
  suspiciousClient: {
    title: 'Suspicious Client',
    details: 'This client is sending an unusually large number of HTTP GET requests toward the web server. The requests arrive much more frequently than normal and repeatedly target the same webpage.',
    meaning: 'Valid requests can still be malicious when one client repeatedly requests a resource-intensive page. The server must spend processing resources on every request, leaving less capacity for legitimate visitors.',
    learnMore: 'A high request rate alone does not prove an attack. Defenders also examine request patterns, targeted resources, and server impact. Repeated requests for an expensive page may trigger database queries or other costly application work.',
    evidence: evidence('suspicious-http-client', 'Client is sending large numbers of HTTP GET requests to the same web page', 'client', 'warning'),
  },
  highTraffic: {
    title: 'High HTTP Traffic',
    details: 'A large number of HTTP requests are arriving at the web server. The incoming request rate has increased significantly compared with normal website activity.',
    meaning: 'When requests arrive faster than the server can process them, they wait for application resources and response times increase.',
    learnMore: 'HTTP traffic can be measured in requests per second. Request rate differs from bandwidth: even small requests can require expensive application processing without saturating the network connection.',
    evidence: evidence('high-http-traffic', 'Incoming HTTP request rate has increased significantly', 'packet', 'warning'),
  },
  delayedRequests: {
    title: 'Delayed Requests',
    details: 'These HTTP requests are waiting to be processed by the web application because the server cannot process incoming requests quickly enough.',
    meaning: 'When all processing slots are busy, additional requests wait in a queue. If requests keep arriving faster than they finish, the queue grows and requests may fail or time out.',
    learnMore: 'Web applications limit concurrent work through resources such as application workers and database connections. Monitoring active and queued requests helps defenders recognize application-layer overload.',
    evidence: evidence('delayed-http-requests', 'HTTP requests are accumulating because the server cannot process them fast enough', 'server', 'warning'),
  },
  waitingClient: {
    title: 'Waiting Client',
    details: 'This client is attempting to access the website but is experiencing long loading times. The server has not responded within the normal amount of time.',
    meaning: 'The client’s legitimate request must wait while the server processes many other requests, so the webpage takes longer to load.',
    learnMore: 'HTTP response time includes network travel, queue waiting, application processing, and the response journey. Overloaded applications may cause timeouts or return 503 Service Unavailable.',
    evidence: evidence('http-client-waiting', 'Client is experiencing delayed HTTP responses', 'client', 'warning'),
  },
});

export const levelThreeReport = {
  missionId,
  correctChoiceId: 'http-flood',
  minimumEvidenceCount: 1,
  requiredEvidenceIds: [],
  qualifyingEvidenceIds: [
    'suspicious-http-client',
    'high-http-traffic',
    'delayed-http-requests',
    'http-client-waiting',
  ],
  prompt: 'Review the evidence you have collected and identify the attack affecting the network.',
  choices: [
    {
      id: 'http-flood',
      name: 'HTTP Flood',
      description: 'An attack that overwhelms a web application by sending excessive HTTP requests, consuming application processing resources and disrupting legitimate users.',
      feedback: 'Correct! An HTTP flood is an application-layer denial-of-service attack that overwhelms a web server with large numbers of HTTP requests. These requests may appear legitimate, but processing them consumes CPU time, memory, database capacity, or other application resources. This matches the evidence because one client repeatedly requested a resource-intensive page, increasing the processing queue and response times.',
    },
    {
      id: 'slow-http-attack',
      name: 'Slow HTTP Attack',
      description: 'An attack that keeps connections occupied by sending incomplete requests or headers slowly.',
      feedback: 'Incorrect. A slow HTTP attack holds connections open by sending incomplete request data slowly. The requests observed in this mission are complete HTTP GET requests arriving at a high rate.',
    },
    {
      id: 'http-cache-busting',
      name: 'HTTP Cache-Busting',
      description: 'An attack that changes resource identifiers or query parameters to defeat caching and increase origin-server work.',
      feedback: 'Incorrect. Cache-busting makes requests appear unique so cached responses cannot be reused. The requests observed here repeatedly target the same resource without changing its URL.',
    },
    {
      id: 'tcp-connection-exhaustion',
      name: 'TCP Connection Exhaustion',
      description: 'An attack that exhausts resources associated with large numbers of established TCP connections.',
      feedback: 'Incorrect. TCP connection exhaustion consumes connection-management resources. Here, established connections are sending excessive HTTP requests, and the application processing queue is the resource being overwhelmed.',
    },
  ],
};

export const levelThreeMitigations = {
  missionId,
  correctChoiceId: 'apply-http-rate-limiting',
  instructions: 'Choose a defense that limits excessive HTTP requests while preserving legitimate website access.',
  choices: [
    {
      id: 'apply-http-rate-limiting',
      name: 'Apply HTTP Rate Limiting Using a WAF',
      feedback: 'Correct! A Web Application Firewall can inspect HTTP requests and rate-limit excessive traffic before it reaches the application. A targeted rule can limit repeated GET requests to a resource-intensive page while allowing legitimate visitors to continue, preventing the suspicious client from overwhelming application processing.',
    },
    {
      id: 'increase-processing-capacity',
      name: 'Increase Processing Capacity',
      feedback: 'Incorrect. Additional application workers or server resources can handle more concurrent requests and provide temporary relief, but they do not identify or limit the attacker’s excessive requests. Continued attack traffic can overwhelm the added capacity.',
    },
    {
      id: 'increase-http-timeout',
      name: 'Increase HTTP Request Timeout',
      feedback: 'Incorrect. Increasing the timeout lets requests remain pending longer but does not reduce incoming request volume or increase processing capacity. It may also keep overloaded work pending for longer.',
    },
  ],
};
