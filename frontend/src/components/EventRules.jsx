import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faBolt } from '@fortawesome/free-solid-svg-icons';
import './EventRules.css';

const EventRules = ({ senders, receivers }) => {
    const [rules, setRules] = useState([]);
    const [newRule, setNewRule] = useState({
        name: '',
        trigger: { sourceId: '', eventType: 'boolean', payload: { value: true } },
        action: { type: 'route', params: { senderId: '', receiverId: '' } }
    });

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await fetch('/api/is07/rules');
            const data = await res.json();
            setRules(data);
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        }
    };

    const handleAddRule = async () => {
        try {
            const res = await fetch('/api/is07/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRule)
            });
            if (res.ok) {
                fetchRules();
                setNewRule({
                    name: '',
                    trigger: { sourceId: '', eventType: 'boolean', payload: { value: true } },
                    action: { type: 'route', params: { senderId: '', receiverId: '' } }
                });
            }
        } catch (error) {
            console.error('Failed to add rule:', error);
        }
    };

    const handleDeleteRule = async (id) => {
        try {
            await fetch(`/api/is07/rules/${id}`, { method: 'DELETE' });
            fetchRules();
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    return (
        <div className="event-rules-container">
            <h2><FontAwesomeIcon icon={faBolt} /> Event Rules (IS-07)</h2>

            <div className="add-rule-form">
                <h3>Create New Rule</h3>
                <input
                    type="text"
                    placeholder="Rule Name"
                    value={newRule.name}
                    onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                />

                <div className="rule-section">
                    <h4>Trigger</h4>
                    <select
                        value={newRule.trigger.sourceId}
                        onChange={e => setNewRule({ ...newRule, trigger: { ...newRule.trigger, sourceId: e.target.value } })}
                    >
                        <option value="">Select Event Source (Sender)</option>
                        {senders.map(s => <option key={s.id} value={s.id}>{s.label} ({s.description})</option>)}
                    </select>
                    {/* Simplified payload input for boolean */}
                    <label>
                        Value:
                        <select
                            value={newRule.trigger.payload.value}
                            onChange={e => setNewRule({ ...newRule, trigger: { ...newRule.trigger, payload: { value: e.target.value === 'true' } } })}
                        >
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    </label>
                </div>

                <div className="rule-section">
                    <h4>Action (Route)</h4>
                    <select
                        value={newRule.action.params.senderId}
                        onChange={e => setNewRule({ ...newRule, action: { ...newRule.action, params: { ...newRule.action.params, senderId: e.target.value } } })}
                    >
                        <option value="">Select Source to Route</option>
                        {senders.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <span> to </span>
                    <select
                        value={newRule.action.params.receiverId}
                        onChange={e => setNewRule({ ...newRule, action: { ...newRule.action, params: { ...newRule.action.params, receiverId: e.target.value } } })}
                    >
                        <option value="">Select Destination</option>
                        {receivers.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                </div>

                <button onClick={handleAddRule} className="add-btn"><FontAwesomeIcon icon={faPlus} /> Add Rule</button>
            </div>

            <div className="rules-list">
                {rules.map(rule => (
                    <div key={rule.id} className="rule-card">
                        <div className="rule-header">
                            <strong>{rule.name}</strong>
                            <button onClick={() => handleDeleteRule(rule.id)} className="delete-btn"><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                        <div className="rule-details">
                            <p>IF Source <code>{rule.trigger.sourceId.substring(0, 8)}...</code> sends <code>{JSON.stringify(rule.trigger.payload)}</code></p>
                            <p>THEN Route <code>{rule.action.params.senderId.substring(0, 8)}...</code> to <code>{rule.action.params.receiverId.substring(0, 8)}...</code></p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventRules;
