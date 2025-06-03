import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const MockLoginForm = ({ onLogin, onRegister }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    lozinka: '',
    ime: '',
    prezime: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(formData);
    } else {
      onRegister(formData);
    }
  };

  return (
    <div>
      <h2>{isLogin ? 'Prijava' : 'Registracija'}</h2>
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <input
              type="text"
              placeholder="Ime"
              value={formData.ime}
              onChange={(e) => setFormData({...formData, ime: e.target.value})}
            />
            <input
              type="text"
              placeholder="Prezime"
              value={formData.prezime}
              onChange={(e) => setFormData({...formData, prezime: e.target.value})}
            />
          </>
        )}
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
        <input
          type="password"
          placeholder="Lozinka"
          value={formData.lozinka}
          onChange={(e) => setFormData({...formData, lozinka: e.target.value})}
        />
        <button type="submit">
          {isLogin ? 'Prijavi se' : 'Registriraj se'}
        </button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Idi na registraciju' : 'Idi na prijavu'}
      </button>
    </div>
  );
};

const MockAuthFlow = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (credentials) => {
    setLoading(true);
    setError(null);
    
    try {
      if (credentials.email === 'test@test.com' && credentials.lozinka === 'password') {
        setTimeout(() => {
          setUser({ ime: 'John', email: credentials.email });
          setLoading(false);
        }, 500);
      } else {
        setTimeout(() => {
          setError('Neispravni podaci');
          setLoading(false);
        }, 500);
      }
    } catch (err) {
      setError('Greška pri prijavi');
      setLoading(false);
    }
  };

  const handleRegister = async (userData) => {
    setLoading(true);
    setError(null);
    
    try {
      if (userData.email && userData.lozinka && userData.ime) {
        setTimeout(() => {
          setUser({ ime: userData.ime, email: userData.email });
          setLoading(false);
        }, 500);
      } else {
        setTimeout(() => {
          setError('Nedostaju podaci');
          setLoading(false);
        }, 500);
      }
    } catch (err) {
      setError('Greška pri registraciji');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setError(null);
  };

  if (loading) return <div>Loading...</div>;

  if (user) {
    return (
      <div>
        <h2>Dobrodošli, {user.ime}!</h2>
        <p>Email: {user.email}</p>
        <button onClick={handleLogout}>Odjava</button>
      </div>
    );
  }

  return (
    <div>
      {error && <div data-testid="error">{error}</div>}
      <MockLoginForm onLogin={handleLogin} onRegister={handleRegister} />
    </div>
  );
};

describe('Auth Flow Integration', () => {
  it('trebao bi uspješno prijaviti korisnika s ispravnim podacima', async () => {
    render(<MockAuthFlow />);

    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Lozinka');
    const loginButton = screen.getByText('Prijavi se');

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    fireEvent.click(loginButton);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dobrodošli, John!')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('trebao bi prikazati grešku za neispravne podatke', async () => {
    render(<MockAuthFlow />);

    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Lozinka');
    const loginButton = screen.getByText('Prijavi se');

    fireEvent.change(emailInput, { target: { value: 'wrong@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Neispravni podaci');
    }, { timeout: 1000 });
  });

  it('trebao bi omogućiti registraciju novog korisnika', async () => {
    render(<MockAuthFlow />);

    const switchButton = screen.getByText('Idi na registraciju');
    fireEvent.click(switchButton);

    expect(screen.getByText('Registracija')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('Ime');
    const surnameInput = screen.getByPlaceholderText('Prezime');
    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Lozinka');

    fireEvent.change(nameInput, { target: { value: 'Jane' } });
    fireEvent.change(surnameInput, { target: { value: 'Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpassword' } });

    const registerButton = screen.getByText('Registriraj se');
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Dobrodošli, Jane!')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});