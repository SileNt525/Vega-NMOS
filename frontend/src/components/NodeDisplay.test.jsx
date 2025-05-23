import React from 'react';
import { render, screen } from '@testing-library/react';
import NodeDisplay from './NodeDisplay';
import { describe, it, expect, vi } from 'vitest';

// Mock child component
vi.mock('./DeviceDisplay', () => ({
  default: (props) => <div data-testid={`device-display-${props.device.id}`}>{props.device.label}</div>
}));
vi.mock('react-tooltip', () => ({
  Tooltip: (props) => <div data-testid={`tooltip-${props.id}`}>{props.content}</div>
}));

describe('NodeDisplay', () => {
  const mockNode = {
    id: 'node-xyz',
    label: 'Test Node',
    api: {
      endpoints: [
        { protocol: 'http', host: 'localhost', port: 8080 }
      ]
    },
    devices: [
      { id: 'device-1', label: 'Device 1' },
      { id: 'device-2', label: 'Device 2' },
    ],
  };
  const mockAllReceivers = [];
  const mockHandleConnect = vi.fn();
  const mockActiveRoutes = {};

  it('renders without crashing with minimal props', () => {
    render(
      <NodeDisplay 
        node={mockNode} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText(`Node: ${mockNode.label} (ID: ${mockNode.id.substring(0,8)}...)`)).toBeInTheDocument();
  });

  it('renders node information correctly', () => {
    render(
      <NodeDisplay 
        node={mockNode} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText(`Node: ${mockNode.label} (ID: ${mockNode.id.substring(0,8)}...)`)).toBeInTheDocument();
    // Check for tooltip content as well
    expect(screen.getByTestId(`tooltip-tooltip-node-${mockNode.id}`)).toHaveTextContent(`Node ID: ${mockNode.id}`);
    expect(screen.getByTestId(`tooltip-tooltip-node-${mockNode.id}`)).toHaveTextContent(`API Endpoints: http://localhost:8080`);

  });

  it('renders the correct number of DeviceDisplay components', () => {
    render(
      <NodeDisplay 
        node={mockNode} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByTestId('device-display-device-1')).toBeInTheDocument();
    expect(screen.getByTestId('device-display-device-2')).toBeInTheDocument();
    expect(screen.getByText('Device 1')).toBeInTheDocument(); // Check for mocked content
    expect(screen.getByText('Device 2')).toBeInTheDocument(); // Check for mocked content
  });

  it('renders "no devices" message if devices array is empty', () => {
    const nodeWithoutDevices = { ...mockNode, devices: [] };
    render(
      <NodeDisplay 
        node={nodeWithoutDevices} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText('This node has no devices.')).toBeInTheDocument();
  });
  
  it('renders error message if node data is missing', () => {
    render(
      <NodeDisplay 
        node={null} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText('Node data is missing.')).toBeInTheDocument();
  });
});
