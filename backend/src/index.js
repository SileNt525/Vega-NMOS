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
const NMOS_REGISTRY_REGISTRATION_URL = process.env.NMOS_REGISTRY_REGISTRATION_URL || 'http://10.11.1.14:8010/x-nmos/registration/v1.3'; // Default Registration API URL
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
  // Perform initial IS-04 discovery
  await performIS04Discovery(currentRegistryUrl);
  console.log('After performing IS-04 Discovery.'); // Added log
});

// Move axios import to top of file to fix ReferenceError
const axios = require('axios');

// --- IS-04 Discovery --- 
let currentRegistryUrl = process.env.NMOS_REGISTRY_URL || 'http://10.11.1.14:8010/x-nmos/query/v1.3'; // Default, can be overridden by env var or API
let discoveredResources = {
  nodes: [],
  devices: [],
  sources: [],
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
    return []; // Return empty array on error
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
    return []; // Return empty array on error
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
      // Stop fetching on error
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
        // Ensure the returned URL is absolute if necessary, or handle relative URLs
        // For now, assuming the registry provides absolute URLs in the Link header
        return urlMatch[1];
      }
    }
  }
  console.log(`[getLinkByRel] No rel="${relType}" link found.`);
  return null; // Explicitly return null if no link with the specified rel is found
}

// Function to perform IS-04 discovery
async function performIS04Discovery(registryUrl) {
  console.log(`Performing IS-04 discovery from: ${registryUrl}`);
  const queryApiUrl = registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`;
  const sendersUrl = `${queryApiUrl}senders`;
  const receiversUrl = `${queryApiUrl}receivers`;

  try {
    // Fetch all Senders with pagination
    const senders = await fetchPaginatedResources(sendersUrl);
    discoveredResources.senders = senders;

    // Fetch all Receivers with pagination
    const receivers = await fetchPaginatedResources(receiversUrl);
    discoveredResources.receivers = receivers;

    console.log(`Discovered ${discoveredResources.senders.length} senders and ${discoveredResources.receivers.length} receivers.`);

    // Attempt to subscribe to IS-04 Query API WebSocket
    subscribeToRegistryUpdates(registryUrl);

  } catch (error) {
    console.error('Error performing IS-04 discovery:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
      // Notify frontend about the error
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'nmos_connection_status',
            status: 'error',
            message: `Failed to discover resources from Registry: ${error.response.statusText}`
          }));
        }
      });
    } else {
       wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'nmos_connection_status',
            status: 'error',
            message: `Failed to discover resources from Registry: ${error.message}`
          }));
        }
      });
    }
  }
}

// --- IS-04 WebSocket Subscription ---
let registryWebSocket = null;

async function createSubscription(registryUrl) {
  const subscriptionsUrl = `${registryUrl.replace(/\/?$/, '')}/subscriptions`;
  console.log(`Attempting to create IS-04 subscription at ${subscriptionsUrl}`);
  try {
    const response = await axios.post(subscriptionsUrl, {
      max_update_rate_ms: 100, // Request updates at most every 100ms
      resource_path: '/'
    });
    console.log(`Subscription creation successful: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`Error creating IS-04 subscription:`, error.message);
    if (error.response) {
      console.error('Error details:', error.response.status, error.response.data);
    }
    return null;
  }
}

// 增强的IS-04 WebSocket订阅功能，包含更完善的错误处理和重连逻辑
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1秒
let reconnectDelay = INITIAL_RECONNECT_DELAY;

