const axios = require('axios');
const {
    NMOS_REGISTRY_REGISTRATION_URL,
    NMOS_HEARTBEAT_INTERVAL_MS,
    NODE_ID,
    DEVICE_ID,
    HOSTNAME,
    PORT,
    VERSION
} = require('../config/config');

class NmosRegistryService {
    constructor() {
        this.heartbeatInterval = null;
        this.retryCount = 0;
        this.MAX_REGISTRATION_RETRIES = 3;
        this.RETRY_DELAY_MS = 2000;

        // Define Resources
        this.nodeResource = {
            id: NODE_ID,
            version: Date.now().toString(),
            label: 'Vega-NMOS Panel Backend Node',
            description: 'NMOS Node representing the Vega-NMOS Control Panel backend service.',
            tags: {},
            hostname: HOSTNAME,
            api: {
                versions: [
                    {
                        version: '1.3',
                        endpoints: [
                            { format: 'internal', path: '/', protocol: 'http' }
                        ]
                    }
                ],
                ch_hostname: HOSTNAME,
                ch_port: PORT,
                ch_protocol: 'http'
            },
            href: `http://${HOSTNAME}:${PORT}/`,
            services: [],
            clocks: [],
            interfaces: []
        };

        this.deviceResource = {
            id: DEVICE_ID,
            version: Date.now().toString(),
            label: 'Vega-NMOS Panel Controller',
            description: 'Virtual device representing the control panel functionality.',
            tags: {},
            node_id: NODE_ID,
            type: 'urn:x-nmos:device:control', // Using the control type
            senders: [],
            receivers: [],
            controls: [
                {
                    href: `http://${HOSTNAME}:${PORT}/api/v1`,
                    type: 'urn:x-nmos:control:sr-ctrl/v1.1'
                }
            ]
        };
    }

    async register() {
        if (!NMOS_REGISTRY_REGISTRATION_URL) {
            console.error('Error: NMOS_REGISTRY_REGISTRATION_URL not set.');
            return false;
        }

        console.log(`Registering Node ${NODE_ID} and Device ${DEVICE_ID} to ${NMOS_REGISTRY_REGISTRATION_URL}`);

        try {
            // Register Node
            await this.registerResource('node', this.nodeResource);
            // Register Device
            await this.registerResource('device', this.deviceResource);

            console.log('NMOS Registration complete.');
            this.startHeartbeat();
            return true;
        } catch (error) {
            console.error('Registration failed:', error.message);
            return false;
        }
    }

    async registerResource(type, resource) {
        // Update version on re-registration
        resource.version = `${Date.now()}:0`; // TAI format-ish or just string
        const registrationUrl = `${NMOS_REGISTRY_REGISTRATION_URL}/resource`;

        // Try single resource POST first (standard IS-04 Registration API)
        try {
            await axios.post(registrationUrl, { type, data: resource });
        } catch (error) {
            // Fallback or specific error handling
            throw error;
        }
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        this.heartbeatInterval = setInterval(async () => {
            try {
                await axios.post(`${NMOS_REGISTRY_REGISTRATION_URL}/health/nodes/${NODE_ID}`);
            } catch (error) {
                console.error(`Heartbeat failed for Node ${NODE_ID}:`, error.message);
                if (error.response && error.response.status === 404) {
                    console.log('Node not found in registry, re-registering...');
                    await this.register();
                }
            }
        }, NMOS_HEARTBEAT_INTERVAL_MS);
    }

    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        // Logic to unregister could go here
    }
}

module.exports = new NmosRegistryService();
