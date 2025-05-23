const express = require('express');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// 配置 CORS
app.use(cors());

// 配置请求体解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// NMOS Registration Configuration
const NMOS_REGISTRY_REGISTRATION_URL = process.env.NMOS_REGISTRY_REGISTRATION_URL; // NMOS Registry Registration API URL (Required via environment variable)
const NMOS_HEARTBEAT_INTERVAL_MS = parseInt(process.env.NMOS_HEARTBEAT_INTERVAL_MS || '5000', 10); // Default heartbeat interval: 5 seconds

// Define NMOS Node, Device, etc. resources for this backend instance
const NODE_ID = uuidv4();
const DEVICE_ID = uuidv4();
const VERSION = '1.0.0';
const HOSTNAME = os.hostname();

// 构建控制器的NMOS资源对象
const controllerResources = {
  node: {
    id: NODE_ID,
    version: VERSION,
    label: 'Vega-NMOS-Panel',
    href: `http://${HOSTNAME}:3000`,
    hostname: HOSTNAME,
    caps: {},
    services: [],
    api: {
      endpoints: [
        {
          host: HOSTNAME,
          port: 3000,
          protocol: 'http'
        }
      ],
      versions: ['v1.0']
    },
    clocks: [],
    interfaces: []
  },
  device: {
    id: DEVICE_ID,
    version: VERSION,
    label: 'Vega-NMOS-Panel Controller',
    type: 'urn:x-nmos:device:control',
    node_id: NODE_ID,
    controls: [
      {
        href: `http://${HOSTNAME}:3000/api/v1`,
        type: 'urn:x-nmos:control:sr-ctrl/v1.1'
      }
    ]
  }
};

const nodeResource = {
  id: NODE_ID,
  version: Date.now().toString(), // Use timestamp for versioning
  label: 'Vega-NMOS Panel Backend Node',
  description: 'NMOS Node representing the Vega-NMOS Control Panel backend service.',
  tags: {},
  hostname: require('os').hostname(),
  api: {
    versions: [
      {
        version: '1.3.1',
        endpoints: [
          { format: 'internal', path: '/', protocol: 'http' } // Indicate internal API
        ]
      }
    ],
    ch_hostname: require('os').hostname(),
    ch_port: PORT,
    ch_protocol: 'http'
  },
  href: `http://${require('os').hostname()}:${PORT}/`, // Base URL for this node's API
  services: [], // Add service discovery endpoints if implemented (e.g., DNS-SD)
  // Add attached_network_device if applicable
};

const deviceResource = {
  id: DEVICE_ID,
  version: Date.now().toString(),
  label: 'Vega-NMOS Panel Device',
  description: 'Virtual device representing the control panel functionality.',
  tags: {},
  node_id: NODE_ID,
  type: 'urn:nmos:device:generic',
  senders: [],
receivers: [],
};

// 注册控制器节点和设备到Registry