function subscribeToRegistryUpdates(registryUrl) {
  // 关闭现有连接（如果有）
  if (registryWebSocket) {
    try {
      if (registryWebSocket.readyState === WebSocket.OPEN || 
          registryWebSocket.readyState === WebSocket.CONNECTING) {
        registryWebSocket.close();
      }
    } catch (err) {
      console.error('Error closing existing WebSocket:', err);
    }
    registryWebSocket = null;
  }

  console.log(`Attempting to subscribe to IS-04 updates from ${registryUrl}, attempt #${wsReconnectAttempts + 1}`);

  createSubscription(registryUrl)
    .then(subscription => {
      if (subscription && subscription.ws_href) {
        const wsUrl = subscription.ws_href.replace(/^http/, 'ws'); // 将http/https转换为ws/wss
        console.log(`Connecting to IS-04 WebSocket: ${wsUrl}`);
        
        try {
          registryWebSocket = new WebSocket(wsUrl);
          
          registryWebSocket.onopen = () => {
            console.log('IS-04 WebSocket connected successfully.');
            // 连接成功后重置重连计数器和延迟
            wsReconnectAttempts = 0;
            reconnectDelay = INITIAL_RECONNECT_DELAY;
            
            // 通知前端WebSocket已连接
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                  type: 'nmos_connection_status', 
                  status: 'connected',
                  message: 'IS-04 WebSocket subscription active'
                }));
              }
            });
          };

          registryWebSocket.onmessage = (event) => {
            try {
              const grain = JSON.parse(event.data);
              handleDataGrain(grain);
            } catch (error) {
              console.error('Error parsing IS-04 WebSocket message:', error);
            }
          };

          registryWebSocket.onerror = (error) => {
            console.error('IS-04 WebSocket error:', error);
            // 通知前端发生错误
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                  type: 'nmos_connection_status', 
                  status: 'error',
                  message: 'IS-04 WebSocket connection error'
                }));
              }
            });
          };

          registryWebSocket.onclose = (event) => {
            console.log(`IS-04 WebSocket closed: Code=${event.code}, Reason=${event.reason}`);
            
            // 通知前端连接已关闭
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                  type: 'nmos_connection_status', 
                  status: 'disconnected',
                  message: `IS-04 WebSocket disconnected: ${event.reason || 'Connection closed'}`
                }));
              }
            });
            
            // 实现指数退避重连策略
            if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              wsReconnectAttempts++;
              reconnectDelay = Math.min(reconnectDelay * 1.5, 30000); // 最大30秒延迟
              console.log(`Scheduling WebSocket reconnection in ${reconnectDelay}ms (attempt ${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
              setTimeout(() => subscribeToRegistryUpdates(registryUrl), reconnectDelay);
            } else {
              console.error(`Maximum WebSocket reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
              // 通知前端已达到最大重连次数
              wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ 
                    type: 'nmos_connection_status', 
                    status: 'failed',
                    message: 'IS-04 WebSocket connection failed after maximum reconnection attempts'
                  }));
                }
              });
            }
          };
        } catch (error) {
          console.error('Error creating WebSocket connection:', error);
          handleSubscriptionFailure(registryUrl, 'Error creating WebSocket connection');
        }
      } else {
        console.error('Failed to create subscription or get WebSocket URL.');
        handleSubscriptionFailure(registryUrl, 'Failed to create subscription or get WebSocket URL');
      }
    })
    .catch(error => {
      console.error('Error in subscription process:', error);
      handleSubscriptionFailure(registryUrl, 'Error in subscription process');
    });
}

function handleSubscriptionFailure(registryUrl, errorMessage) {
  // 通知前端订阅失败
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ 
        type: 'nmos_connection_status', 
        status: 'error',
        message: errorMessage
      }));
    }
  });
  
  // 实现指数退避重连策略
  if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    wsReconnectAttempts++;
    reconnectDelay = Math.min(reconnectDelay * 1.5, 30000); // 最大30秒延迟
    console.log(`Scheduling subscription retry in ${reconnectDelay}ms (attempt ${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    setTimeout(() => subscribeToRegistryUpdates(registryUrl), reconnectDelay);
  } else {
    console.error(`Maximum subscription retry attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
    // 通知前端已达到最大重试次数
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ 
          type: 'nmos_connection_status', 
          status: 'failed',
          message: 'IS-04 subscription failed after maximum retry attempts'
        }));
      }
    });
  }
}

