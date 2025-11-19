const express = require('express');
const router = express.Router();
const connectionService = require('../services/connection.service');

router.post('/connect', async (req, res) => {
    const { senderId, receiverId } = req.body;
    try {
        const result = await connectionService.connect(senderId, receiverId);
        res.json({ message: 'Connected', receiverResponse: result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/disconnect', async (req, res) => {
    const { receiverId } = req.body;
    try {
        const result = await connectionService.disconnect(receiverId);
        res.json({ message: 'Disconnected', receiverResponse: result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/connections', (req, res) => {
    res.json({ connections: connectionService.getActiveConnections() });
});

module.exports = router;
