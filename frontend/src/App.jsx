import { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [senders, setSenders] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registryUrl, setRegistryUrl] = useState('http://10.11.1.14:8010/x-nmos/query/v1.3'); // Default, user can change

  const fetchResources = useCallback(async (isRefresh = false, customUrl = null) => {
    setIsLoading(true);
    setError(null);
    const urlToUse = customUrl || registryUrl;
    if (!urlToUse || (!urlToUse.startsWith('http://') && !urlToUse.startsWith('https://'))) {
      setError('Invalid Registry URL. It must start with http:// or https://');
      setIsLoading(false);
      setSenders([]);
      setReceivers([]);
      return;
    }

    try {
      // Always use the new discover endpoint when a URL is explicitly provided or for refresh
      // The GET /api/is04/resources can be used for initial load if we don't want to POST immediately
      const apiUrl = '/api/is04/discover'; 
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registryUrl: urlToUse }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const resources = data.data; // New discover endpoint always wraps in data
      
      setSenders(resources.senders || []);
      setReceivers(resources.receivers || []);
      alert(data.message || 'Resources fetched successfully!');
      setError(null); // Clear previous errors on success
    } catch (e) {
      console.error("Failed to fetch IS-04 resources:", e);
      setError(`Failed to load resources: ${e.message}. Ensure backend is running and NMOS_REGISTRY_URL is accessible by the backend.`);
      setSenders([]);
      setReceivers([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Fetch resources on initial load with the default or previously set registryUrl
    // We could make this conditional or based on a button click if preferred
    if (registryUrl) fetchResources(false, registryUrl); 
  }, []); // Run once on mount, or when registryUrl is first set if we want to auto-fetch

  const handleDiscover = () => {
    fetchResources(true, registryUrl); // Pass true for isRefresh to indicate a user action, and the current URL
  };

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
        <div className="registry-input-container">
          <label htmlFor="registryUrl">NMOS Registry URL (Query API v1.x):</label>
          <input 
            type="text" 
            id="registryUrl" 
            value={registryUrl}
            onChange={(e) => setRegistryUrl(e.target.value)}
            placeholder="e.g., http://localhost:8870/x-nmos/query/v1.3"
          />
          <button onClick={handleDiscover} disabled={isLoading || !registryUrl}>
            {isLoading ? 'Discovering...' : 'Discover/Refresh Resources'}
          </button>
        </div>
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
