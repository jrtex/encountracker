import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import { CharacterList } from './CharacterList';

describe('CharacterList', () => {
  beforeEach(() => {
    // Mock window.confirm to always return true by default
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('should render empty state message when no characters exist', () => {
    render(<CharacterList />);
    expect(screen.getByText(/no characters yet/i)).toBeInTheDocument();
  });

  it('should show and hide character form when clicking Add Character button', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    const addButton = screen.getByRole('button', { name: /add character/i });
    expect(screen.queryByPlaceholderText(/character name/i)).not.toBeInTheDocument();

    await user.click(addButton);
    expect(screen.getByPlaceholderText(/character name/i)).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(screen.queryByPlaceholderText(/character name/i)).not.toBeInTheDocument();
  });

  it('should add a new character', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Gandalf');
    await user.clear(screen.getByPlaceholderText(/max hp/i));
    await user.type(screen.getByPlaceholderText(/max hp/i), '50');
    await user.clear(screen.getByPlaceholderText(/armor class/i));
    await user.type(screen.getByPlaceholderText(/armor class/i), '15');
    await user.clear(screen.getByPlaceholderText(/initiative/i));
    await user.type(screen.getByPlaceholderText(/initiative/i), '10');

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    expect(screen.getByText('50/50')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('should delete a character', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    // Add a character first
    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Frodo');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Frodo')).toBeInTheDocument();
    });

    // Delete the character
    const deleteButton = screen.getByRole('button', { name: '×' });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('Frodo')).not.toBeInTheDocument();
    });
  });

  it('should edit an existing character', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    // Add a character first
    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Aragorn');
    await user.clear(screen.getByPlaceholderText(/max hp/i));
    await user.type(screen.getByPlaceholderText(/max hp/i), '40');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Aragorn')).toBeInTheDocument();
    });

    // Edit the character
    const editButton = screen.getByRole('button', { name: '✎' });
    await user.click(editButton);

    const nameInput = screen.getByPlaceholderText(/character name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Strider');

    const currentHpInput = screen.getByPlaceholderText(/current hp/i);
    await user.clear(currentHpInput);
    await user.type(currentHpInput, '25');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Strider')).toBeInTheDocument();
      expect(screen.getByText('25/40')).toBeInTheDocument();
    });
  });

  it('should heal a character to full HP', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    // Add a character
    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Legolas');
    await user.clear(screen.getByPlaceholderText(/max hp/i));
    await user.type(screen.getByPlaceholderText(/max hp/i), '30');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Legolas')).toBeInTheDocument();
    });

    // Edit to reduce HP
    const editButton = screen.getByRole('button', { name: '✎' });
    await user.click(editButton);

    const currentHpInput = screen.getByPlaceholderText(/current hp/i);
    await user.clear(currentHpInput);
    await user.type(currentHpInput, '15');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('15/30')).toBeInTheDocument();
    });

    // Heal to full
    const healButton = screen.getByRole('button', { name: /full heal/i });
    await user.click(healButton);

    await waitFor(() => {
      expect(screen.getByText('30/30')).toBeInTheDocument();
    });
  });

  it('should not show Full Heal button for character at max HP', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Gimli');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Gimli')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /full heal/i })).not.toBeInTheDocument();
  });

  it('should automatically set currentHp to maxHp when adding new character', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Boromir');
    await user.clear(screen.getByPlaceholderText(/max hp/i));
    await user.type(screen.getByPlaceholderText(/max hp/i), '45');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('45/45')).toBeInTheDocument();
    });
  });

  it('should clear form data after successful submission', async () => {
    const user = userEvent.setup();
    render(<CharacterList />);

    const addButton = screen.getByRole('button', { name: /add character/i });
    await user.click(addButton);

    await user.type(screen.getByPlaceholderText(/character name/i), 'Samwise');
    await user.clear(screen.getByPlaceholderText(/max hp/i));
    await user.type(screen.getByPlaceholderText(/max hp/i), '25');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/character name/i)).not.toBeInTheDocument();
    });

    // Open form again to verify it's cleared
    await user.click(screen.getByRole('button', { name: /add character/i }));
    expect(screen.getByPlaceholderText(/character name/i)).toHaveValue('');
  });
});
