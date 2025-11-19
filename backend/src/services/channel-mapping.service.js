const axios = require('axios');
const discoveryService = require('./discovery.service');

class ChannelMappingService {

    async getMapping(deviceId, ioId, isInput = true) {
        const apiUrl = this.getChannelMappingApiUrl(deviceId);
        if (!apiUrl) throw new Error(`IS-08 API not found for device ${deviceId}`);

        const type = isInput ? 'inputs' : 'outputs';
        const url = `${apiUrl}/single/${type}/${ioId}/map/active`;

        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get mapping: ${error.message}`);
        }
    }

    async setMapping(deviceId, ioId, mapEntries, isInput = true) {
        const apiUrl = this.getChannelMappingApiUrl(deviceId);
        if (!apiUrl) throw new Error(`IS-08 API not found for device ${deviceId}`);

        const type = isInput ? 'inputs' : 'outputs';
        const url = `${apiUrl}/single/${type}/${ioId}/map/active`;

        const payload = {
            map: mapEntries // IS-08 structure
        };

        try {
            const response = await axios.post(url, payload);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to set mapping: ${error.message}`);
        }
    }

    getChannelMappingApiUrl(deviceId) {
        const resources = discoveryService.getDiscoveredResources();
        const device = resources.devices.find(d => d.id === deviceId);
        if (!device) return null;

        const node = resources.nodes.find(n => n.id === device.node_id);
        if (!node) return null;

        // Look for urn:x-nmos:service:audio-channel-mapping
        const endpoint = node.api.endpoints.find(ep => ep.type === 'urn:x-nmos:service:audio-channel-mapping');
        if (endpoint && endpoint.href) return endpoint.href.replace(/\/$/, '');

        // Fallback
        return `${node.href.replace(/\/$/, '')}/x-nmos/channelmapping/v1.0`;
    }
}

module.exports = new ChannelMappingService();
