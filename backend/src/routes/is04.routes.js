const express = require('express');
const router = express.Router();
const discoveryService = require('../services/discovery.service');

router.post('/discover', async (req, res) => {
    const { registryUrl } = req.body;
    try {
        const resources = await discoveryService.discover(registryUrl);

        // Structure data for frontend (simplified for now, or copy the mapping logic)
        // The frontend expects a nested structure (Nodes -> Devices -> Senders/Receivers)
        // I should probably move that formatting logic to the service or keep it here.
        // For now, I'll just return the raw resources and let the frontend handle it 
        // OR replicate the formatting. The original code did formatting in the route.
        // I'll replicate the formatting to avoid breaking frontend.

        const { nodes, devices, senders, receivers, flows } = resources;
        const flowsMap = new Map(flows.map(f => [f.id, f]));

        const structuredNodes = nodes.map(node => {
            const nodeDevices = devices.filter(d => d.node_id === node.id).map(device => {
                const deviceSenders = senders.filter(s => s.device_id === device.id).map(s => ({
                    ...s,
                    flow: flowsMap.get(s.flow_id)
                }));
                const deviceReceivers = receivers.filter(r => r.device_id === device.id);
                return { ...device, senders: deviceSenders, receivers: deviceReceivers };
            });
            return { ...node, devices: nodeDevices };
        });

        res.json({
            message: 'Discovery successful',
            data: { nodes: structuredNodes }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/resources', (req, res) => {
    res.json(discoveryService.getDiscoveredResources());
});

module.exports = router;
