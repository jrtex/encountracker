import { useState, FormEvent, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import './Login.css';

export const Login = () => {
  const { login, error: configError } = useAuth();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus password field on mount
  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!password.trim()) {
      setLoginError('Please enter a password');
      return;
    }

    const success = login(password);
    if (!success) {
      setLoginError('Incorrect password');
      setPassword('');
      passwordInputRef.current?.focus();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>D&D Encounter Tracker</h1>
          <p>Enter password to continue</p>
        </div>

        {configError && (
          <div className="config-error">
            <strong>Configuration Error:</strong>
            <p>{configError}</p>
            <p>Please create <code>public/config.json</code> with your password.</p>
          </div>
        )}

        {!configError && (
          <form onSubmit={handleSubmit} className="login-form">
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="login-input"
              disabled={!!configError}
            />

            {loginError && (
              <div className="login-error">{loginError}</div>
            )}

            <button type="submit" className="login-button" disabled={!!configError}>
              Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
