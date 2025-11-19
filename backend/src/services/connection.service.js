const axios = require('axios');
const discoveryService = require('./discovery.service');

class ConnectionService {
    constructor() {
        this.activeConnections = {}; // { receiverId: { senderId, status, ... } }
    }

    async connect(senderId, receiverId) {
        const resources = discoveryService.getDiscoveredResources();
        const receiver = resources.receivers.find(r => r.id === receiverId);
        const sender = resources.senders.find(s => s.id === senderId);

        if (!receiver) throw new Error(`Receiver ${receiverId} not found`);
        if (!sender) throw new Error(`Sender ${senderId} not found`);

        const receiverNode = resources.nodes.find(n => n.id === receiver.node_id);
        if (!receiverNode) throw new Error(`Node for receiver ${receiverId} not found`);

        const connectionApiUrl = this.getConnectionApiUrl(receiverNode);
        const stagedUrl = `${connectionApiUrl}/single/receivers/${receiverId}/staged`;

        // Get Transport File (SDP) from Sender
        let transportFile = null;
        try {
            const senderNode = resources.nodes.find(n => n.id === sender.node_id);
            if (senderNode) {
                const senderApiUrl = this.getConnectionApiUrl(senderNode);
                const tfUrl = `${senderApiUrl}/single/senders/${senderId}/transportfile`;
                const res = await axios.get(tfUrl);
                transportFile = {
                    data: res.data,
                    type: res.headers['content-type'] || 'application/sdp'
                };
            }
        } catch (e) {
            console.warn(`Failed to get transport file for sender ${senderId}:`, e.message);
        }

        const payload = {
            sender_id: senderId,
            master_enable: true,
            activation: { mode: 'activate_immediate' },
            ...(transportFile && { transport_file: transportFile })
        };

        try {
            const response = await axios.patch(stagedUrl, payload);

            this.activeConnections[receiverId] = {
                senderId,
                status: 'active',
                timestamp: Date.now(),
                transportParams: response.data.transport_params
            };

            return response.data;
        } catch (error) {
            console.error(`Connection failed:`, error.message);
            throw error;
        }
    }

    async disconnect(receiverId) {
        const resources = discoveryService.getDiscoveredResources();
        const receiver = resources.receivers.find(r => r.id === receiverId);
        if (!receiver) throw new Error(`Receiver ${receiverId} not found`);

        const receiverNode = resources.nodes.find(n => n.id === receiver.node_id);
        if (!receiverNode) throw new Error(`Node for receiver ${receiverId} not found`);

        const connectionApiUrl = this.getConnectionApiUrl(receiverNode);
        const stagedUrl = `${connectionApiUrl}/single/receivers/${receiverId}/staged`;

        const payload = {
            sender_id: null,
            master_enable: false,
            activation: { mode: 'activate_immediate' }
        };

        try {
            const response = await axios.patch(stagedUrl, payload);

            if (this.activeConnections[receiverId]) {
                delete this.activeConnections[receiverId];
            }

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    getConnectionApiUrl(node) {
        // Simplified logic to find IS-05 endpoint
        // In a real app, iterate over node.api.endpoints and match urn:x-nmos:service:connection
        // For now, assuming standard path if not found or just basic construction
        const endpoint = node.api.endpoints.find(ep => ep.type === 'urn:x-nmos:service:connection');
        if (endpoint && endpoint.href) return endpoint.href.replace(/\/$/, '');

        // Fallback
        return `${node.href.replace(/\/$/, '')}/x-nmos/connection/v1.1`;
    }

    getActiveConnections() {
        return this.activeConnections;
    }
}

module.exports = new ConnectionService();
