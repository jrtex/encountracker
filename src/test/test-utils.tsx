import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AppProvider } from '../AppContext';

/**
 * Custom render function that wraps components with AppProvider
 */
export function renderWithContext(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AppProvider, ...options });
}

/**
 * Re-export everything from React Testing Library
 */
export * from '@testing-library/react';
export { renderWithContext as render };
