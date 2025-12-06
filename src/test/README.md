# Testing Setup

This directory contains test utilities and setup files for the D&D Encounter Tracker application.

## Files

### `setup.ts`
Global test setup file that runs before all tests. Configures:
- **localStorage mock**: Simulates browser localStorage for testing
- **crypto.randomUUID mock**: Provides predictable UUIDs for testing
- **Cleanup**: Automatically cleans up after each test

### `test-utils.tsx`
Custom test utilities that extend React Testing Library:
- **`render()`**: Automatically wraps components with `AppProvider` context
- Re-exports all React Testing Library utilities for convenience

## Usage

### Testing Components

```typescript
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

test('renders correctly', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  const button = screen.getByRole('button', { name: /submit/i });
  await user.click(button);

  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

### Testing Context/Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from '../AppContext';

test('updates state correctly', () => {
  const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

  act(() => {
    result.current.addCharacter({ name: 'Test', ... });
  });

  expect(result.current.state.characters).toHaveLength(1);
});
```

## Best Practices

1. **Always use `act()`** when calling state-changing functions
2. **Access state after `act()` completes**, not inside the act callback
3. **Use `await user.event()`** for user interactions
4. **Use semantic queries** like `getByRole()`, `getByLabelText()` over `getByTestId()`
5. **Test user behavior**, not implementation details

## Available Matchers

From `@testing-library/jest-dom`:
- `toBeInTheDocument()`
- `toHaveValue()`
- `toBeVisible()`
- `toBeDisabled()`
- `toHaveTextContent()`
- And many more...
