import React from 'react';
import { render, screen } from '@testing-library/react';
import DeviceDisplay from './DeviceDisplay';
import { describe, it, expect, vi } from 'vitest';

// Mock child components
vi.mock('./SenderCard', () => ({
  default: (props) => <div data-testid={`sender-card-${props.sender.id}`}>{props.sender.label}</div>
}));
vi.mock('./ReceiverCard', () => ({
  default: (props) => <div data-testid={`receiver-card-${props.receiver.id}`}>{props.receiver.label}</div>
}));
vi.mock('react-tooltip', () => ({
  Tooltip: (props) => <div data-testid={`tooltip-${props.id}`}>{props.content}</div>
}));

describe('DeviceDisplay', () => {
  const mockDevice = {
    id: 'device-abc',
    label: 'Test Device',
    node_id: 'node-xyz',
    senders: [
      { id: 'sender-1', label: 'Sender 1' },
      { id: 'sender-2', label: 'Sender 2' },
    ],
    receivers: [
      { id: 'receiver-1', label: 'Receiver 1' },
    ],
  };

  const mockAllReceivers = [{ id: 'receiver-1', label: 'Receiver 1' }];
  const mockHandleConnect = vi.fn();
  const mockActiveRoutes = {};

  it('renders without crashing with minimal props', () => {
    render(
      <DeviceDisplay 
        device={mockDevice} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText(`Device: ${mockDevice.label} (ID: ${mockDevice.id.substring(0,8)}...)`)).toBeInTheDocument();
  });

  it('renders device information correctly', () => {
    render(
      <DeviceDisplay 
        device={mockDevice} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect}
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText(`Device: ${mockDevice.label} (ID: ${mockDevice.id.substring(0,8)}...)`)).toBeInTheDocument();
    // Check for tooltip content as well
    expect(screen.getByTestId(`tooltip-tooltip-device-${mockDevice.id}`)).toHaveTextContent(`Device ID: ${mockDevice.id}`);
    expect(screen.getByTestId(`tooltip-tooltip-device-${mockDevice.id}`)).toHaveTextContent(`Node ID: ${mockDevice.node_id}`);
  });

  it('renders the correct number of SenderCard components', () => {
    render(
      <DeviceDisplay 
        device={mockDevice} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText('Senders (2)')).toBeInTheDocument();
    expect(screen.getByTestId('sender-card-sender-1')).toBeInTheDocument();
    expect(screen.getByTestId('sender-card-sender-2')).toBeInTheDocument();
  });

  it('renders the correct number of ReceiverCard components', () => {
    render(
      <DeviceDisplay 
        device={mockDevice} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText('Receivers (1)')).toBeInTheDocument();
    expect(screen.getByTestId('receiver-card-receiver-1')).toBeInTheDocument();
  });
  
  it('renders "no senders or receivers" message if both are empty', () => {
    const deviceWithoutSendersOrReceivers = { ...mockDevice, senders: [], receivers: [] };
    render(
      <DeviceDisplay 
        device={deviceWithoutSendersOrReceivers} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText('This device has no senders or receivers.')).toBeInTheDocument();
  });

  it('renders "no senders" message if only senders are empty', () => {
    const deviceWithoutSenders = { ...mockDevice, senders: [] };
    render(
      <DeviceDisplay 
        device={deviceWithoutSenders} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.queryByText('Senders (0)')).not.toBeInTheDocument(); // Section header might not render
    expect(screen.getByText('Receivers (1)')).toBeInTheDocument();
  });


  it('renders error message if device data is missing', () => {
    render(
      <DeviceDisplay 
        device={null} 
        allReceivers={mockAllReceivers} 
        handleConnect={mockHandleConnect} 
        activeRoutes={mockActiveRoutes} 
      />
    );
    expect(screen.getByText('Device data is missing.')).toBeInTheDocument();
  });
});
