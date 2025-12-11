import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all mocks
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it('should initialize with isAuthenticated: false and isLoading: true', () => {
    // Mock successful config fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ password: 'testpass' }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('should fetch config.json on mount', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ password: 'testpass' }),
    });
    global.fetch = mockFetch;

    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/config.json');
    });
  });

  it('should handle config fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Configuration file not found. Please create public/config.json');
    });
  });

  it('should handle missing password field in config', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Password not configured in config.json');
    });
  });

  it('should restore auth state from localStorage', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ password: 'testpass' }),
    });

    // Set token in localStorage before rendering
    localStorage.setItem('dnd-tracker-auth-token', 'true');

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should validate password correctly on login with correct password', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ password: 'testpass' }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Wait for config to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Try to login with correct password
    let loginResult: boolean = false;
    act(() => {
      loginResult = result.current.login('testpass');
    });

    expect(loginResult).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('dnd-tracker-auth-token')).toBe('true');
  });

  it('should return false on login with wrong password', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ password: 'testpass' }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Wait for config to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Try to login with wrong password
    const loginResult = result.current.login('wrongpass');

    expect(loginResult).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('dnd-tracker-auth-token')).toBeNull();
  });

  it('should clear auth on logout', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ password: 'testpass' }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Wait for config to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Login first
    act(() => {
      result.current.login('testpass');
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Now logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('dnd-tracker-auth-token')).toBeNull();
  });

  it('should handle network errors when fetching config', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');

    consoleSpy.mockRestore();
  });
});
