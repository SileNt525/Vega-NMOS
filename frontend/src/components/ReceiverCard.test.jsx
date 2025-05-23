import React from 'react';
import { render, screen } from '@testing-library/react';
import ReceiverCard from './ReceiverCard';
import { describe, it, expect } from 'vitest';

// Mock FontAwesomeIcon and Tooltip as they are external dependencies not relevant to component logic
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: (props) => <i className={`fa ${props.icon.iconName}`} />
}));
vi.mock('react-tooltip', () => ({
  Tooltip: (props) => <div data-testid={`tooltip-${props.id}`}>{props.content}</div>
}));

describe('ReceiverCard', () => {
  const mockReceiver = {
    id: 'receiver-123',
    label: 'Test Receiver',
    format: 'video/H264',
    caps: { media_types: ['video/raw'] },
  };

  it('renders without crashing with minimal props', () => {
    render(<ReceiverCard receiver={mockReceiver} />);
    expect(screen.getByText('Test Receiver')).toBeInTheDocument();
  });

  it('renders receiver information correctly', () => {
    render(<ReceiverCard receiver={mockReceiver} />);
    expect(screen.getByText('Test Receiver')).toBeInTheDocument();
    expect(screen.getByText(`ID: ${mockReceiver.id}`)).toBeInTheDocument();
    expect(screen.getByText(`Format: ${mockReceiver.format}`)).toBeInTheDocument();
    expect(screen.getByText(`Capabilities: ${JSON.stringify(mockReceiver.caps)}`)).toBeInTheDocument();
  });

  it('displays active state when isActive is true', () => {
    render(<ReceiverCard receiver={mockReceiver} isActive={true} />);
    expect(screen.getByText('Currently Active')).toBeInTheDocument();
    // Check for 'active-route' class if your CSS uses it for styling active state
    const cardElement = screen.getByText('Test Receiver').closest('.receiver-card');
    expect(cardElement).toHaveClass('active-route');
  });

  it('does not display active state when isActive is false or undefined', () => {
    render(<ReceiverCard receiver={mockReceiver} />);
    expect(screen.queryByText('Currently Active')).not.toBeInTheDocument();
    const cardElement = screen.getByText('Test Receiver').closest('.receiver-card');
    expect(cardElement).not.toHaveClass('active-route');
  });
  
  it('applies highlight class when highlight is true', () => {
    render(<ReceiverCard receiver={mockReceiver} highlight={true} />);
    const cardElement = screen.getByText('Test Receiver').closest('.receiver-card');
    expect(cardElement).toHaveClass('highlight');
  });

  it('renders error message if receiver data is missing', () => {
    render(<ReceiverCard receiver={null} />);
    expect(screen.getByText('Receiver data is missing.')).toBeInTheDocument();
  });
});
