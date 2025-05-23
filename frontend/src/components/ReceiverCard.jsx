import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSatelliteDish } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip'; // Assuming react-tooltip is a project dependency

const ReceiverCard = ({ receiver, isActive, highlight }) => {
  if (!receiver) {
    return <div className="resource-card error-card">Receiver data is missing.</div>;
  }

  // Determine icon color based on active state
  const iconColor = isActive ? '#28a745' : '#dc3545'; // Green if active, red if not

  return (
    <div className={`resource-card receiver-card ${isActive ? 'active-route' : ''} ${highlight ? 'highlight' : ''}`}>
      <h3>
        <FontAwesomeIcon icon={faSatelliteDish} style={{ color: iconColor, marginRight: '8px' }} />
        {receiver.label || 'Unnamed Receiver'}
      </h3>
      <div className="resource-details">
        <p data-tooltip-id={`tooltip-receiver-${receiver.id}`}>ID: {receiver.id}</p>
        <Tooltip id={`tooltip-receiver-${receiver.id}`} place="top" content={`Receiver ID: ${receiver.id}`} />
        {receiver.format && <p>Format: {receiver.format}</p>}
        {receiver.caps && Object.keys(receiver.caps).length > 0 && (
          <p>Capabilities: {JSON.stringify(receiver.caps)}</p>
        )}
        {/* Add other relevant receiver details here */}
        {isActive && <p className="active-route-text">Currently Active</p>}
      </div>
    </div>
  );
};

export default ReceiverCard;