// 最大重试次数和重试延迟配置
const MAX_REGISTRATION_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function registerControllerToRegistry() {
  if (!NMOS_REGISTRY_REGISTRATION_URL) {
    console.error('错误：未设置 NMOS_REGISTRY_REGISTRATION_URL 环境变量。请在运行应用前设置此变量。');
    return false;
  }

  let retryCount = 0;
  heartbeatInterval = null; // Remove redundant declaration

  const updateResourceVersion = (resource) => {
    resource.version = Date.now().toString();
    return resource;
  };

  const registerResource = async (type, resource) => {
    const registrationUrl = `${NMOS_REGISTRY_REGISTRATION_URL}/resource/${type}s/${resource.id}`;
    try {
      const response = await axios.post(registrationUrl, updateResourceVersion(resource));
      console.log(`成功注册控制器${type}资源: ${response.status}`);
      return true;
    } catch (error) {
      console.error(`注册${type}资源失败:`, error.message);
      if (error.response) {
        console.error('错误详情:', error.response.status, error.response.data);
      }
      return false;
    }
  };

  const sendHeartbeats = async () => {
    const heartbeatUrl = `${NMOS_REGISTRY_REGISTRATION_URL}/health/nodes/${controllerResources.node.id}`;
    try {
      await axios.post(heartbeatUrl);
    } catch (error) {
      console.error('心跳更新失败:', error.message);
      if (error.response && error.response.status === 404) {
        console.log('节点未注册或已过期，尝试重新注册...');
        clearInterval(heartbeatInterval);
        await registerWithRetry();
      }
    }
  };

  const registerWithRetry = async () => {
    while (retryCount < MAX_REGISTRATION_RETRIES) {
      const nodeSuccess = await registerResource('node', controllerResources.node);
      const deviceSuccess = nodeSuccess && await registerResource('device', controllerResources.device);

      if (nodeSuccess && deviceSuccess) {
        console.log('所有资源注册成功');
        // 启动心跳
        heartbeatInterval = setInterval(sendHeartbeats, NMOS_HEARTBEAT_INTERVAL_MS);
        
        // 启动状态验证定时器
        const stateVerificationInterval = setInterval(() => {
          Object.keys(activeConnections).forEach(receiverId => {
            verifyConnectionState(receiverId);
          });
        }, 10000); // 每10秒验证一次连接状态
        return true;
      }

      retryCount++;
      if (retryCount < MAX_REGISTRATION_RETRIES) {
        console.log(`注册失败，${RETRY_DELAY_MS/1000}秒后进行第${retryCount + 1}次重试...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    console.error(`达到最大重试次数(${MAX_REGISTRATION_RETRIES})，注册失败`);
    return false;
  };

  return registerWithRetry();
}; // Add missing semicolon

// Function to register resources with the NMOS Registry
async function registerWithRegistry() {
  if (!NMOS_REGISTRY_REGISTRATION_URL) {
    console.error('错误：未设置 NMOS_REGISTRY_REGISTRATION_URL 环境变量。请在运行应用前设置此变量。');
    return;
  }

  console.log(`Attempting to register Node ${NODE_ID} and Device ${DEVICE_ID} with Registry at ${NMOS_REGISTRY_REGISTRATION_URL}`);
  const registrationUrl = `${NMOS_REGISTRY_REGISTRATION_URL}/resource`;

  try {
    // Register Node
    let response = await axios.post(registrationUrl, { type: 'node', data: nodeResource });
    console.log(`Node registration successful: ${response.status}`);

    // Register Device
    response = await axios.post(registrationUrl, { type: 'device', data: deviceResource });
    console.log(`Device registration successful: ${response.status}`);

    // TODO: Register Sender/Receiver resources if virtual ones are defined

    console.log('Initial NMOS registration complete.');

  } catch (error) {
    console.error(`Error during initial NMOS registration:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    // Implement retry logic if necessary
  }
}

// Function to send heartbeat to the NMOS Registry
async function sendHeartbeat() {
  if (!NMOS_REGISTRY_REGISTRATION_URL) {
    console.error('错误：未设置 NMOS_REGISTRY_REGISTRATION_URL 环境变量。无法发送心跳。');
    return;
  }

  const heartbeatUrl = `${NMOS_REGISTRY_REGISTRATION_URL}/health/${NODE_ID}`;
  try {
    const response = await axios.post(heartbeatUrl, {});
    // console.log(`Heartbeat successful for Node ${NODE_ID}: ${response.status}`); // Log less frequently for heartbeats
  } catch (error) {
    console.error(`Error sending heartbeat for Node ${NODE_ID}:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    // If heartbeat fails, the Registry will eventually unregister the Node.
    // Consider re-attempting registration if heartbeats consistently fail.
  }
}

// Middleware to parse JSON request bodies
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Vega-NMOS Backend is running!');
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  ws.on('message', (message) => {
    console.log('received: %s', message);
    // Echo message back to client
    ws.send(`Server received: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.send('Welcome to Vega-NMOS WebSocket server!');
});

server.listen(PORT, async () => {
  console.log(`Backend server is listening on port ${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);

  // Perform initial registration with NMOS Registry
  await registerWithRegistry();

  // Start periodic heartbeat
  heartbeatInterval = setInterval(sendHeartbeat, NMOS_HEARTBEAT_INTERVAL_MS);

  console.log('Before initializing IS-05 Connection Manager...'); // Added log
  // Initialize IS-05 Connection Manager
  await initializeIS05ConnectionManager();
  console.log('After initializing IS-05 Connection Manager.'); // Added log

  // Register controller resources
  await registerControllerToRegistry();

  console.log('Before performing IS-04 Discovery...'); // Added log
  // Perform initial IS-04 discovery only if NMOS_REGISTRY_URL is set
  if (currentRegistryUrl && currentRegistryUrl.trim() !== '') {
    try {
      await performIS04Discovery(currentRegistryUrl);
      console.log('After performing IS-04 Discovery.'); // Added log
    } catch (error) {
      // Error is already logged by performIS04Discovery, and ws message sent.
      // Log additional context for startup failure.
      console.warn(`Initial IS-04 discovery failed on startup: ${error.message}`);
    }
  } else {
    console.warn('NMOS_REGISTRY_URL is not set. Backend will start without initial resource discovery. Please provide the registry URL via the UI.');
  }
});

// Move axios import to top of file to fix ReferenceError
const axios = require('axios');

// --- IS-04 Discovery --- 
let currentRegistryUrl = process.env.NMOS_REGISTRY_URL; // NMOS Registry Query API URL (Required via environment variable)
// Global store for discovered resources, updated by performIS04Discovery and used by WebSocket handlers
let discoveredResources = {
  nodes: [],
  devices: [],
  sources: [], // Keep sources if it's used elsewhere, though not explicitly in the new hierarchy
  flows: [],
  senders: [],
  receivers: [],
};

async function fetchFromRegistry(resourceType, registryUrlToUse) {
  // Ensure registryUrlToUse does not end with a slash, then append the resourceType
  const baseUrl = registryUrlToUse.replace(/\/?$/, ''); // Remove trailing slash if any
  const fullUrl = `${baseUrl}/${resourceType}`;
  console.log(`Attempting to fetch ${resourceType} from ${fullUrl}`);
  try {
    const response = await axios.get(fullUrl);
    console.log(`Successfully fetched ${resourceType} from ${fullUrl}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${resourceType} from ${fullUrl}:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    // Propagate the error to be handled by the caller
    throw error;
  }
}

// Helper function to fetch resources with pagination
async function fetchPaginatedResources(startUrl) {
  let allResources = [];
  let currentPageUrl = startUrl;
  console.log(`[fetchPaginatedResources] Starting pagination fetch process from: ${startUrl}`);

  // Step 1: Fetch the first page to find the 'last' link
  let lastPageUrl = null;
  try {
    console.log(`[fetchPaginatedResources] Fetching initial page to find 'last' link: ${startUrl}`);
    const initialResponse = await axios.get(startUrl);
    console.log(`[fetchPaginatedResources] Initial response status: ${initialResponse.status}, Link header present: ${!!initialResponse.headers.link}`);

    lastPageUrl = getLinkByRel(initialResponse.headers.link, 'last');
    console.log(`[fetchPaginatedResources] Found 'last' link: ${lastPageUrl}`);

    // If no 'last' link is found, assume the initial page is the only page or the last page.
    // In this case, we'll just process the initial response data and stop.
    if (!lastPageUrl) {
        console.log(`[fetchPaginatedResources] No 'last' link found. Processing initial page data.`);
        if (initialResponse.data && initialResponse.data.length > 0) {
            allResources = allResources.concat(initialResponse.data);
        }
        return allResources; // Stop here if no pagination links
    }

  } catch (error) {
    console.error(`Error fetching initial page from ${startUrl}:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    throw error; // Propagate the error
  }

  // Step 2: Start fetching from the last page backwards using 'prev' links
  currentPageUrl = lastPageUrl;
  console.log(`[fetchPaginatedResources] Starting backward pagination from 'last' link: ${currentPageUrl}`);

  while (currentPageUrl) {
    console.log(`[fetchPaginatedResources] Fetching page from: ${currentPageUrl}`);
    try {
      const response = await axios.get(currentPageUrl);
      console.log(`[fetchPaginatedResources] Received response status: ${response.status}, Link header present: ${!!response.headers.link}`);

      // Add received data (if any)
      if (response.data && response.data.length > 0) {
        // Prepend data because we are fetching backwards
        allResources = response.data.concat(allResources);
      } else {
          // If data is empty, stop fetching. This handles the user's case where the last page might have an empty response body.
          console.log(`[fetchPaginatedResources] Received empty data, stopping backward pagination.`);
          currentPageUrl = null; // Stop the loop
          continue; // Skip finding the next link if data is empty
      }

      // Determine previous URL based on 'prev' Link header
      const prevLink = getLinkByRel(response.headers.link, 'prev');
      currentPageUrl = prevLink; // Continue if prevLink exists, stop if null

    } catch (error) {
      console.error(`Error fetching paginated resources from ${currentPageUrl}:`, error.message);
      if (error.response) {
        console.error('Error details:', error.response.status, error.response.data);
      }
      // Stop fetching on error but return what has been collected so far.
      // Or, rethrow error if partial data is not acceptable: throw error;
      currentPageUrl = null; // Ensure loop terminates on error
    }
  }
  return allResources;
}

// Helper function to parse Link header and find a link by rel type
function getLinkByRel(linkHeader, relType) {
  console.log(`[getLinkByRel] Processing Link header: ${linkHeader} for rel="${relType}"`);
  if (!linkHeader) return null;
  const links = linkHeader.split(',');
  for (const link of links) {
    const parts = link.split(';');
    if (parts.length < 2) continue;
    const urlPart = parts[0].trim();
    const relPart = parts[1].trim();

    if (relPart === `rel="${relType}"`) {
      const urlMatch = urlPart.match(/^<(.*)>$/);
      if (urlMatch && urlMatch[1]) {
        console.log(`[getLinkByRel] Found ${relType} link: ${urlMatch[1]}`);
        return urlMatch[1];
      }
    }
  }
  console.log(`[getLinkByRel] No rel="${relType}" link found.`);
  return null;
}

// Function to perform IS-04 discovery
// Fetches all necessary resources and updates the global discoveredResources.
// Returns the fetched resources for direct use by the caller if needed.
async function performIS04Discovery(registryUrl) {
  if (!registryUrl) {
    const errorMsg = '错误：未设置 NMOS_REGISTRY_URL。无法执行 IS-04 Discovery。';
    console.error(errorMsg);
    // Notify frontend about the error
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'nmos_connection_status', status: 'error', message: errorMsg }));
      }
    });
    // Throw an error to be caught by the calling API endpoint
    throw new Error(errorMsg);
  }

  console.log(`Performing IS-04 discovery from: ${registryUrl}`);
  // Normalize registryUrl: remove any trailing slash.
  // This URL is now assumed to be the base of the Query API itself 
  // (e.g., http://example.com/x-nmos/query/v1.3)
  const normalizedRegistryUrl = registryUrl.replace(/\/$/, '');

  const resourcesToFetch = [
    { name: 'nodes', path: '/nodes' }, // Paths now start with a slash
    { name: 'devices', path: '/devices' },
    { name: 'senders', path: '/senders' },
    { name: 'receivers', path: '/receivers' },
    { name: 'flows', path: '/flows' }
  ];

  const fetchedResources = {
    nodes: [],
    devices: [],
    senders: [],
    receivers: [],
    flows: []
  };

  try {
    for (const resourceInfo of resourcesToFetch) {
      // Construct full URL by appending the resource path to the normalized registry URL
      const fullUrl = `${normalizedRegistryUrl}${resourceInfo.path}`;
      console.log(`Fetching ${resourceInfo.name} from ${fullUrl}`);
      fetchedResources[resourceInfo.name] = await fetchPaginatedResources(fullUrl);
      console.log(`Successfully fetched ${fetchedResources[resourceInfo.name].length} ${resourceInfo.name}.`);
    }

    // Update global discoveredResources for WebSocket updates and other parts of the app
    discoveredResources.nodes = fetchedResources.nodes;
    discoveredResources.devices = fetchedResources.devices;
    discoveredResources.senders = fetchedResources.senders;
    discoveredResources.receivers = fetchedResources.receivers;
    discoveredResources.flows = fetchedResources.flows;
    // Keep discoveredResources.sources if it's managed elsewhere or by different logic
    // For now, ensure it's at least an empty array if not fetched here.
    if (!discoveredResources.sources) discoveredResources.sources = [];


    console.log(`Discovered ${discoveredResources.nodes.length} nodes, ${discoveredResources.devices.length} devices, ${discoveredResources.senders.length} senders, ${discoveredResources.receivers.length} receivers, and ${discoveredResources.flows.length} flows.`);

    // Attempt to subscribe to IS-04 Query API WebSocket for real-time updates
    // Attempt to subscribe to IS-04 Query API WebSocket for real-time updates.
    // The `normalizedRegistryUrl` is the Query API base URL (e.g., http://host/x-nmos/query/v1.3)
    // and will be used as the base for POSTing to /subscriptions.
    console.log(`[performIS04Discovery] Using Query API base for subscriptions: ${normalizedRegistryUrl}`);
    subscribeToRegistryUpdates(normalizedRegistryUrl); 

    return fetchedResources; // Return the freshly fetched resources

  } catch (error) {
    console.error('Error performing IS-04 discovery:', error.message);
    // Notify frontend about the error
    const errorMsg = `Failed to discover resources from Registry: ${error.message}`;
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'nmos_connection_status', status: 'error', message: errorMsg }));
      }
    });
    // Re-throw the error to be caught by the calling API endpoint
    throw error;
  }
}

// --- IS-04 WebSocket Subscription ---
let registryWebSockets = {}; // Manage multiple WebSockets, keyed by resourcePath
let wsReconnectAttempts = {}; // Store reconnect attempts per resourcePath
let wsReconnectDelays = {}; // Store reconnect delays per resourcePath

// Helper function to fetch available top-level resource types from the Query API root
// The registryQueryUrl parameter is expected to be the base URL of the Query API (e.g., http://host/x-nmos/query/v1.3)
async function fetchQueryApiRoot(registryQueryUrl) { 
  const normalizedQueryApiBaseUrl = registryQueryUrl.replace(/\/$/, ''); // Ensure no trailing slash
  console.log(`Fetching top-level resource types from Query API root: ${normalizedQueryApiBaseUrl}`);
  try {
    // The Query API root itself lists the available resource types (nodes, devices, etc.)
    const response = await axios.get(normalizedQueryApiBaseUrl);
    if (response.status === 200 && Array.isArray(response.data) && response.data.every(item => typeof item === 'string')) {
      console.log('Discovered top-level NMOS resource types:', response.data);
      return response.data;
    } else {
      console.error(`Error fetching or validating Query API root: Unexpected response format or status ${response.status}. Data:`, response.data);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching Query API root from ${normalizedQueryApiBaseUrl}:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    return []; // Return empty array on error
  }
}

// Creates a subscription.
// The `queryApiBaseUrl` parameter is the base URL of the Query API (e.g., http://host/x-nmos/query/v1.3)
async function createSubscription(queryApiBaseUrl, resourcePath) {
  const normalizedQueryApiBaseUrl = queryApiBaseUrl.replace(/\/$/, ''); // Ensure no trailing slash
  const subscriptionsUrl = `${normalizedQueryApiBaseUrl}/subscriptions`;
  console.log(`Attempting to create IS-04 subscription at ${subscriptionsUrl} for resource_path: ${resourcePath}`);
  try {
    const response = await axios.post(subscriptionsUrl, {
      max_update_rate_ms: 100, 
      resource_path: resourcePath, 
      persist: true,
      params: {} 
    });
    console.log(`Subscription creation successful for ${resourcePath}: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`Error creating IS-04 subscription at ${subscriptionsUrl}:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    return null;
  }
}

// Global constants for reconnection strategy
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1秒

// Function to attempt a single subscription and WebSocket connection.
// The `queryApiBaseUrl` parameter is the base URL of the Query API (e.g., http://host/x-nmos/query/v1.3)
async function attemptSpecificSubscription(queryApiBaseUrl, resourcePath) {
  console.log(`Attempting subscription for resourcePath: ${resourcePath} using Query API base: ${queryApiBaseUrl}`);

  if (!wsReconnectAttempts[resourcePath]) {
    wsReconnectAttempts[resourcePath] = 0;
  }
  if (!wsReconnectDelays[resourcePath]) {
    wsReconnectDelays[resourcePath] = INITIAL_RECONNECT_DELAY;
  }

  // Close existing WebSocket for this resourcePath if any
  if (registryWebSockets[resourcePath]) {
    try {
      if (registryWebSockets[resourcePath].readyState === WebSocket.OPEN || registryWebSockets[resourcePath].readyState === WebSocket.CONNECTING) {
        console.log(`Closing existing WebSocket for ${resourcePath} before attempting new subscription.`);
        registryWebSockets[resourcePath].close();
      }
    } catch (err) {
      console.error(`Error closing existing WebSocket for ${resourcePath}:`, err);
    }
    delete registryWebSockets[resourcePath];
  }

  try {
    // `createSubscription` now expects the Query API base URL as its first argument.
    const subscription = await createSubscription(queryApiBaseUrl, resourcePath);
    if (subscription && subscription.ws_href) {
      const wsUrl = subscription.ws_href.replace(/^http/, 'ws');
      console.log(`Connecting to IS-04 WebSocket for ${resourcePath}: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      registryWebSockets[resourcePath] = ws;

      ws.onopen = () => {
        console.log(`IS-04 WebSocket for ${resourcePath} connected successfully.`);
        wsReconnectAttempts[resourcePath] = 0;
        wsReconnectDelays[resourcePath] = INITIAL_RECONNECT_DELAY;
        // Notify frontend about the successful connection for this specific path
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'nmos_connection_status',
              status: 'connected',
              message: `IS-04 WebSocket for ${resourcePath} subscription active`,
              resourcePath: resourcePath
            }));
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const grain = JSON.parse(event.data);
          // Determine the resource type from the resourcePath for handleDataGrain
          const typeFromPath = resourcePath.startsWith('/') ? resourcePath.substring(1) : resourcePath;
          handleDataGrain(grain, typeFromPath); // Pass type for context
        } catch (error) {
          console.error(`Error parsing IS-04 WebSocket message for ${resourcePath}:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`IS-04 WebSocket error for ${resourcePath}:`, error.message || error);
        // Notify frontend about the error for this specific path
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'nmos_connection_status',
              status: 'error',
              message: `IS-04 WebSocket connection error for ${resourcePath}`,
              resourcePath: resourcePath
            }));
          }
        });
        // Note: onclose will handle reconnection attempts
      };

      ws.onclose = (event) => {
        console.log(`IS-04 WebSocket for ${resourcePath} closed: Code=${event.code}, Reason=${event.reason}`);
        // Notify frontend about the disconnection for this specific path
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'nmos_connection_status',
              status: 'disconnected',
              message: `IS-04 WebSocket for ${resourcePath} disconnected: ${event.reason || 'Connection closed'}`,
              resourcePath: resourcePath
            }));
          }
        });

        if (wsReconnectAttempts[resourcePath] < MAX_RECONNECT_ATTEMPTS) {
          wsReconnectAttempts[resourcePath]++;
          wsReconnectDelays[resourcePath] = Math.min(wsReconnectDelays[resourcePath] * 1.5, 30000);
          console.log(`Scheduling WebSocket reconnection for ${resourcePath} in ${wsReconnectDelays[resourcePath]}ms (attempt ${wsReconnectAttempts[resourcePath]}/${MAX_RECONNECT_ATTEMPTS})`);
          setTimeout(() => attemptSpecificSubscription(queryApiBaseUrl, resourcePath), wsReconnectDelays[resourcePath]);
        } else {
          console.error(`Maximum WebSocket reconnection attempts for ${resourcePath} (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
           wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                  type: 'nmos_connection_status', 
                  status: 'failed',
                  message: `IS-04 WebSocket connection for ${resourcePath} failed after maximum reconnection attempts`,
                  resourcePath: resourcePath
                }));
              }
            });
        }
      };
    } else {
      console.error(`Failed to create subscription or get WebSocket URL for ${resourcePath}.`);
      handleSubscriptionFailure(queryApiBaseUrl, `Failed to create subscription or get WebSocket URL for ${resourcePath}`, resourcePath);
    }
  } catch (error) {
    console.error(`Error in subscription process for ${resourcePath}:`, error);
    handleSubscriptionFailure(queryApiBaseUrl, `Error in subscription process for ${resourcePath}`, resourcePath);
  }
}

