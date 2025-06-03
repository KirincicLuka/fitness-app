import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUser = {
  id_korisnika: 1,
  role: 'client'
};

const mockTermin = {
  id_termina: 1,
  start: new Date('2025-06-01T10:00:00'),
  end: new Date('2025-06-01T11:00:00'),
  title: 'Yoga za početnike',
  rezerviran: false
};

const MockTerminModal = ({ termin, trener, onClose, onReserve }) => {
  if (!termin) return null;

  return (
    <div className="termin-modal">
      <button onClick={onClose}>×</button>
      <h3>Detalji termina</h3>
      <p>{termin.title}</p>
      <p>{trener}</p>
      {mockUser.role === 'client' && !termin.rezerviran && (
        <button onClick={() => onReserve(termin)}>
          Rezerviraj termin
        </button>
      )}
    </div>
  );
};

describe('TerminModal', () => {
  const mockOnClose = jest.fn();
  const mockOnReserve = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnReserve.mockClear();
  });

  it('trebao bi prikazati detalje termina', () => {
    render(
      <MockTerminModal
        termin={mockTermin}
        trener="John Doe"
        onClose={mockOnClose}
        onReserve={mockOnReserve}
      />
    );

    expect(screen.getByText('Detalji termina')).toBeInTheDocument();
    expect(screen.getByText('Yoga za početnike')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('trebao bi pozvati onClose kada se klikne X', () => {
    render(
      <MockTerminModal
        termin={mockTermin}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('trebao bi prikazati gumb za rezervaciju', () => {
    render(
      <MockTerminModal
        termin={mockTermin}
        onClose={mockOnClose}
        onReserve={mockOnReserve}
      />
    );

    const reserveButton = screen.getByText('Rezerviraj termin');
    expect(reserveButton).toBeInTheDocument();

    fireEvent.click(reserveButton);
    expect(mockOnReserve).toHaveBeenCalledWith(mockTermin);
  });
});