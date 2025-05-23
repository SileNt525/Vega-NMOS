import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroadcastTower } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip'; // Assuming react-tooltip is a project dependency

const SenderCard = ({ sender, allReceivers, handleConnect }) => {
  if (!sender) {
    return <div className="resource-card error-card">Sender data is missing.</div>;
  }

  return (
    <div className="resource-card sender-card">
      <h3>
        <FontAwesomeIcon icon={faBroadcastTower} style={{ color: '#28a745', marginRight: '8px' }} />
        {sender.label || 'Unnamed Sender'}
      </h3>
      <div className="resource-details">
        <p data-tooltip-id={`tooltip-sender-${sender.id}`}>ID: {sender.id}</p>
        <Tooltip id={`tooltip-sender-${sender.id}`} place="top" content={`Sender ID: ${sender.id}`} />
        {sender.flow_id && <p>Flow ID: {sender.flow_id}</p>}
        {sender.transport && <p>Transport: {sender.transport}</p>}
        {/* Display embedded flow details if available */}
        {sender.flow && (
          <div className="embedded-flow-details">
            <h4>Flow Details:</h4>
            <p>Format: {sender.flow.format}</p>
            {/* Add other relevant flow details here */}
          </div>
        )}
      </div>
      {allReceivers && allReceivers.length > 0 && (
        <div className="connection-control">
          <select
            onChange={(e) => e.target.value && handleConnect(sender.id, e.target.value)}
            defaultValue=""
            className="receiver-select"
          >
            <option value="" disabled>Connect to Receiver...</option>
            {allReceivers.map(receiver => (
              <option key={receiver.id} value={receiver.id}>
                {receiver.label || `Receiver ${receiver.id.substring(0,8)}...`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default SenderCard;