// Function to handle incoming Data Grains
function handleDataGrain(grain) {
  try {
    if (!grain || !grain.grain || !grain.grain.data) {
      console.error('Invalid data grain format:', grain);
      return;
    }
    
    const { topic, data } = grain.grain;
    
    // 根据topic类型处理不同资源变更
    switch (topic) {
      case '/nodes/':
      case '/devices/':
      case '/sources/':
      case '/flows/':
      case '/senders/':
      case '/receivers/':
        if (!Array.isArray(data)) {
          console.error('Invalid data format: expected array', data);
          return;
        }

        data.forEach(changeData => {
          if (!changeData || !changeData.path) {
            console.warn('Invalid change data format:', changeData);
            return;
          }

          const resourcePath = changeData.path;
      const pathParts = resourcePath.split('/');
      const resourceType = pathParts[1];
      const resourceId = pathParts[2];
          
          if (!resourceType || !resourceId) {
            console.warn('Received malformed data grain path:', resourcePath);
            return;
          }
          
          // 处理不同类型的变更
          const resourceArray = discoveredResources[resourceType];
          if (!Array.isArray(resourceArray)) {
            console.warn(`Unknown resource type: ${resourceType}`);
            return;
          }

          let changeType = '';
          if (changeData.post && !changeData.pre) { // 新增资源
            changeType = 'added';
            console.log(`Resource added: ${resourceType}/${resourceId}`);
            resourceArray.push(changeData.post);
          } else if (!changeData.post && changeData.pre) { // 移除资源
            changeType = 'removed';
            console.log(`Resource removed: ${resourceType}/${resourceId}`);
            const index = resourceArray.findIndex(res => res.id === resourceId);
            if (index !== -1) {
              resourceArray.splice(index, 1);
            }
          } else if (changeData.post && changeData.pre) { // 修改或同步
            const isSync = JSON.stringify(changeData.pre) === JSON.stringify(changeData.post);
            changeType = isSync ? 'synced' : 'modified';
            console.log(`Resource ${changeType}: ${resourceType}/${resourceId}`);
            const index = resourceArray.findIndex(res => res.id === resourceId);
            if (index !== -1) {
              resourceArray[index] = changeData.post;
            } else {
              resourceArray.push(changeData.post);
            }
          }
          
          // 通知前端资源变更
          const updateMessage = {
            type: 'nmos_resource_update',
            resourceType,
            resourceId,
            changeType,
            data: changeData.post || null
          };

          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(updateMessage));
            }
          });
        });
        break;
        
      default:
        console.log(`Received unhandled resource type change: ${topic}`);
    }
  } catch (error) {
    console.error('Error processing data grain:', error);
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
  try {
  const { registryUrl } = req.body;
  if (!registryUrl) {
    return res.status(400).json({ message: 'registryUrl is required in the request body.' });
  }
  // Basic URL validation (can be more sophisticated)
  if (!registryUrl.startsWith('http://') && !registryUrl.startsWith('https://')) {
    return res.status(400).json({ message: 'Invalid registryUrl format. Must start with http:// or https://' });
  }

  console.log(`API call to discover resources from: ${registryUrl}`);
  currentRegistryUrl = registryUrl; // Update current registry URL for subsequent calls if needed
  await performIS04Discovery(registryUrl);
  res.json({ message: `IS-04 discovery initiated for ${registryUrl}.`, data: discoveredResources });
  } catch (error) {
    console.error('Unhandled error in /api/is04/discover:', error);
    res.status(500).json({ message: 'An internal server error occurred during discovery.', error: error.message });
  }
});

// This endpoint now just returns the last discovered resources.
// For a fresh fetch or change of registry, use POST /api/is04/discover
app.get('/api/is04/resources', (req, res) => {
  res.json(discoveredResources);
});

// The refresh endpoint might be redundant now, or could be re-purposed to use currentRegistryUrl
// For now, let's have it use the globally stored currentRegistryUrl
app.post('/api/is04/refresh', async (req, res) => {
  console.log(`Refreshing IS-04 resources via API call using current registry: ${currentRegistryUrl}`);
  await performIS04Discovery(currentRegistryUrl); // Re-run discovery with current URL
  res.json({ message: `IS-04 resources refresh initiated for ${currentRegistryUrl}.`, data: discoveredResources });
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
  if (registryWebSocket) {
    registryWebSocket.close();
    registryWebSocket = null;
    console.log('IS-04 WebSocket connection closed.');
  }

  // TODO: Implement logic to unregister from the registry if necessary

  res.json({ message: 'Connection to NMOS Registry stopped.' });
});

