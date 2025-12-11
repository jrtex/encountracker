import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from './Login';
import { AuthProvider } from '../AuthContext';

// Mock AuthContext to control its behavior
vi.mock('../AuthContext', async () => {
  const actual = await vi.importActual('../AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

import { useAuth } from '../AuthContext';

describe('Login Component', () => {
  it('should render login form with password input and submit button', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<Login />);

    expect(screen.getByRole('heading', { name: /D&D Encounter Tracker/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should call login function when form is submitted', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockReturnValue(true);

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
    });

    render(<Login />);

    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(passwordInput, 'testpassword');
    await user.click(submitButton);

    expect(mockLogin).toHaveBeenCalledWith('testpassword');
  });

  it('should show error message for wrong password', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockReturnValue(false);

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
    });

    render(<Login />);

    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
  });

  it('should clear input after failed login', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockReturnValue(false);

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
    });

    render(<Login />);

    const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    expect(passwordInput.value).toBe('');
  });

  it('should show error message when password is empty', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
    });

    render(<Login />);

    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.click(submitButton);

    expect(screen.getByText(/please enter a password/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('should display config error if config fetch failed', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: 'Configuration file not found. Please create public/config.json',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<Login />);

    expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
    expect(screen.getByText(/configuration file not found/i)).toBeInTheDocument();
  });

  it('should hide form when config error exists', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: 'Configuration file not found',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<Login />);

    // Form should not be rendered when there's a config error
    expect(screen.queryByPlaceholderText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
  });

  it('should auto-focus password field on mount', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<Login />);

    const passwordInput = screen.getByPlaceholderText(/password/i);

    expect(passwordInput).toHaveFocus();
  });

  it('should not show config error when there is no error', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<Login />);

    expect(screen.queryByText(/configuration error/i)).not.toBeInTheDocument();
  });
});
