require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { PORT } = require('./config/config');

const nmosRegistryService = require('./services/nmos-registry.service');
const discoveryService = require('./services/discovery.service');

const is04Routes = require('./routes/is04.routes');
const is05Routes = require('./routes/is05.routes');
const is07Routes = require('./routes/is07.routes');
const is08Routes = require('./routes/is08.routes');
const nmosRoutes = require('./routes/nmos.routes');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/is04', is04Routes);
app.use('/api/is05', is05Routes);
app.use('/api/is07', is07Routes);
app.use('/api/is08', is08Routes);
app.use('/api/nmos', nmosRoutes);

app.get('/', (req, res) => {
  res.send('Vega-NMOS Backend is running (Refactored)');
});

// WebSocket Handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  ws.send(JSON.stringify({ type: 'welcome', message: 'Welcome to Vega-NMOS WebSocket server!' }));
});

// Broadcast helper
const broadcast = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Listen to Discovery Service Events
discoveryService.on('resourceUpdate', (update) => {
  broadcast({
    type: 'nmos_resource_update',
    resourceType: update.type,
    resourceId: update.id,
    changeType: update.changeType,
    data: update.data
  });
});

discoveryService.on('connectionStatus', (status) => {
  broadcast({
    type: 'nmos_connection_status',
    ...status
  });
});

// Start Server
server.listen(PORT, async () => {
  console.log(`Backend server is listening on port ${PORT}`);

  // Start NMOS Registration
  await nmosRegistryService.register();
});