const express = require('express');
const router = express.Router();
const nmosRegistryService = require('../services/nmos-registry.service');
const discoveryService = require('../services/discovery.service');

router.post('/stop-registry', (req, res) => {
    nmosRegistryService.stop();
    // Also stop discovery subscriptions
    // discoveryService.stopSubscriptions(); // If I implemented this
    res.json({ message: 'Registry connection stopped' });
});

module.exports = router;
