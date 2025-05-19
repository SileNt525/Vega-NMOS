import React, { useState, useEffect } from 'react';
import NmosSubscription from './components/NmosSubscription';
import './App.css';

// Assuming your Vite proxy is set up correctly:
// /x-nmos -> http://localhost:3000 (NMOS Registry)
// /proxy  -> http://localhost:3001 (Your backend proxy)
// No need for full REGISTRY_URL here if using relative paths via Vite proxy
const REGISTRY_QUERY_BASE = '/x-nmos/query/v1.3'; // Proxied to NMOS Registry

function App() {
  const [senders, setSenders] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState({
    receiver_id: null,
    sender_id: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch senders
        const sendersRes = await fetch(`${REGISTRY_QUERY_BASE}/senders`);
        if (!sendersRes.ok) {
          throw new Error(`Failed to fetch senders: ${sendersRes.status}`);
        }
        const sendersData = await sendersRes.json();
        console.log('Fetched Senders:', sendersData);
        setSenders(sendersData);
        if (sendersData.length > 0 && !activeSubscription.sender_id) {
          // setActiveSubscription(prev => ({ ...prev, sender_id: sendersData[0].id }));
        }

        // Fetch receivers (raw data)
        const receiversRes = await fetch(`${REGISTRY_QUERY_BASE}/receivers`);
        if (!receiversRes.ok) {
          throw new Error(`Failed to fetch receivers: ${receiversRes.status}`);
        }
        const rawReceiversData = await receiversRes.json();
        console.log('Fetched Raw Receivers:', rawReceiversData);

        // Enrich receivers with their Connection API URL
        const enrichedReceivers = await Promise.all(
          rawReceiversData.map(async (receiver) => {
            try {
              // 1. Get Device info from Registry (via Vite proxy to Registry)
              const deviceRes = await fetch(`${REGISTRY_QUERY_BASE}/devices/${receiver.device_id}`);
              if (!deviceRes.ok) {
                console.warn(`Failed to fetch device ${receiver.device_id}: ${deviceRes.status}`);
                return { ...receiver, connectionApiUrl: null, error: `Failed to fetch device (status ${deviceRes.status})` };
              }
              // Query API may return an array even when querying by ID.
              const devicesData = await deviceRes.json();
              const device = Array.isArray(devicesData) ? devicesData[0] : devicesData;

              if (!device || !device.node_id) {
                console.warn(`Node ID not found for device ${receiver.device_id}. Device data:`, device);
                return { ...receiver, connectionApiUrl: null, error: 'Node ID not found for device' };
              }

              // 2. Get Node info from Registry (via Vite proxy to Registry)
              // This gives us the node's own API href.
              const nodeQueryRes = await fetch(`${REGISTRY_QUERY_BASE}/nodes/${device.node_id}`);
              if (!nodeQueryRes.ok) {
                console.warn(`Failed to fetch node query info for ${device.node_id}: ${nodeQueryRes.status}`);
                return { ...receiver, connectionApiUrl: null, error: `Failed to fetch node query info (status ${nodeQueryRes.status})` };
              }
              const nodesQueryData = await nodeQueryRes.json();
              const nodeQueryInfo = Array.isArray(nodesQueryData) ? nodesQueryData[0] : nodesQueryData;

              if (!nodeQueryInfo || !nodeQueryInfo.href) {
                console.warn(`Node href not found for node ID ${device.node_id} from registry query. NodeQueryInfo:`, nodeQueryInfo);
                return { ...receiver, connectionApiUrl: null, error: `Node href not found for node ID ${device.node_id}` };
              }

              // 3. Fetch Node's 'self' resource from its *actual* Node API.
              //    This request MUST go through our backend proxy.
              //    nodeQueryInfo.href is the base URL of the Node API on the actual node.
              //    e.g., "http://actual.node.ip:port/x-nmos/node/v1.3/"
              const actualNodeSelfUrl = `${nodeQueryInfo.href.replace(/\/$/, '')}/self`;
              const proxyNodeSelfRequestUrl = `/proxy?url=${encodeURIComponent(actualNodeSelfUrl)}`;
              
              console.log(`Fetching node self for ${receiver.id} via proxy: ${proxyNodeSelfRequestUrl}`);
              const nodeSelfRes = await fetch(proxyNodeSelfRequestUrl);
              
              if (!nodeSelfRes.ok) {
                const errorBody = await nodeSelfRes.text();
                console.warn(`Failed to fetch node self for ${device.node_id} (Node: ${nodeQueryInfo.label}) via proxy. Target URL: ${actualNodeSelfUrl}. Status: ${nodeSelfRes.status}. Response: ${errorBody}`);
                return { ...receiver, connectionApiUrl: null, error: `Failed to fetch node self (status ${nodeSelfRes.status})` };
              }
              const nodeSelf = await nodeSelfRes.json();

              // 4. Find the Connection service
              const connService = nodeSelf.services.find(s => s.type === "urn:x-nmos:service:connection");
              if (!connService || !connService.href) {
                console.warn(`Connection service not found on node ${device.node_id} (Node: ${nodeQueryInfo.label}). Node self services:`, nodeSelf.services);
                return { ...receiver, connectionApiUrl: null, error: 'Connection service not found on node' };
              }
              
              console.log(`Found connection API for receiver ${receiver.id} (${receiver.label}): ${connService.href}`);
              return { ...receiver, connectionApiUrl: connService.href, nodeLabel: nodeQueryInfo.label };

            } catch (err) {
              console.error(`Error enriching receiver ${receiver.id} (${receiver.label}): ${err.message}`, err);
              return { ...receiver, connectionApiUrl: null, error: err.message };
            }
          })
        );
        
        const successfullyEnrichedReceivers = enrichedReceivers.filter(r => r.connectionApiUrl);
        if(successfullyEnrichedReceivers.length < enrichedReceivers.length){
            console.warn("Some receivers could not be enriched with a connection API URL:", 
                enrichedReceivers.filter(r => !r.connectionApiUrl).map(r => ({id: r.id, label: r.label, error: r.error}))
            );
        }
        setReceivers(successfullyEnrichedReceivers);

        if (successfullyEnrichedReceivers.length > 0 && !activeSubscription.receiver_id) {
          // setActiveSubscription(prev => ({ ...prev, receiver_id: successfullyEnrichedReceivers[0].id }));
        }

      } catch (e) {
        console.error("Error fetching initial NMOS data:", e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Removed activeSubscription from dependencies to prevent re-fetch on selection

  const handleSenderSelect = (senderId) => {
    setActiveSubscription(prev => ({ ...prev, sender_id: senderId }));
  };

  const handleReceiverSelect = (receiverId) => {
    setActiveSubscription(prev => ({ ...prev, receiver_id: receiverId }));
  };

  if (isLoading) {
    return <div className="container mx-auto p-4"><p>Loading NMOS resources...</p></div>;
  }

  if (error) {
    return <div className="container mx-auto p-4"><p className="text-red-500">Error loading data: {error}</p></div>;
  }

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-center text-blue-600">NMOS Controller</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Senders List */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3 text-gray-700">Senders</h2>
          {senders.length === 0 && <p>No senders found.</p>}
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {senders.map(sender => (
              <li key={sender.id}
                  className={`p-3 rounded-md cursor-pointer transition-all ease-in-out duration-150 ${activeSubscription.sender_id === sender.id ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-100 hover:bg-blue-100'}`}
                  onClick={() => handleSenderSelect(sender.id)}>
                <p className="font-medium">{sender.label}</p>
                <p className="text-xs text-gray-500 group-hover:text-gray-700">{sender.id}</p>
                <p className="text-sm text-gray-600 group-hover:text-gray-800">{sender.description}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Receivers List */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3 text-gray-700">Receivers</h2>
          {receivers.length === 0 && <p>No receivers available or failed to get connection details.</p>}
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {receivers.map(receiver => (
              <li key={receiver.id}
                  className={`p-3 rounded-md cursor-pointer transition-all ease-in-out duration-150 ${activeSubscription.receiver_id === receiver.id ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 hover:bg-green-100'}`}
                  onClick={() => handleReceiverSelect(receiver.id)}>
                <p className="font-medium">{receiver.label}</p>
                <p className="text-xs text-gray-500 group-hover:text-gray-700">{receiver.id}</p>
                <p className="text-sm text-gray-600 group-hover:text-gray-800">Node: {receiver.nodeLabel || 'N/A'}</p>
                {!receiver.connectionApiUrl && <p className="text-xs text-red-400">Connection API not found: {receiver.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Connection Control */}
      <NmosSubscription
        activeSubscription={activeSubscription}
        receivers={receivers} // Pass enriched receivers
        senders={senders}
        // REGISTRY_URL is not directly needed by NmosSubscription if App handles discovery
      />
    </div>
  );
}

export default App;
