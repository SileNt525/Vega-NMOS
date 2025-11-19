const os = require('os');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
const HOSTNAME = os.hostname();

// NMOS Registry Configuration
const NMOS_REGISTRY_REGISTRATION_URL = process.env.NMOS_REGISTRY_REGISTRATION_URL;
const NMOS_HEARTBEAT_INTERVAL_MS = parseInt(process.env.NMOS_HEARTBEAT_INTERVAL_MS || '5000', 10);
const NMOS_REGISTRY_URL = process.env.NMOS_REGISTRY_URL; // Query API URL

// Static IDs for this instance
const NODE_ID = uuidv4();
const DEVICE_ID = uuidv4();
const VERSION = '1.0.0';

module.exports = {
  PORT,
  HOSTNAME,
  NMOS_REGISTRY_REGISTRATION_URL,
  NMOS_HEARTBEAT_INTERVAL_MS,
  NMOS_REGISTRY_URL,
  NODE_ID,
  DEVICE_ID,
  VERSION
};
