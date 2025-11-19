const express = require('express');
const router = express.Router();
const eventService = require('../services/event.service');

router.get('/rules', (req, res) => {
    res.json(eventService.getRules());
});

router.post('/rules', (req, res) => {
    try {
        const rule = eventService.addRule(req.body);
        res.json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/rules/:id', (req, res) => {
    eventService.deleteRule(req.params.id);
    res.json({ message: 'Rule deleted' });
});

// Test endpoint to simulate an event (since we don't have real devices)
router.post('/simulate-event', (req, res) => {
    const { sourceId, event } = req.body;
    eventService.handleEvent(sourceId, event);
    res.json({ message: 'Event simulated' });
});

module.exports = router;