// --- IS-05 Connection Management --- 
// 存储活动连接的映射表，用于跟踪当前连接状态
let activeConnections = {}; // 格式: { receiverId: { senderId, timestamp, status } }

async function initializeIS05ConnectionManager() {
  console.log('Initializing IS-05 Connection Manager...');
  
  // 获取连接状态的API端点
  app.get('/api/is05/connections', (req, res) => {
    res.json({
      connections: activeConnections,
      timestamp: Date.now()
    });
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
        // 获取接收端设备的控制端点
        const receiverDevice = discoveredResources.devices.find(d => d.id === receiver.device_id);
        if (receiverDevice && receiverDevice.controls && receiverDevice.controls.length > 0) {
          const connectionApiBaseUrl = receiverDevice.controls.find(c => 
            c.type === "urn:x-nmos:control:connection/v1.1" || c.type === "urn:x-nmos:control:connection/v1.0"
          )?.href;
          
          if (connectionApiBaseUrl) {
            // 查询接收端的当前活动连接状态
            const activeUrl = `${connectionApiBaseUrl.replace(/\/?$/, '')}/receivers/${receiverId}/active`;
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
      } catch (error) {
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

    // 查找与接收端关联的设备以获取其API端点
    const receiverDevice = discoveredResources.devices.find(d => d.id === receiver.device_id);
    if (!receiverDevice || !receiverDevice.controls || receiverDevice.controls.length === 0) {
        console.error(`未找到接收端设备 ${receiver.device_id} 的控制端点。设备信息:`, receiverDevice);
        return res.status(500).json({ message: `未找到接收端设备 ${receiver.device_id} 的控制端点。` });
    }
    
    // 查找合适的IS-05控制端点
    const connectionApiBaseUrl = receiverDevice.controls.find(c =>
      c.type === "urn:x-nmos:control:connection/v1.1" || c.type === "urn:x-nmos:control:connection/v1.0"
    )?.href;
    
    if(!connectionApiBaseUrl){
        console.error(`未找到设备 ${receiver.device_id} 的合适IS-05控制端点。设备控制信息:`, JSON.stringify(receiverDevice.controls));
        return res.status(500).json({
          message: `未找到设备 ${receiver.device_id} 的合适IS-05控制端点。控制端点: ${JSON.stringify(receiverDevice.controls)}`
        });
    }

    const targetUrl = `${connectionApiBaseUrl.replace(/\/?$/, '')}/receivers/${receiverId}/staged`;
    
    console.log('Sender resource:', JSON.stringify(sender));
    console.log('Receiver resource:', JSON.stringify(receiver));

    // 查找与发送端关联的设备以获取其API端点
    const senderDevice = discoveredResources.devices.find(d => d.id === sender.device_id);
    if (!senderDevice || !senderDevice.controls || senderDevice.controls.length === 0) {
        return res.status(500).json({ message: `未找到发送端设备 ${sender.device_id} 的控制端点。` });
    }

    // 查找合适的IS-05控制端点 for Sender
    const senderConnectionApiBaseUrl = senderDevice.controls.find(c =>
      c.type === "urn:x-nmos:control:connection/v1.1" || c.type === "urn:x-nmos:control:connection/v1.0"
    )?.href;

    if(!senderConnectionApiBaseUrl){
        console.error('未找到发送端设备的合适IS-05控制端点:', JSON.stringify(senderDevice, null, 2));
        return res.status(500).json({ message: `未找到发送端设备 ${sender.device_id} 的合适IS-05控制端点。控制端点: ${JSON.stringify(senderDevice.controls)}` });
    }

    // 尝试从发送端获取transportfile
    const senderTransportFileUrl = `${senderConnectionApiBaseUrl.replace(/\/?$/, '')}/senders/${senderId}/transportfile`;
    let transportFile = null;
    try {
        console.log(`尝试从发送端 ${senderId} 获取transportfile: ${senderTransportFileUrl}`);
        const tfResponse = await axios.get(senderTransportFileUrl, { 
            timeout: 3000,
            headers: {
                'Accept': 'application/sdp, application/json',
                'Content-Type': 'application/json'
            },
            validateStatus: function (status) {
                return status >= 200 && status < 300; // 只接受2xx的响应
            }
        });

        // 检查响应内容类型
        const contentType = tfResponse.headers['content-type'];
        if (!contentType || (!contentType.includes('application/sdp') && !contentType.includes('application/json'))) {
            console.warn(`收到意外的Content-Type: ${contentType}，响应内容:`, tfResponse.data);
            throw new Error(`Unexpected content type: ${contentType}`);
        }

        if (tfResponse.data) {
            transportFile = {
                data: tfResponse.data,
                type: contentType
            };
            console.log(`成功获取发送端 ${senderId} 的transportfile。`);
            console.log('获取到的transportfile内容:', transportFile);
        } else {
            console.warn(`从发送端 ${senderId} 获取到的transportfile为空`);
        }
    } catch (error) {
        console.error(`从发送端 ${senderId} 获取transportfile时出错:`, {
            message: error.message,
            url: senderTransportFileUrl,
            responseData: error.response?.data,
            responseHeaders: error.response?.headers,
            responseStatus: error.response?.status
        });
        // 记录错误但继续执行，因为transportfile是可选的
    }

    // 准备IS-05 PATCH请求的负载
    const payload = {
        sender_id: senderId,
        master_enable: true,
        activation: {
            mode: "activate_immediate"
        }
    };

    // 仅在成功获取到transportfile时才添加到payload
    if (transportFile && transportFile.data) {
        payload.transport_file = transportFile;
        console.log('已将transportfile添加到请求负载中');
    } else {
        console.log('未添加transportfile到请求负载中，将使用默认transport_params');
    }

    console.log(`发送IS-05 PATCH请求到 ${targetUrl}，负载:`, JSON.stringify(payload, null, 2));
    try {
        // 发送PATCH请求到接收端的staged端点
        const patchResponse = await axios.patch(targetUrl, payload, {
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 5000,
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            }
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
      console.error(`向 ${targetUrl} 发送IS-05 PATCH请求时出错:`, error.message);
      
      // 根据错误类型返回适当的错误响应
      if (error.response) {
        console.error('错误详情:', error.response.status, error.response.data);
        res.status(error.response.status || 500).json({
          message: `连接失败: 发送端 ${senderId} 到接收端 ${receiverId}。接收端API错误。`, 
          error: error.response.data
        });
      } else if (error.request) {
        console.error('请求错误:', error.request);
        res.status(504).json({ 
          message: `连接失败: 接收端 ${targetUrl} 无响应。` 
        });
      } else {
        res.status(500).json({ 
          message: '连接失败: 发送PATCH请求时发生内部服务器错误。' 
        });
      }
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

    // 查找与接收端关联的设备以获取其API端点
    const receiverDevice = discoveredResources.devices.find(d => d.id === receiver.device_id);
    if (!receiverDevice || !receiverDevice.controls || receiverDevice.controls.length === 0) {
        return res.status(500).json({ message: `Control endpoint for receiver's device ${receiver.device_id} not found.` });
    }
    // 查找合适的IS-05控制端点
    const connectionApiBaseUrl = receiverDevice.controls.find(c => 
      c.type === "urn:x-nmos:control:connection/v1.1" || c.type === "urn:x-nmos:control:connection/v1.0"
    )?.href;
    
    if(!connectionApiBaseUrl){
        console.error('Suitable IS-05 control endpoint not found for device:', receiverDevice);
        return res.status(500).json({ message: `Suitable IS-05 control endpoint not found for device ${receiver.device_id}. Controls: ${JSON.stringify(receiverDevice.controls)}` });
    }

    const targetUrl = `${connectionApiBaseUrl.replace(/\/?$/, '')}/receivers/${receiverId}/staged`;

    // IS-05 disconnect is achieved by setting sender_id to null and master_enable to false
    const payload = {
      sender_id: null,
      master_enable: false, 
    };

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