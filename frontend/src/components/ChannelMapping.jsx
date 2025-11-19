import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSlidersH, faSave } from '@fortawesome/free-solid-svg-icons';
import './ChannelMapping.css';

const ChannelMapping = ({ nodes }) => {
    const [selectedDevice, setSelectedDevice] = useState('');
    const [ioId, setIoId] = useState('');
    const [ioType, setIoType] = useState('inputs'); // inputs or outputs
    const [mapping, setMapping] = useState(null);
    const [loading, setLoading] = useState(false);

    // Flatten devices for selection
    const devices = nodes.flatMap(n => n.devices || []);

    const fetchMapping = async () => {
        if (!selectedDevice || !ioId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/is08/map/${selectedDevice}/${ioType}/${ioId}`);
            const data = await res.json();
            setMapping(data);
        } catch (error) {
            console.error('Failed to fetch mapping:', error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!mapping) return;
        try {
            await fetch(`/api/is08/map/${selectedDevice}/${ioType}/${ioId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapEntries: mapping.map })
            });
            alert('Mapping saved!');
        } catch (error) {
            console.error('Failed to save mapping:', error);
            alert('Failed to save mapping.');
        }
    };

    const updateEntry = (index, field, value) => {
        const newMap = [...mapping.map];
        newMap[index] = { ...newMap[index], [field]: value };
        setMapping({ ...mapping, map: newMap });
    };

    return (
        <div className="channel-mapping-container">
            <h2><FontAwesomeIcon icon={faSlidersH} /> Audio Channel Mapping (IS-08)</h2>

            <div className="selection-bar">
                <select onChange={e => setSelectedDevice(e.target.value)} value={selectedDevice}>
                    <option value="">Select Device</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>

                <input
                    type="text"
                    placeholder="IO UUID (Input/Output ID)"
                    value={ioId}
                    onChange={e => setIoId(e.target.value)}
                />

                <select onChange={e => setIoType(e.target.value)} value={ioType}>
                    <option value="inputs">Input</option>
                    <option value="outputs">Output</option>
                </select>

                <button onClick={fetchMapping} disabled={!selectedDevice || !ioId}>Load Mapping</button>
            </div>

            {loading && <p>Loading...</p>}

            {mapping && mapping.map && (
                <div className="mapping-matrix">
                    <div className="matrix-header">
                        <span>Output Channel</span>
                        <span>Input Channel Source</span>
                        <span>Gain (dB)</span>
                        <span>Mute</span>
                    </div>
                    {mapping.map.map((entry, idx) => (
                        <div key={idx} className="matrix-row">
                            <span>Channel {entry.output_channel_index}</span>
                            <input
                                type="number"
                                value={entry.input_channel_index}
                                onChange={e => updateEntry(idx, 'input_channel_index', parseInt(e.target.value))}
                            />
                            {/* Assuming gain/mute might be in the entry based on IS-08, though basic map is index-to-index */}
                            {/* IS-08 Map Entry: { input_channel_index, output_channel_index } */}
                            {/* Some implementations add gain/mute here or in a separate block. Sticking to basic index mapping for now. */}
                        </div>
                    ))}
                    <button onClick={handleSave} className="save-btn"><FontAwesomeIcon icon={faSave} /> Save Changes</button>
                </div>
            )}
        </div>
    );
};

export default ChannelMapping;