// Subscribes to updates from the registry.
// The `queryApiBaseUrl` parameter is the base URL of the Query API (e.g., http://host/x-nmos/query/v1.3)
async function subscribeToRegistryUpdates(queryApiBaseUrl) {
  if (!queryApiBaseUrl) {
    console.error('Error: queryApiBaseUrl not provided for IS-04 subscription.');
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'nmos_connection_status',
          status: 'error',
          message: 'Internal error: queryApiBaseUrl not provided for IS-04 subscription.'
        }));
      }
    });
    return;
  }

  // Close and clear all existing WebSockets before starting new subscriptions
  Object.keys(registryWebSockets).forEach(path => {
    if (registryWebSockets[path]) {
      try {
        console.log(`Closing WebSocket for ${path} as part of full subscription refresh.`);
        registryWebSockets[path].close(1000, 'Full subscription refresh initiated');
      } catch (e) {
        console.warn(`Error closing WebSocket for ${path} during refresh: ${e.message}`);
      }
    }
  });
  registryWebSockets = {};
  wsReconnectAttempts = {};
  wsReconnectDelays = {};

  console.log(`Starting full IS-04 subscription process using Query API base: ${queryApiBaseUrl}`);

  // fetchQueryApiRoot expects the Query API base URL
  const availableResourceTypes = await fetchQueryApiRoot(queryApiBaseUrl); 

  if (!availableResourceTypes || availableResourceTypes.length === 0) {
    console.error('Failed to fetch resource types from Query API root or no resource types found. Cannot create subscriptions.');
    // Notify frontend about the general failure
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'nmos_connection_status',
          status: 'error',
          message: 'Failed to discover any resource types from Query API root. Cannot subscribe.'
        }));
      }
    });
    return;
  }

  console.log(`Proceeding to create subscriptions for resource types: ${availableResourceTypes.join(', ')}`);

  // Filter out "subscriptions/" and any other non-resource type paths if necessary
  const subscribableResourceTypes = availableResourceTypes.filter(type => type !== 'subscriptions/' && !type.startsWith('admin/'));
  console.log('Attempting subscriptions for filtered resource types:', subscribableResourceTypes);

  if (!subscribableResourceTypes || subscribableResourceTypes.length === 0) {
    console.warn('No subscribable resource types left after filtering. No subscriptions will be made.');
    return;
  }

  for (const type of subscribableResourceTypes) {
    const resourcePath = `/${type.endsWith('/') ? type.slice(0, -1) : type}`; 
    // attemptSpecificSubscription now expects the Query API base URL
    await attemptSpecificSubscription(queryApiBaseUrl, resourcePath); 
  }
}

