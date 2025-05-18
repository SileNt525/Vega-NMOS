import { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [senders, setSenders] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResources = useCallback(async (isRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = isRefresh ? '/api/is04/refresh' : '/api/is04/resources';
      const method = isRefresh ? 'POST' : 'GET';
      const response = await fetch(apiUrl, { method });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const resources = isRefresh ? data.data : data; // Refresh endpoint wraps data
      
      setSenders(resources.senders || []);
      setReceivers(resources.receivers || []);
      if (isRefresh) {
        alert('Resources refreshed successfully!');
      }
    } catch (e) {
      console.error("Failed to fetch IS-04 resources:", e);
      setError(`Failed to load resources: ${e.message}. Ensure backend is running and NMOS_REGISTRY_URL is accessible by the backend.`);
      setSenders([]);
      setReceivers([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const [connectionStatus, setConnectionStatus] = useState('');

  const handleConnect = async (senderId, receiverId) => {
    if (!senderId || !receiverId) {
      alert('Please select both a sender and a receiver.');
      return;
    }
    setConnectionStatus(`Attempting to connect Sender ${senderId} to Receiver ${receiverId}...`);
    setError(null);

    try {
      const response = await fetch('/api/is05/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senderId, receiverId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Connection failed with status: ${response.status}`);
      }

      setConnectionStatus(`Successfully connected Sender ${senderId} to Receiver ${receiverId}. Receiver response: ${JSON.stringify(result.receiverResponse, null, 2)}`);
      // Optionally, refresh IS-04 resources to see if the receiver's state has changed (e.g., subscription active)
      // fetchResources(); 
    } catch (e) {
      console.error("Failed to connect:", e);
      setError(`Connection Error: ${e.message}`);
      setConnectionStatus(''); // Clear status on error
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Vega-NMOS Control Panel</h1>
        <button onClick={() => fetchResources(true)} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh IS-04 Resources'}
        </button>
      </header>
      {error && <p className="error-message">{error}</p>}
      {connectionStatus && <p className="status-message">{connectionStatus}</p>}
      {isLoading && !error && <p>Loading resources...</p>}
      <div className="container">
        <div className="resource-list">
          <h2>Senders ({senders.length})</h2>
          {senders.length === 0 && !isLoading && <p>No senders found.</p>}
          <ul>
            {senders.map((sender) => (
              <li key={sender.id}>
                <strong>{sender.label}</strong> (ID: {sender.id})<br />
                Flow ID: {sender.flow_id}<br />
                Transport: {sender.transport}
                {/* Basic connect button - will be improved */}
                {receivers.length > 0 && (
                  <select onChange={(e) => e.target.value && handleConnect(sender.id, e.target.value)} defaultValue="">
                    <option value="" disabled>Connect to Receiver...</option>
                    {receivers.map(receiver => (
                      <option key={receiver.id} value={receiver.id}>{receiver.label}</option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="resource-list">
          <h2>Receivers ({receivers.length})</h2>
          {receivers.length === 0 && !isLoading && <p>No receivers found.</p>}
          <ul>
            {receivers.map((receiver) => (
              <li key={receiver.id}>
                <strong>{receiver.label}</strong> (ID: {receiver.id})<br />
                Format: {receiver.format} <br />
                Caps: {JSON.stringify(receiver.caps)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
