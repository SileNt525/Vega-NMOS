import React from 'react';
import SenderCard from './SenderCard';
import ReceiverCard from './ReceiverCard';
import { Tooltip } from 'react-tooltip';

const DeviceDisplay = ({ device, allReceivers, handleConnect, activeRoutes, highlight }) => {
  if (!device) {
    return <div className="device-display error-card">Device data is missing.</div>;
  }

  return (
    <div className="device-display">
      <h3 className="device-label" data-tooltip-id={`tooltip-device-${device.id}`}>
        Device: {device.label || 'Unnamed Device'} (ID: {device.id.substring(0,8)}...)
      </h3>
      <Tooltip id={`tooltip-device-${device.id}`} place="top" content={`Device ID: ${device.id}\nNode ID: ${device.node_id}`} />
      
      {(!device.senders || device.senders.length === 0) && (!device.receivers || device.receivers.length === 0) && (
        <p className="empty-state-message">This device has no senders or receivers.</p>
      )}

      {device.senders && device.senders.length > 0 && (
        <div className="senders-section">
          <h4>Senders ({device.senders.length})</h4>
          <div className="resource-grid">
            {device.senders.map(sender => (
              <SenderCard 
                key={sender.id} 
                sender={sender} 
                allReceivers={allReceivers} 
                handleConnect={handleConnect} 
              />
            ))}
          </div>
        </div>
      )}

      {device.receivers && device.receivers.length > 0 && (
        <div className="receivers-section">
          <h4>Receivers ({device.receivers.length})</h4>
          <div className="resource-grid">
            {device.receivers.map(receiver => (
              <ReceiverCard 
                key={receiver.id} 
                receiver={receiver} 
                isActive={activeRoutes && Object.values(activeRoutes).some(route => route.receiverId === receiver.id)}
                highlight={highlight === receiver.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceDisplay;
