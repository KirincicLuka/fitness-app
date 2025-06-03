import React, { createContext, useState, useContext } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const AuthContext = createContext();

const MockAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (credentials) => {
    setLoading(true);
    setTimeout(() => {
      setUser({ id_korisnika: 1, ime: 'John', email: credentials.email });
      setLoading(false);
    }, 100);
  };

  const logout = async () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

const TestComponent = () => {
  const { user, loading, login, logout } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <div data-testid="user-status">
        {user ? `Logged in: ${user.ime}` : 'Not logged in'}
      </div>
      <button onClick={() => login({ email: 'test@test.com', lozinka: '123' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  it('trebao bi prikazati not logged in na početku', () => {
    render(
      <MockAuthProvider>
        <TestComponent />
      </MockAuthProvider>
    );

    expect(screen.getByText('Not logged in')).toBeInTheDocument();
  });

  it('trebao bi uspješno prijaviti korisnika', async () => {
    render(
      <MockAuthProvider>
        <TestComponent />
      </MockAuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Logged in: John')).toBeInTheDocument();
    });
  });

  it('trebao bi uspješno odjaviti korisnika', async () => {
    render(
      <MockAuthProvider>
        <TestComponent />
      </MockAuthProvider>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Logged in: John')).toBeInTheDocument();
    });

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(screen.getByText('Not logged in')).toBeInTheDocument();
  });
});