import { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [senders, setSenders] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registryUrl, setRegistryUrl] = useState(''); // Default, user can change

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
      const resources = data.data; 
      
      setSenders(resources.senders || []);
      setReceivers(resources.receivers || []);
      alert(data.message || 'Resources fetched successfully!');
      setError(null); 
    } catch (e) {
      console.error("Failed to fetch IS-04 resources:", e);
      setError(`Failed to load resources: ${e.message}. Ensure backend is running and NMOS_REGISTRY_URL is accessible by the backend.`);
      setSenders([]);
      setReceivers([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (registryUrl) fetchResources(false, registryUrl); 
  }, []); 

  const handleStopConnection = async () => {
    setIsLoading(true);
    setError(null);
    setConnectionStatus('Attempting to stop connection to Registry...');

    try {
      const response = await fetch('/api/nmos/stop-registry', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Stop connection failed with status: ${response.status}`);
      }

      setConnectionStatus(result.message || 'Connection to Registry stopped successfully.');
      setSenders([]);
      setReceivers([]);

    } catch (e) {
      console.error("Failed to stop connection:", e);
      setError(`Stop Connection Error: ${e.message}`);
      setConnectionStatus(''); 
    }
    setIsLoading(false);
  };

  const handleDiscover = () => {
    fetchResources(true, registryUrl); 
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
    } catch (e) {
      console.error("Failed to connect:", e);
      setError(`Connection Error: ${e.message}`);
      setConnectionStatus(''); 
    }
  };

  return (
    <div className="App-container">
      <header className="App-header">
        <h1>Vega-NMOS Control Panel</h1>
        <div className="registry-control">
          <label htmlFor="registryUrl">NMOS Registry URL (Query API v1.x):</label>
          <input 
            type="text" 
            id="registryUrl" 
            value={registryUrl}
            onChange={(e) => setRegistryUrl(e.target.value)}
            placeholder="e.g., http:///0.11.1.14:8010/x-nmos/query/v1.3"
            className="registry-input"
          />
          <button onClick={handleDiscover} disabled={isLoading || !registryUrl}>
            {isLoading ? 'Discovering...' : 'Discover/Refresh Resources'}
          </button>
          <button onClick={handleStopConnection} disabled={isLoading} className="stop-button">停止连接 Registry</button>
        </div>
      </header>
      {error && <p className="message error">{error}</p>}
      {connectionStatus && <p className="message status">{connectionStatus}</p>}
      {isLoading && !error && <p className="message loading">Loading resources...</p>}
      <div className="resource-container">
        <div className="resource-section">
          <h2>发送端 ({senders.length})</h2>
          {senders.length === 0 && !isLoading && <p>未发现发送端</p>}
          <div className="resource-grid">
            {senders.map((sender) => (
              <div key={sender.id} className="resource-card">
                <h3>{sender.label || '未命名发送端'}</h3>
                <div className="resource-details">
                  <p>ID: {sender.id}</p>
                  <p>Flow ID: {sender.flow_id}</p>
                  <p>Transport: {sender.transport}</p>
                </div>
                {receivers.length > 0 && (
                  <div className="connection-control">
                    <select 
                      onChange={(e) => e.target.value && handleConnect(sender.id, e.target.value)} 
                      defaultValue=""
                      className="receiver-select"
                    >
                      <option value="" disabled>选择接收端进行连接...</option>
                      {receivers.map(receiver => (
                        <option key={receiver.id} value={receiver.id}>
                          {receiver.label || `接收端 ${receiver.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="resource-section">
          <h2>接收端 ({receivers.length})</h2>
          {receivers.length === 0 && !isLoading && <p>未发现接收端</p>}
          <div className="resource-grid">
            {receivers.map((receiver) => (
              <div key={receiver.id} className="resource-card">
                <h3>{receiver.label || '未命名接收端'}</h3>
                <div className="resource-details">
                  <p>ID: {receiver.id}</p>
                  <p>Format: {receiver.format}</p>
                  <p>Capabilities: {JSON.stringify(receiver.caps, null, 2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
