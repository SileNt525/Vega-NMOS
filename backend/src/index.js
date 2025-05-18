const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

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

server.listen(PORT, () => {
  console.log(`Backend server is listening on port ${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}`)
});

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

async function performIS04Discovery(registryUrl) {
  console.log(`Performing IS-04 Discovery against Registry: ${registryUrl}`);
  
  // Clear previous results before new discovery
  discoveredResources = {
    nodes: [],
    devices: [],
    sources: [],
    flows: [],
    senders: [],
    receivers: [],
  };

  discoveredResources.nodes = await fetchFromRegistry('nodes', registryUrl);
  discoveredResources.devices = await fetchFromRegistry('devices', registryUrl);
  discoveredResources.sources = await fetchFromRegistry('sources', registryUrl);
  discoveredResources.flows = await fetchFromRegistry('flows', registryUrl);
  discoveredResources.senders = await fetchFromRegistry('senders', registryUrl);
  discoveredResources.receivers = await fetchFromRegistry('receivers', registryUrl);

  console.log('IS-04 Discovery complete for:', registryUrl);
  // TODO: Implement WebSocket subscription for real-time updates (would also need to handle registryUrl changes)
}

// Initial discovery on startup using the default/env URL
performIS04Discovery(currentRegistryUrl);

// API endpoint for frontend to get discovered resources
app.post('/api/is04/discover', async (req, res) => {
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

// --- IS-05 Connection Management --- 
function initializeIS05ConnectionManager() {
  console.log('Initializing IS-05 Connection Manager...');
  // TODO: Implement API endpoints for IS-05 operations
  // e.g., POST /connect, POST /disconnect
  // These endpoints will interact with NMOS Senders and Receivers
  app.post('/api/is05/connect', async (req, res) => {
    const { senderId, receiverId } = req.body;
    console.log(`Attempting IS-05 connection: Sender ${senderId} to Receiver ${receiverId}`);

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'senderId and receiverId are required.' });
    }

    const receiver = discoveredResources.receivers.find(r => r.id === receiverId);
    const sender = discoveredResources.senders.find(s => s.id === senderId);

    if (!receiver) {
      return res.status(404).json({ message: `Receiver with ID ${receiverId} not found.` });
    }
    if (!sender) {
      return res.status(404).json({ message: `Sender with ID ${senderId} not found.` });
    }

    // Find the device associated with the receiver to get its API endpoint
    const receiverDevice = discoveredResources.devices.find(d => d.id === receiver.device_id);
    if (!receiverDevice || !receiverDevice.controls || receiverDevice.controls.length === 0) {
        return res.status(500).json({ message: `Control endpoint for receiver's device ${receiver.device_id} not found.` });
    }
    // Assuming the first control URL is the correct one and it's for Connection API v1.1
    // Example control URL: "http://[ip]:[port]/x-nmos/connection/v1.1"
    const connectionApiBaseUrl = receiverDevice.controls.find(c => c.type === "urn:x-nmos:control:sr-ctrl/v1.1" || c.type === "urn:x-nmos:control:sr-ctrl/v1.0" )?.href;
    if(!connectionApiBaseUrl){
        console.error('Suitable IS-05 control endpoint not found for device:', receiverDevice);
        return res.status(500).json({ message: `Suitable IS-05 control endpoint not found for device ${receiver.device_id}. Controls: ${JSON.stringify(receiverDevice.controls)}` });
    }

    const targetUrl = `${connectionApiBaseUrl.replace(/\/?$/, '')}/receivers/${receiverId}/staged`;
    
    const payload = {
      sender_id: senderId,
      master_enable: true, // Activate the connection immediately
      // transport_params: [] // IS-05 v1.1+ uses sender_id and receiver figures out params
                           // For older versions or specific needs, transport_params might be needed based on sender.transport
    };

    console.log(`Sending IS-05 PATCH to ${targetUrl} with payload:`, JSON.stringify(payload));

    try {
      const patchResponse = await axios.patch(targetUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        // It's good practice to set a timeout for external API calls
        timeout: 5000 // 5 seconds timeout
      });
      
      console.log('IS-05 PATCH successful:', patchResponse.status, patchResponse.data);
      // The response from the receiver (patchResponse.data) contains the new staged parameters.
      // It's good practice to update our local 'discoveredResources.receivers' if the response indicates changes.
      // For simplicity, we'll just return success here.
      res.json({ 
        message: `Successfully sent IS-05 connection request for Sender ${senderId} to Receiver ${receiverId}.`, 
        receiverResponse: patchResponse.data 
      });

    } catch (error) {
      console.error(`Error during IS-05 PATCH to ${targetUrl}:`, error.message);
      if (error.response) {
        console.error('Error details:', error.response.status, error.response.data);
        res.status(error.response.status || 500).json({
          message: `Failed to connect Sender ${senderId} to Receiver ${receiverId}. Receiver API error.`, 
          error: error.response.data
        });
      } else if (error.request) {
        console.error('Error request:', error.request);
        res.status(504).json({ message: `Failed to connect: No response from receiver at ${targetUrl}.` });
      } else {
        res.status(500).json({ message: 'Failed to connect: Internal server error while making PATCH request.' });
      }
    }
  });
}

// Middleware for parsing JSON bodies (important for POST requests like IS-05)
app.use(express.json());

// Start core services
// performIS04Discovery(currentRegistryUrl); // Initial discovery is now called at the end of its definition
initializeIS05ConnectionManager();