// Handles failures in the subscription process.
// The `queryApiBaseUrl` parameter is the base URL of the Query API.
function handleSubscriptionFailure(queryApiBaseUrl, errorMessage, resourcePath) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'nmos_connection_status',
        status: 'error',
        message: errorMessage,
        resourcePath: resourcePath 
      }));
    }
  });

  if (resourcePath) { 
    if (!wsReconnectAttempts[resourcePath]) wsReconnectAttempts[resourcePath] = 0;
    if (!wsReconnectDelays[resourcePath]) wsReconnectDelays[resourcePath] = INITIAL_RECONNECT_DELAY;

    if (wsReconnectAttempts[resourcePath] < MAX_RECONNECT_ATTEMPTS) {
      wsReconnectAttempts[resourcePath]++;
      wsReconnectDelays[resourcePath] = Math.min(wsReconnectDelays[resourcePath] * 1.5, 30000);
      console.log(`Scheduling subscription retry for ${resourcePath} in ${wsReconnectDelays[resourcePath]}ms (attempt ${wsReconnectAttempts[resourcePath]}/${MAX_RECONNECT_ATTEMPTS})`);
      // attemptSpecificSubscription now expects the Query API base URL
      setTimeout(() => attemptSpecificSubscription(queryApiBaseUrl, resourcePath), wsReconnectDelays[resourcePath]); 
    } else {
      console.error(`Maximum subscription retry attempts for ${resourcePath} (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'nmos_connection_status',
            status: 'failed',
            message: `IS-04 subscription for ${resourcePath} failed after maximum retry attempts`,
            resourcePath: resourcePath
          }));
        }
      });
    }
  } else {
    console.error(`Global subscription failure (no specific resource path): ${errorMessage}. Manual intervention may be required.`);
  }
}

// Function to handle incoming Data Grains
function handleDataGrain(grain, resourceType) { // Added resourceType parameter
  try {
    if (!grain || !grain.grain || !grain.grain.data) {
      console.error('Invalid data grain format:', grain);
      return;
    }
    
    // The 'topic' from grain.grain.topic (e.g., /nodes/) should align with the 'resourceType' parameter (e.g., "nodes")
    // The 'resourceType' parameter is now the authoritative source for the type of items in grain.grain.data.
    const { data } = grain.grain; // 'data' is the array of changes.

    // Validate the resourceType parameter itself
    if (!resourceType || !discoveredResources.hasOwnProperty(resourceType)) {
      console.warn(`Received grain with unknown or invalid resourceType parameter: '${resourceType}'. Full grain: ${JSON.stringify(grain)}`);
      return;
    }

    if (!Array.isArray(data)) {
      console.error(`Invalid data format in grain for resourceType '${resourceType}': expected array, got ${typeof data}. Grain: ${JSON.stringify(grain)}`);
      return;
    }

    const resourceArray = discoveredResources[resourceType];

    data.forEach(changeData => {
      if (!changeData || !changeData.path) {
        console.warn(`Invalid change data format or missing path in grain for resourceType '${resourceType}'. Change data: ${JSON.stringify(changeData)}`);
        return;
      }

      const resourceId = changeData.path; // This is the ID, e.g., "node_id_123"

      // The resourceType is already known from the function parameter.
      // No need to parse from pathParts.

      let changeType = '';
      if (changeData.post && !changeData.pre) { // New resource
        changeType = 'added';
        console.log(`Resource added: ${resourceType}/${resourceId}`);
        if (resourceType === 'receivers' && (!changeData.post.node_id)) {
          console.warn(`Receiver data from grain (added) is missing node_id. ID: ${resourceId}, Data: ${JSON.stringify(changeData.post)}`);
        }
        resourceArray.push(changeData.post);
      } else if (!changeData.post && changeData.pre) { // Removed resource
        changeType = 'removed';
        console.log(`Resource removed: ${resourceType}/${resourceId}`);
        const index = resourceArray.findIndex(res => res.id === resourceId);
        if (index !== -1) {
          resourceArray.splice(index, 1);
        }
      } else if (changeData.post && changeData.pre) { // Modified or synced resource
        const isSync = JSON.stringify(changeData.pre) === JSON.stringify(changeData.post);
        changeType = isSync ? 'synced' : 'modified';
        // console.log(`Resource ${changeType}: ${resourceType}/${resourceId}`); // Less verbose logging for sync/modify
        const index = resourceArray.findIndex(res => res.id === resourceId);
        if (index !== -1) {
          if (resourceType === 'receivers' && (!changeData.post.node_id)) {
            console.warn(`Receiver data from grain (modified/synced) is missing node_id. ID: ${resourceId}, Data: ${JSON.stringify(changeData.post)}`);
          }
          resourceArray[index] = changeData.post;
        } else {
          console.warn(`Resource ${resourceId} (type ${resourceType}) not found for ${changeType}, adding instead. This might indicate an issue with initial discovery or prior state.`);
          if (resourceType === 'receivers' && (!changeData.post.node_id)) {
             console.warn(`Receiver data from grain (modified/synced, added as new) is missing node_id. ID: ${resourceId}, Data: ${JSON.stringify(changeData.post)}`);
          }
          resourceArray.push(changeData.post);
        }
      } else {
        console.warn(`Unhandled change type for ${resourceType}/${resourceId}. changeData: ${JSON.stringify(changeData)}`);
        return; // Skip if no changeType can be determined
      }
      
      // Notify frontend about the resource change
      const updateMessage = {
        type: 'nmos_resource_update',
        resourceType: resourceType, // Use the function parameter
        resourceId: resourceId,    // Use the derived ID
        changeType,
        data: changeData.post || null // Send the 'post' state, or null if removed
      };

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(updateMessage));
        }
      });
    });

  } catch (error) {
    console.error(`Error processing data grain for resourceType '${resourceType}':`, error);
    const errorMessage = {
      type: 'nmos_error',
      message: 'Failed to process registry update',
      details: error.message
    };

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(errorMessage));
      }
    });
  }
}

// 处理数据粒度变化的函数



// API endpoint for frontend to get discovered resources
app.post('/api/is04/discover', async (req, res) => {
  const { registryUrl } = req.body;
  if (!registryUrl) {
    return res.status(400).json({ message: 'registryUrl is required in the request body.' });
  }
  if (!registryUrl.startsWith('http://') && !registryUrl.startsWith('https://')) {
    return res.status(400).json({ message: 'Invalid registryUrl format. Must start with http:// or https://' });
  }

  console.log(`API call to discover resources from: ${registryUrl}`);
  currentRegistryUrl = registryUrl; // Update current registry URL for subsequent calls

  try {
    const fetchedResources = await performIS04Discovery(registryUrl);

    // Structure the data hierarchically
    const flowsMap = new Map(fetchedResources.flows.map(flow => [flow.id, flow]));

    const structuredNodes = fetchedResources.nodes.map(node => {
      const devicesForNode = fetchedResources.devices
        .filter(device => device.node_id === node.id)
        .map(device => {
          const sendersForDevice = fetchedResources.senders
            .filter(sender => sender.device_id === device.id)
            .map(sender => ({
              ...sender,
              flow: flowsMap.get(sender.flow_id) || null, // Embed flow details
            }));
          const receiversForDevice = fetchedResources.receivers.filter(
            receiver => receiver.device_id === device.id
          );
          return {
            ...device,
            senders: sendersForDevice,
            receivers: receiversForDevice,
          };
        });
      return {
        ...node,
        devices: devicesForNode,
      };
    });

    res.json({
      message: 'Resources discovered successfully',
      data: {
        nodes: structuredNodes,
      },
    });

  } catch (error) {
    console.error(`Error in /api/is04/discover endpoint for registry ${registryUrl}:`, error.message);
    // The error might have already been logged by performIS04Discovery
    // and a WebSocket message might have been sent.
    // Ensure a response is sent to the HTTP client.
    res.status(500).json({
      message: 'An internal server error occurred during discovery.',
      error: error.message,
      details: error.response ? error.response.data : 'No response data',
    });
  }
});

// This endpoint now just returns the last discovered resources (globally stored).
// For a fresh fetch or change of registry, use POST /api/is04/discover
app.get('/api/is04/resources', (req, res) => {
  // This will return the globally stored `discoveredResources` which is updated by `performIS04Discovery`
  res.json(discoveredResources);
});

// The refresh endpoint re-runs discovery with the currentRegistryUrl and updates global state.
// It also returns the newly structured data similar to the /discover endpoint.
app.post('/api/is04/refresh', async (req, res) => {
  if (!currentRegistryUrl) {
    return res.status(400).json({ message: 'No registry URL has been set. Please use /api/is04/discover first.' });
  }
  console.log(`Refreshing IS-04 resources via API call using current registry: ${currentRegistryUrl}`);
  
  try {
    const fetchedResources = await performIS04Discovery(currentRegistryUrl); // Re-run discovery

    // Structure the data hierarchically (same logic as in /discover)
    const flowsMap = new Map(fetchedResources.flows.map(flow => [flow.id, flow]));

    const structuredNodes = fetchedResources.nodes.map(node => {
      const devicesForNode = fetchedResources.devices
        .filter(device => device.node_id === node.id)
        .map(device => {
          const sendersForDevice = fetchedResources.senders
            .filter(sender => sender.device_id === device.id)
            .map(sender => ({
              ...sender,
              flow: flowsMap.get(sender.flow_id) || null,
            }));
          const receiversForDevice = fetchedResources.receivers.filter(
            receiver => receiver.device_id === device.id
          );
          return {
            ...device,
            senders: sendersForDevice,
            receivers: receiversForDevice,
          };
        });
      return {
        ...node,
        devices: devicesForNode,
      };
    });

    res.json({
      message: `IS-04 resources refresh initiated and completed for ${currentRegistryUrl}.`,
      data: {
        nodes: structuredNodes,
      },
    });
  } catch (error) {
    console.error(`Error in /api/is04/refresh endpoint for registry ${currentRegistryUrl}:`, error.message);
    res.status(500).json({
      message: 'An internal server error occurred during refresh.',
      error: error.message,
      details: error.response ? error.response.data : 'No response data',
    });
  }
});

// API endpoint to stop connection to NMOS Registry
app.post('/api/nmos/stop-registry', (req, res) => {
  console.log('Received request to stop NMOS Registry connection.');

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('NMOS heartbeat stopped.');
  }

  // Close WebSocket connection
  Object.keys(registryWebSockets).forEach(path => {
    if (registryWebSockets[path]) {
      try {
        console.log(`Closing WebSocket for ${path} due to stop-registry request.`);
        registryWebSockets[path].close(1000, 'Stop registry request received');
      } catch (e) {
        console.warn(`Error closing WebSocket for ${path} during stop: ${e.message}`);
      }
    }
  });
  registryWebSockets = {};
  wsReconnectAttempts = {};
  wsReconnectDelays = {};
  console.log('All IS-04 WebSocket connections closed and management objects cleared.');

  // TODO: Implement logic to unregister from the registry if necessary (e.g., delete subscriptions)

  res.json({ message: 'Connection to NMOS Registry stopped.' });
});

// --- IS-05 Connection Management --- 
// 存储活动连接的映射表，用于跟踪当前连接状态
let activeConnections = {}; // 格式: { receiverId: { senderId, timestamp, status } }

// Helper function to determine the IS-05 connection API URL
function getConnectionApiUrl(node, serviceType, preferredVersion, fallbackVersion) {
  if (node && node.api && node.api.endpoints && Array.isArray(node.api.endpoints)) {
    const preferredEndpoint = node.api.endpoints.find(ep =>
      (ep.type === serviceType && ep.href && ep.href.includes(`/${preferredVersion}`)) ||
      (ep.href && ep.href.includes(`/x-nmos/connection/${preferredVersion}`)) // More specific check for connection API
    );
    if (preferredEndpoint && preferredEndpoint.href) {
      console.log(`Found ${preferredVersion} endpoint for ${serviceType} at ${node.id}: ${preferredEndpoint.href}`);
      return preferredEndpoint.href.replace(/\/?$/, ''); // Ensure no trailing slash
    }

    const fallbackEndpoint = node.api.endpoints.find(ep =>
      (ep.type === serviceType && ep.href && ep.href.includes(`/${fallbackVersion}`)) ||
      (ep.href && ep.href.includes(`/x-nmos/connection/${fallbackVersion}`)) // More specific check for connection API
    );
    if (fallbackEndpoint && fallbackEndpoint.href) {
      console.log(`Found ${fallbackVersion} endpoint for ${serviceType} at ${node.id}: ${fallbackEndpoint.href}`);
      return fallbackEndpoint.href.replace(/\/?$/, ''); // Ensure no trailing slash
    }
  }
  return null; // Indicates no specific endpoint found
}

async function initializeIS05ConnectionManager() {
  console.log('Initializing IS-05 Connection Manager...');
  
  // 获取连接状态的API端点
  app.get('/api/is05/connections', (req, res) => {
    res.json({
      connections: activeConnections,
      timestamp: Date.now()
    });
  });

  // 处理 IS-05 连接请求 (连接或断开)
  app.post('/api/is05/connections', async (req, res) => {
    console.log('Received IS-05 connection request body:', req.body); // Added log
    const { senderId, receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: '接收端ID是必需的。' });
    }

    // 查找目标接收端
    const receiver = discoveredResources.receivers.find(r => r.id === receiverId);
    if (!receiver) {
      return res.status(404).json({ message: `未找到接收端 ${receiverId}` });
    }

    // Validate receiver.node_id
    if (!receiver.node_id || typeof receiver.node_id !== 'string' || receiver.node_id.trim() === '') {
        console.error(`Error: Receiver with ID '${receiverId}' is missing a valid 'node_id'. Receiver data: ${JSON.stringify(receiver)}`);
        return res.status(500).json({ message: `Receiver '${receiverId}' has no associated node_id. Cannot proceed with IS-05 operation.` });
    }

    // 查找与接收端关联的节点以获取其API端点
    const receiverNode = discoveredResources.nodes.find(n => n.id === receiver.node_id);
    if (!receiverNode || !receiverNode.href) {
      return res.status(404).json({ message: `未找到接收端 ${receiverId} 关联的节点或其API端点。节点ID: ${receiver.node_id}` });
    }

    let connectionApiBaseUrl = getConnectionApiUrl(receiverNode, 'urn:x-nmos:service:connection', 'v1.1', 'v1.0');
    const nodeApiBaseUrl = receiverNode.href.replace(/\/?$/, ''); // Base for default construction

    if (!connectionApiBaseUrl) {
      console.log(`No specific IS-05 connection endpoint found for node ${receiverNode.id} in /api/is05/connections. Defaulting to v1.1 path construction.`);
      connectionApiBaseUrl = `${nodeApiBaseUrl}/x-nmos/connection/v1.1`;
    } else {
      // If connectionApiBaseUrl is a full URL from href, we use it directly.
      // The helper already ensures no trailing slash.
    }

    const stagedUrl = `${connectionApiBaseUrl}/single/receivers/${receiverId}/staged`;

    // 构建 PATCH 请求体
    const patchPayload = {
      sender_id: senderId || null, // senderId 为 null 表示断开连接
      activation: {
        mode: 'activate_immediate'
      }
    };

    console.log(`Attempting IS-05 PATCH request to: ${stagedUrl}`); // New log line
    console.log(`向接收端 ${receiverId} 的 staged 端点发送 PATCH 请求: ${stagedUrl}，负载:`, patchPayload);

    try {
      const response = await axios.patch(stagedUrl, patchPayload);
      console.log(`PATCH 请求成功，状态码: ${response.status}`);

      // 更新本地缓存状态 (可选，可以依赖 IS-04 WebSocket 更新)
      // For simplicity, we'll rely on IS-04 updates for now.
      // A more robust implementation might update cache immediately and then verify via IS-04.

      res.json({ message: '连接请求已发送', status: response.status, data: response.data });
    } catch (error) {
      console.error(`向接收端 ${receiverId} 发送 PATCH 请求失败:`, error.message);
      if (error.response) {
        console.error('错误详情:', error.response.status, error.response.data);
        return res.status(error.response.status).json({ message: '连接请求失败', error: error.response.data });
      } else {
        return res.status(500).json({ message: '连接请求失败', error: error.message });
      }
    }
  });

  // 获取特定接收端的连接状态
  app.get('/api/is05/connections/:receiverId', async (req, res) => {
    const { receiverId } = req.params;
    
    if (!receiverId) {
      return res.status(400).json({ message: '接收端ID是必需的。' });
    }
    
    // 检查本地缓存中的连接状态
    const cachedConnection = activeConnections[receiverId];
    
    // 如果接收端存在于我们的系统中，尝试从设备获取实际状态
    const receiver = discoveredResources.receivers.find(r => r.id === receiverId);
    if (receiver) {
      try {
        // 获取与接收端关联的节点以获取其API端点
        const receiverNode = discoveredResources.nodes.find(n => n.id === receiver.node_id);
        if (receiverNode && receiverNode.href) {
          let connectionApiBaseUrl = getConnectionApiUrl(receiverNode, 'urn:x-nmos:service:connection', 'v1.1', 'v1.0');
          const nodeApiBaseUrl = receiverNode.href.replace(/\/?$/, '');

          if (!connectionApiBaseUrl) {
            // console.log(`No specific IS-05 connection endpoint found for node ${receiverNode.id} in GET /api/is05/connections/:receiverId. Defaulting to v1.1 path construction.`);
            // Using a console.warn or a more specific log for GET might be too verbose, let's keep it lean for GET.
            connectionApiBaseUrl = `${nodeApiBaseUrl}/x-nmos/connection/v1.1`;
          }
          
          // 查询接收端的当前活动连接状态
          const activeUrl = `${connectionApiBaseUrl}/single/receivers/${receiverId}/active`;
          // console.log(`Attempting IS-05 GET request to: ${activeUrl}`); // Logging for GET might be too verbose
            const response = await axios.get(activeUrl, { timeout: 3000 });
            
            if (response.data && response.status === 200) {
              // 更新本地缓存
              const currentSenderId = response.data.sender_id || null;
              if (currentSenderId) {
                activeConnections[receiverId] = {
                  senderId: currentSenderId,
                  timestamp: Date.now(),
                  status: 'active',
                  transportParams: response.data.transport_params || []
                };
              } else if (activeConnections[receiverId]) {
                // 如果设备报告没有连接，但我们的缓存中有，则更新状态
                delete activeConnections[receiverId];
              }
              
              return res.json({
                receiverId,
                connection: activeConnections[receiverId] || { status: 'disconnected' },
                deviceStatus: response.data
              });
            }
          }
        }
      catch (error) {
        console.error(`获取接收端 ${receiverId} 连接状态时出错:`, error.message);
        // 如果查询失败，返回缓存的状态（如果有）
      }
    }
    
    // 如果无法从设备获取状态或发生错误，返回缓存的状态
    return res.json({
      receiverId,
      connection: cachedConnection || { status: 'unknown' },
      note: '这是缓存的状态，可能与设备实际状态不同'
    });
  });

  // IS-05 连接端点 - 建立发送端到接收端的连接
  app.post('/api/is05/connect', async (req, res) => {
    const { senderId, receiverId } = req.body;
    console.log(`尝试IS-05连接: 发送端 ${senderId} 到接收端 ${receiverId}`);

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: '发送端ID和接收端ID都是必需的。' });
    }

    const receiver = discoveredResources.receivers.find(r => r.id === receiverId);
    const sender = discoveredResources.senders.find(s => s.id === senderId);

    if (!receiver) {
      return res.status(404).json({ message: `未找到ID为 ${receiverId} 的接收端。` });
    }
    if (!sender) {
      return res.status(404).json({ message: `未找到ID为 ${senderId} 的发送端。` });
    }

    // Validate receiver.node_id
    if (!receiver.node_id || typeof receiver.node_id !== 'string' || receiver.node_id.trim() === '') {
        console.error(`Error: Receiver with ID '${receiverId}' is missing a valid 'node_id'. Receiver data: ${JSON.stringify(receiver)}`);
        return res.status(500).json({ message: `Receiver '${receiverId}' has no associated node_id. Cannot proceed with IS-05 operation.` });
    }

    // 查找与接收端关联的节点以获取其API端点
    const receiverNode = discoveredResources.nodes.find(n => n.id === receiver.node_id);
    if (!receiverNode || !receiverNode.href) {
        console.error(`未找到接收端 ${receiverId} 关联的节点或其API端点。节点ID: ${receiver.node_id}`);
        return res.status(500).json({ message: `未找到接收端 ${receiverId} 关联的节点或其API端点。` });
    }
    
    let receiverConnectionApiBaseUrl = getConnectionApiUrl(receiverNode, 'urn:x-nmos:service:connection', 'v1.1', 'v1.0');
    const receiverNodeApiBase = receiverNode.href.replace(/\/?$/, '');
    if (!receiverConnectionApiBaseUrl) {
      console.log(`No specific IS-05 connection endpoint found for receiver node ${receiverNode.id} in /api/is05/connect. Defaulting to v1.1 path construction.`);
      receiverConnectionApiBaseUrl = `${receiverNodeApiBase}/x-nmos/connection/v1.1`;
    }

    const targetUrl = `${receiverConnectionApiBaseUrl}/single/receivers/${receiverId}/staged`;
    
    console.log('Sender resource:', JSON.stringify(sender));
    console.log('Receiver resource:', JSON.stringify(receiver));

    // 查找与发送端关联的节点以获取其API端点
    const senderNode = discoveredResources.nodes.find(n => n.id === sender.node_id);
    if (!senderNode || !senderNode.href) {
        console.error(`未找到发送端 ${senderId} 关联的节点或其API端点。节点ID: ${sender.node_id}`);
        return res.status(500).json({ message: `未找到发送端 ${senderId} 关联的节点或其API端点。` });
    }

    let senderConnectionApiBaseUrl = getConnectionApiUrl(senderNode, 'urn:x-nmos:service:connection', 'v1.1', 'v1.0');
    const senderNodeApiBase = senderNode.href.replace(/\/?$/, '');
    if (!senderConnectionApiBaseUrl) {
      console.log(`No specific IS-05 connection endpoint found for sender node ${senderNode.id} in /api/is05/connect (for transportfile). Defaulting to v1.1 path construction.`);
      senderConnectionApiBaseUrl = `${senderNodeApiBase}/x-nmos/connection/v1.1`;
    }

    // 尝试从发送端获取transportfile
    const senderTransportFileUrl = `${senderConnectionApiBaseUrl}/single/senders/${senderId}/transportfile`;
    let transportFile = null;
    try {
        console.log(`Attempting to GET transportfile from: ${senderTransportFileUrl}`); // Log for transportfile GET
        const tfResponse = await axios.get(senderTransportFileUrl, { timeout: 3000 });
        if (tfResponse.data && tfResponse.status === 200) {
            transportFile = {
                data: tfResponse.data,
                type: tfResponse.headers['content-type'] || 'application/sdp'
            };
            console.log(`成功获取发送端 ${senderId} 的transportfile。`);
        } else {
             console.warn(`从发送端 ${senderId} 获取transportfile失败，状态码: ${tfResponse.status}`);
        }
    } catch (error) {
        console.error(`从发送端 ${senderId} 获取transportfile时出错:`, error.message);
    }

    // 准备IS-05 PATCH请求的负载
    const payload = {
      sender_id: senderId,
      master_enable: true, // 立即激活连接
      activation: {
        mode: "activate_immediate" // 立即激活模式
      },
      ...(transportFile && { transport_file: transportFile })
    };

    console.log(`Attempting IS-05 PATCH request to: ${targetUrl}`); // New log line
    console.log(`发送IS-05 PATCH请求到 ${targetUrl}，负载:`, JSON.stringify(payload));
    try {
      // 发送PATCH请求到接收端的staged端点
      const patchResponse = await axios.patch(targetUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000 // 5秒超时
      });
      
      console.log('IS-05 PATCH成功:', patchResponse.status, patchResponse.data);
      
      // 更新本地连接状态缓存
      activeConnections[receiverId] = {
        senderId,
        timestamp: Date.now(),
        status: 'active',
        transportParams: patchResponse.data.transport_params || []
      };
      
      // 通知所有连接的WebSocket客户端连接状态变化
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'nmos_connection_update',
            data: {
              receiverId,
              senderId,
              action: 'connected',
              timestamp: Date.now()
            }
          }));
        }
      });
      
      // 返回成功响应
      res.json({ 
        message: `成功发送IS-05连接请求，将发送端 ${senderId} 连接到接收端 ${receiverId}。`, 
        receiverResponse: patchResponse.data,
        connection: activeConnections[receiverId]
      });

    } catch (error) {
      console.error(`[IS-05 CONNECT ERROR] Error sending IS-05 PATCH request to ${targetUrl}:`, error.message);
      activeConnections[receiverId] = {
        senderId,
        timestamp: Date.now(),
        status: 'error',
        error: error.message,
        targetUrl: targetUrl,
        payload: payload // Log payload on error as well
      };
      console.log(`[IS-05 CONNECT INFO] Updated activeConnections cache for receiver ${receiverId} after error: ${JSON.stringify(activeConnections[receiverId])}`);

      if (error.response) {
        console.error(`[IS-05 CONNECT ERROR DETAILS] Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        return res.status(error.response.status || 500).json({
          message: `连接接收端 ${receiverId} 失败。设备响应: ${error.response.status}`,
          error: error.response.data,
          details: `Error during PATCH to ${targetUrl}`
        });
      }
      return res.status(500).json({ 
        message: `连接接收端 ${receiverId} 失败。内部服务器错误。`, 
        error: error.message,
        details: `Error during PATCH to ${targetUrl}`
      });
    }
  });

  // IS-05 断开连接端点
  app.post('/api/is05/disconnect', async (req, res) => {
    const { receiverId } = req.body;
    console.log(`尝试断开IS-05连接: 接收端 ${receiverId}`);

    if (!receiverId) {
      return res.status(400).json({ message: '接收端ID是必需的。' });
    }

    const receiver = discoveredResources.receivers.find(r => r.id === receiverId);

    if (!receiver) {
      return res.status(404).json({ message: `未找到ID为 ${receiverId} 的接收端。` });
    }

    // Validate receiver.node_id
    if (!receiver.node_id || typeof receiver.node_id !== 'string' || receiver.node_id.trim() === '') {
        console.error(`Error: Receiver with ID '${receiverId}' is missing a valid 'node_id'. Receiver data: ${JSON.stringify(receiver)}`);
        return res.status(500).json({ message: `Receiver '${receiverId}' has no associated node_id. Cannot proceed with IS-05 operation.` });
    }

    // 查找与接收端关联的节点以获取其API端点
    const receiverNode = discoveredResources.nodes.find(n => n.id === receiver.node_id);
    if (!receiverNode || !receiverNode.href) {
        console.error(`未找到接收端 ${receiverId} 关联的节点或其API端点。节点ID: ${receiver.node_id}`);
        return res.status(500).json({ message: `Control endpoint for receiver's node ${receiver.node_id} not found.` });
    }

    let receiverConnectionApiBaseUrl = getConnectionApiUrl(receiverNode, 'urn:x-nmos:service:connection', 'v1.1', 'v1.0');
    const receiverNodeApiBase = receiverNode.href.replace(/\/?$/, '');
    if (!receiverConnectionApiBaseUrl) {
      console.log(`No specific IS-05 connection endpoint found for receiver node ${receiverNode.id} in /api/is05/disconnect. Defaulting to v1.1 path construction.`);
      receiverConnectionApiBaseUrl = `${receiverNodeApiBase}/x-nmos/connection/v1.1`;
    }
    
    const targetUrl = `${receiverConnectionApiBaseUrl}/single/receivers/${receiverId}/staged`;

    // IS-05 disconnect is achieved by setting sender_id to null and master_enable to false
    const payload = {
      sender_id: null,
      master_enable: false, 
    };

    console.log(`Attempting IS-05 PATCH request to: ${targetUrl}`); // New log line
    console.log(`Sending IS-05 PATCH to ${targetUrl} with payload:`, JSON.stringify(payload));

    try {
      const patchResponse = await axios.patch(targetUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000 // 5 seconds timeout
      });
      
      console.log('IS-05 PATCH successful:', patchResponse.status, patchResponse.data);
      res.json({ 
        message: `Successfully sent IS-05 disconnection request for Receiver ${receiverId}.`, 
        receiverResponse: patchResponse.data 
      });

    } catch (error) {
      console.error(`Error during IS-05 PATCH to ${targetUrl}:`, error.message);
      if (error.response) {
        console.error('Error details:', error.response.status, error.response.data);
        res.status(error.response.status || 500).json({
          message: `Failed to disconnect Receiver ${receiverId}. Receiver API error.`, 
          error: error.response.data
        });
      } else if (error.request) {
        console.error('Error request:', error.request);
        res.status(504).json({ message: `Failed to disconnect: No response from receiver at ${targetUrl}.` });
      } else {
        res.status(500).json({ message: 'Failed to disconnect: Internal server error while making PATCH request.' });
      }
    }
  });
}