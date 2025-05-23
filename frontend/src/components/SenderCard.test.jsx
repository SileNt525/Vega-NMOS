import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SenderCard from './SenderCard';
import { describe, it, expect, vi } from 'vitest';

// Mock FontAwesomeIcon and Tooltip
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: (props) => <i className={`fa ${props.icon.iconName}`} />
}));
vi.mock('react-tooltip', () => ({
  Tooltip: (props) => <div data-testid={`tooltip-${props.id}`}>{props.content}</div>
}));

describe('SenderCard', () => {
  const mockSender = {
    id: 'sender-456',
    label: 'Test Sender',
    flow_id: 'flow-789',
    transport: 'urn:nmos:transport:rtp.mcast',
    flow: {
      format: 'video/jxsv',
      media_type: 'video',
    },
  };

  const mockReceivers = [
    { id: 'receiver-1', label: 'Receiver 1' },
    { id: 'receiver-2', label: 'Receiver 2' },
  ];

  const mockHandleConnect = vi.fn();

  it('renders without crashing with minimal props', () => {
    render(<SenderCard sender={mockSender} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    expect(screen.getByText('Test Sender')).toBeInTheDocument();
  });

  it('renders sender information correctly', () => {
    render(<SenderCard sender={mockSender} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    expect(screen.getByText('Test Sender')).toBeInTheDocument();
    expect(screen.getByText(`ID: ${mockSender.id}`)).toBeInTheDocument();
    expect(screen.getByText(`Flow ID: ${mockSender.flow_id}`)).toBeInTheDocument();
    expect(screen.getByText(`Transport: ${mockSender.transport}`)).toBeInTheDocument();
  });

  it('renders embedded flow details if flow is present', () => {
    render(<SenderCard sender={mockSender} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    expect(screen.getByText('Flow Details:')).toBeInTheDocument();
    expect(screen.getByText(`Format: ${mockSender.flow.format}`)).toBeInTheDocument();
  });

  it('does not render flow details if flow is not present', () => {
    const senderWithoutFlow = { ...mockSender, flow: null };
    render(<SenderCard sender={senderWithoutFlow} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    expect(screen.queryByText('Flow Details:')).not.toBeInTheDocument();
  });

  it('renders connection dropdown if receivers are present', () => {
    render(<SenderCard sender={mockSender} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    const selectInput = screen.getByRole('combobox');
    expect(selectInput).toBeInTheDocument();
    expect(screen.getByText('Connect to Receiver...')).toBeInTheDocument(); // Default option
    expect(screen.getByText('Receiver 1')).toBeInTheDocument();
    expect(screen.getByText('Receiver 2')).toBeInTheDocument();
  });

  it('does not render connection dropdown if no receivers are present', () => {
    render(<SenderCard sender={mockSender} allReceivers={[]} handleConnect={mockHandleConnect} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('calls handleConnect when a receiver is selected from dropdown', () => {
    render(<SenderCard sender={mockSender} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    const selectInput = screen.getByRole('combobox');
    fireEvent.change(selectInput, { target: { value: 'receiver-1' } });
    expect(mockHandleConnect).toHaveBeenCalledWith(mockSender.id, 'receiver-1');
  });

  it('renders error message if sender data is missing', () => {
    render(<SenderCard sender={null} allReceivers={mockReceivers} handleConnect={mockHandleConnect} />);
    expect(screen.getByText('Sender data is missing.')).toBeInTheDocument();
  });
});
