import React from 'react';
import DeviceDisplay from './DeviceDisplay';
import { Tooltip } from 'react-tooltip';

const NodeDisplay = ({ node, allReceivers, handleConnect, activeRoutes, highlight }) => {
  if (!node) {
    return <div className="node-display error-card">Node data is missing.</div>;
  }

  return (
    <div className="node-display">
      <h2 className="node-label" data-tooltip-id={`tooltip-node-${node.id}`}>
        Node: {node.label || 'Unnamed Node'} (ID: {node.id.substring(0,8)}...)
      </h2>
      <Tooltip id={`tooltip-node-${node.id}`} place="top" content={`Node ID: ${node.id}\nAPI Endpoints: ${node.api?.endpoints.map(ep => `${ep.protocol}://${ep.host}:${ep.port}`).join(', ')}`} />

      {(!node.devices || node.devices.length === 0) && (
        <p className="empty-state-message">This node has no devices.</p>
      )}

      {node.devices && node.devices.map(device => (
        <DeviceDisplay 
          key={device.id} 
          device={device} 
          allReceivers={allReceivers} 
          handleConnect={handleConnect}
          activeRoutes={activeRoutes}
          highlight={highlight}
        />
      ))}
    </div>
  );
};

export default NodeDisplay;
