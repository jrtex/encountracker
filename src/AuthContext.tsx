import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthConfig {
  password: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'dnd-tracker-auth-token';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configPassword, setConfigPassword] = useState<string>('');

  // Fetch config.json on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/config.json');
        if (!response.ok) {
          throw new Error('Configuration file not found. Please create public/config.json');
        }
        const config: AuthConfig = await response.json();
        if (!config.password) {
          throw new Error('Password not configured in config.json');
        }
        setConfigPassword(config.password);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Check for existing auth token on mount
  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (password: string): boolean => {
    if (password === configPassword) {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, 'true');
        setIsAuthenticated(true);
        return true;
      } catch (err) {
        console.error('Failed to save authentication:', err);
        setError('Failed to save login state');
        return false;
      }
    }
    return false;
  };

  const logout = () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Failed to clear authentication:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
