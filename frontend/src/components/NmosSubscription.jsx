import React, { useState, useEffect } from 'react';

// Basic UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function NmosSubscription({ activeSubscription, receivers, senders }) {
  const [connectionStatus, setConnectionStatus] = useState('Idle');
  const [isLoading, setIsLoading] = useState(false);

  // Effect to clear status when selection changes
  useEffect(() => {
    setConnectionStatus('Idle');
  }, [activeSubscription]);

  const handleConnect = async () => {
    if (!activeSubscription || !activeSubscription.receiver_id || !activeSubscription.sender_id) {
      setConnectionStatus('Error: Receiver or Sender not selected.');
      console.error('Missing receiver_id or sender_id in activeSubscription:', activeSubscription);
      return;
    }

    setIsLoading(true);
    setConnectionStatus('Preparing connection...');

    const selectedReceiver = receivers.find(r => r.id === activeSubscription.receiver_id);
    const selectedSender = senders.find(s => s.id === activeSubscription.sender_id);

    if (!selectedReceiver) {
      setConnectionStatus('Error: Selected receiver not found in the provided list.');
      console.error('Selected receiver ID not found in receivers list:', activeSubscription.receiver_id, receivers);
      setIsLoading(false);
      return;
    }

    if (!selectedSender) {
      setConnectionStatus('Error: Selected sender not found in the provided list.');
      console.error('Selected sender ID not found in senders list:', activeSubscription.sender_id, senders);
      setIsLoading(false);
      return;
    }
    
    if (!selectedReceiver.connectionApiUrl) {
        setConnectionStatus(`Error: Connection API URL for receiver ${selectedReceiver.label} is missing.`);
        console.error('Receiver is missing connectionApiUrl:', selectedReceiver);
        setIsLoading(false);
        return;
    }

    // Validate IDs
    if (!UUID_REGEX.test(activeSubscription.receiver_id)) {
        setConnectionStatus(`Error: Invalid Receiver ID format: ${activeSubscription.receiver_id}`);
        console.error('Invalid Receiver ID format:', activeSubscription.receiver_id);
        setIsLoading(false);
        return;
    }
    if (!UUID_REGEX.test(activeSubscription.sender_id)) {
        setConnectionStatus(`Error: Invalid Sender ID format: ${activeSubscription.sender_id}`);
        console.error('Invalid Sender ID format:', activeSubscription.sender_id);
        setIsLoading(false);
        return;
    }

    // Construct the target Connection API endpoint for the receiver's staged control
    // IS-05: /x-nmos/connection/v1.1/single/receivers/{receiverId}/staged
    const baseConnectionUrl = selectedReceiver.connectionApiUrl.endsWith('/') 
                              ? selectedReceiver.connectionApiUrl 
                              : `${selectedReceiver.connectionApiUrl}/`;
    const targetApiEndpoint = `${baseConnectionUrl}single/receivers/${activeSubscription.receiver_id}/staged`;

    // IS-05 payload for PATCH to /staged
    const payload = {
      activation: {
        mode: "activate_immediate",
        requested_time: null, 
      },
      transport_params: [ 
        {
          sender_id: activeSubscription.sender_id,
          // Other transport parameters (e.g., specific interface IP, multicast group) can be added here if needed.
          // For many RTP senders, providing sender_id is sufficient as the receiver
          // will then use IS-04 to get the sender's manifest (SDP) for connection details.
        }
      ]
    };

    console.log('Attempting to connect via proxy...');
    console.log('Target NMOS API Endpoint:', targetApiEndpoint);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Use the backend proxy (path configured in vite.config.js)
    const proxyRequestUrl = `/proxy?url=${encodeURIComponent(targetApiEndpoint)}`;
    console.log('Proxy Request URL:', proxyRequestUrl);

    try {
      setConnectionStatus('Connecting...');
      const response = await fetch(proxyRequestUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let responseData = null;
      const responseText = await response.text(); // Get text first to avoid parsing error if not JSON
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.warn("Response was not valid JSON:", responseText);
        // If not JSON, responseData remains null or could be set to the text itself for display
      }

      if (response.ok) { // Status 200-299
        // IS-05 PATCH to /staged typically returns 200 OK with the (now) staged configuration,
        // or 202 Accepted if activation is scheduled and not immediate.
        setConnectionStatus(`Connection command sent: ${response.status} ${response.statusText}`);
        console.log('Connection command successful. Response Status:', response.status, 'Response Data:', responseData || responseText);
        // TODO: Optionally, you could then GET the /active endpoint to verify the connection.
        // Example: GET `${baseConnectionUrl}single/receivers/${activeSubscription.receiver_id}/active`
      } else {
        const errorMsg = responseData && responseData.error && responseData.error.message 
                         ? responseData.error.message 
                         : (responseData ? JSON.stringify(responseData) : (responseText || response.statusText));
        setConnectionStatus(`Connection failed: ${response.status} - ${errorMsg}`);
        console.error('Connection failed. Status:', response.status, 'Response Data:', responseData || responseText);
      }
    } catch (error) {
      // This catches network errors, or if the proxy itself fails, or if fetch URL was truly malformed client-side
      // (though the URL construction logic should prevent the "string did not match" for fetch itself now)
      setConnectionStatus(`Connection Error: ${error.message}`);
      console.error('Connection fetch/network error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSenderInfo = senders.find(s => s.id === activeSubscription.sender_id);
  const selectedReceiverInfo = receivers.find(r => r.id === activeSubscription.receiver_id);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">Connection Control</h2>
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <p><strong>Selected Sender:</strong> {selectedSenderInfo ? `${selectedSenderInfo.label} (${selectedSenderInfo.id})` : 'None'}</p>
        <p><strong>Selected Receiver:</strong> {selectedReceiverInfo ? `${selectedReceiverInfo.label} (${selectedReceiverInfo.id})` : 'None'}</p>
      </div>
      
      <button
        onClick={handleConnect}
        disabled={!activeSubscription.sender_id || !activeSubscription.receiver_id || isLoading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md disabled:bg-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
      >
        {isLoading ? 'Processing...' : 'Connect Sender to Receiver'}
      </button>
      <p className={`mt-4 text-sm ${connectionStatus.startsWith('Error:') || connectionStatus.startsWith('Connection failed:') ? 'text-red-600' : 'text-gray-600'}`}>
        Status: {connectionStatus}
      </p>
    </div>
  );
}

export default NmosSubscription;
