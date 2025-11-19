const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const discoveryService = require('./discovery.service');
const connectionService = require('./connection.service');

class EventService {
    constructor() {
        this.rules = []; // [{ id, name, trigger: { sourceId, eventType, payload }, action: { type, params } }]
        this.eventWebSockets = {}; // { sourceId: WebSocket }
    }

    getRules() {
        return this.rules;
    }

    addRule(rule) {
        const newRule = { ...rule, id: uuidv4() };
        this.rules.push(newRule);
        console.log(`Rule added: ${newRule.name}`);
        return newRule;
    }

    deleteRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
    }

    // Called when a new IS-07 Sender is discovered (or manually by user for now)
    async subscribeToEventSource(sourceId) {
        const resources = discoveryService.getDiscoveredResources();
        const sender = resources.senders.find(s => s.id === sourceId);

        if (!sender) {
            console.warn(`Sender ${sourceId} not found for IS-07 subscription`);
            return;
        }

        // Extract WebSocket URL from transport_params or manifest
        // Simplified: assuming a 'connection_uri' or similar in transport_params for this demo
        // In reality, you'd parse the transport file or check specific IS-07 params
        // For this "Review" fix, I'll add a placeholder implementation.
        console.log(`Subscribing to IS-07 source ${sourceId}`);

        // Mocking the connection for now as we don't have real devices
        // In a real impl, this would be:
        // const wsUrl = sender.transport_params[0].connection_uri;
        // const ws = new WebSocket(wsUrl);
        // ...
    }

    handleEvent(sourceId, event) {
        console.log(`Received event from ${sourceId}:`, event);

        this.rules.forEach(async rule => {
            if (rule.trigger.sourceId === sourceId) {
                // Check conditions
                if (this.checkCondition(rule.trigger, event)) {
                    console.log(`Rule matched: ${rule.name}`);
                    await this.executeAction(rule.action);
                }
            }
        });
    }

    checkCondition(trigger, event) {
        // Simple equality check for now
        // event structure: { type, payload: { value: ... } }
        if (trigger.eventType && trigger.eventType !== event.type) return false;
        if (trigger.payload && JSON.stringify(trigger.payload) !== JSON.stringify(event.payload)) return false;
        return true;
    }

    async executeAction(action) {
        try {
            if (action.type === 'route') {
                await connectionService.connect(action.params.senderId, action.params.receiverId);
                console.log('Rule action executed: Route established');
            }
            // Add other actions (e.g. feedback) here
        } catch (error) {
            console.error('Rule action failed:', error.message);
        }
    }
}

module.exports = new EventService();
