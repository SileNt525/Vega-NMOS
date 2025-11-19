const express = require('express');
const router = express.Router();
const channelMappingService = require('../services/channel-mapping.service');

router.get('/map/:deviceId/:type/:ioId', async (req, res) => {
    const { deviceId, type, ioId } = req.params;
    const isInput = type === 'inputs';
    try {
        const mapping = await channelMappingService.getMapping(deviceId, ioId, isInput);
        res.json(mapping);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/map/:deviceId/:type/:ioId', async (req, res) => {
    const { deviceId, type, ioId } = req.params;
    const { mapEntries } = req.body;
    const isInput = type === 'inputs';
    try {
        const result = await channelMappingService.setMapping(deviceId, ioId, mapEntries, isInput);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
