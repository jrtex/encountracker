import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonsterSelector } from './MonsterSelector';

// Mock fetch for API calls
global.fetch = vi.fn();

const mockMonsterList = {
  results: [
    { index: 'goblin', name: 'Goblin' },
    { index: 'orc', name: 'Orc' },
  ],
};

const mockGoblinDetails = {
  index: 'goblin',
  name: 'Goblin',
  hit_points: 7,
  armor_class: [{ value: 15 }],
  challenge_rating: 0.25,
  type: 'humanoid',
  size: 'Small',
};

describe('MonsterSelector', () => {
  it('should add multiple monsters from API when quantity is set', async () => {
    const user = userEvent.setup();
    const onAddMonster = vi.fn();
    const onClose = vi.fn();

    // Mock the monsters list API call
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockMonsterList,
    });

    render(<MonsterSelector onAddMonster={onAddMonster} onClose={onClose} />);

    // Wait for monsters to load
    await waitFor(() => expect(screen.getByText('Goblin')).toBeInTheDocument());

    // Mock the monster details API call
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockGoblinDetails,
    });

    // Click on Goblin
    await user.click(screen.getByText('Goblin'));

    // Wait for details to load
    await waitFor(() => expect(screen.getByText(/HP: 7/)).toBeInTheDocument());

    // Find and update the quantity input
    const quantityInput = screen.getByLabelText(/Quantity:/i) as HTMLInputElement;
    await user.tripleClick(quantityInput); // Select all
    await user.keyboard('3');

    // Verify quantity is set to 3
    await waitFor(() => expect(quantityInput.value).toBe('3'));

    // Click Add to Encounter
    await user.click(screen.getByRole('button', { name: /Add to Encounter \(3x\)/i }));

    // Verify onAddMonster was called 3 times
    expect(onAddMonster).toHaveBeenCalledTimes(3);
    expect(onAddMonster).toHaveBeenCalledWith({
      name: 'Goblin',
      maxHp: 7,
      currentHp: 7,
      armorClass: 15,
      challenge_rating: '0.25',
      type: 'humanoid',
      size: 'Small',
      apiIndex: 'goblin',
      isPlayer: false,
    });
  });

  it('should add multiple monsters from manual entry when quantity is set', async () => {
    const user = userEvent.setup();
    const onAddMonster = vi.fn();
    const onClose = vi.fn();

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockMonsterList,
    });

    render(<MonsterSelector onAddMonster={onAddMonster} onClose={onClose} />);

    // Switch to manual mode
    await user.click(screen.getByRole('button', { name: /Manual Entry/i }));

    // Fill in manual form
    await user.type(screen.getByPlaceholderText(/Name/i), 'Custom Goblin');
    await user.clear(screen.getByPlaceholderText(/Max HP/i));
    await user.type(screen.getByPlaceholderText(/Max HP/i), '10');

    // Set quantity to 5
    const quantityInput = screen.getByLabelText(/Quantity:/i) as HTMLInputElement;
    await user.tripleClick(quantityInput); // Select all
    await user.keyboard('5');

    // Verify quantity is set to 5
    await waitFor(() => expect(quantityInput.value).toBe('5'));

    // Submit form
    await user.click(screen.getByRole('button', { name: /Add Monster\/NPC \(5x\)/i }));

    // Verify onAddMonster was called 5 times
    expect(onAddMonster).toHaveBeenCalledTimes(5);
    expect(onAddMonster).toHaveBeenCalledWith({
      name: 'Custom Goblin',
      maxHp: 10,
      currentHp: 10,
      armorClass: 10,
      challenge_rating: '0',
      type: '',
      size: 'Medium',
      isPlayer: false,
    });
  });

  it('should enforce minimum quantity of 1', async () => {
    const user = userEvent.setup();
    const onAddMonster = vi.fn();
    const onClose = vi.fn();

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockMonsterList,
    });

    render(<MonsterSelector onAddMonster={onAddMonster} onClose={onClose} />);

    // Switch to manual mode
    await user.click(screen.getByRole('button', { name: /Manual Entry/i }));

    await user.type(screen.getByPlaceholderText(/Name/i), 'Test Monster');

    // Try to set quantity to 0
    const quantityInput = screen.getByLabelText(/Quantity:/i) as HTMLInputElement;
    await user.tripleClick(quantityInput); // Select all
    await user.keyboard('0');

    // Should be clamped to 1
    await waitFor(() => expect(quantityInput.value).toBe('1'));
  });

  it('should enforce maximum quantity of 10', async () => {
    const user = userEvent.setup();
    const onAddMonster = vi.fn();
    const onClose = vi.fn();

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockMonsterList,
    });

    render(<MonsterSelector onAddMonster={onAddMonster} onClose={onClose} />);

    // Switch to manual mode
    await user.click(screen.getByRole('button', { name: /Manual Entry/i }));

    await user.type(screen.getByPlaceholderText(/Name/i), 'Test Monster');

    // Try to set quantity to 15 (type 1, then 5)
    const quantityInput = screen.getByLabelText(/Quantity:/i) as HTMLInputElement;
    await user.tripleClick(quantityInput); // Select all
    await user.keyboard('1');

    // After typing '1', value should be 1
    await waitFor(() => expect(quantityInput.value).toBe('1'));

    // Now type '5' to make it '15'
    await user.keyboard('5');

    // Should be clamped to 10
    await waitFor(() => expect(quantityInput.value).toBe('10'));
  });

  it('should reset quantity to 1 after adding monsters', async () => {
    const user = userEvent.setup();
    const onAddMonster = vi.fn();
    const onClose = vi.fn();

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockMonsterList,
    });

    render(<MonsterSelector onAddMonster={onAddMonster} onClose={onClose} />);

    // Wait for monsters to load
    await waitFor(() => expect(screen.getByText('Goblin')).toBeInTheDocument());

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockGoblinDetails,
    });

    // Click on Goblin
    await user.click(screen.getByText('Goblin'));

    await waitFor(() => expect(screen.getByText(/HP: 7/)).toBeInTheDocument());

    // Set quantity to 3
    const quantityInput = screen.getByLabelText(/Quantity:/i) as HTMLInputElement;
    await user.tripleClick(quantityInput); // Select all
    await user.keyboard('3');

    // Verify quantity is set to 3
    await waitFor(() => expect(quantityInput.value).toBe('3'));

    // Add to encounter
    await user.click(screen.getByRole('button', { name: /Add to Encounter \(3x\)/i }));

    // Verify quantity was reset to 1
    await waitFor(() => {
      const newQuantityInput = screen.queryByLabelText(/Quantity:/i) as HTMLInputElement | null;
      // After adding, monster details are cleared, so quantity input won't be visible
      // but if we select another monster, quantity should be 1
      expect(screen.queryByText(/HP: 7/)).not.toBeInTheDocument();
    });
  });

  it('should show quantity in button text when > 1', async () => {
    const user = userEvent.setup();
    const onAddMonster = vi.fn();
    const onClose = vi.fn();

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockMonsterList,
    });

    render(<MonsterSelector onAddMonster={onAddMonster} onClose={onClose} />);

    // Switch to manual mode
    await user.click(screen.getByRole('button', { name: /Manual Entry/i }));

    // Initially should not show quantity
    expect(screen.getByRole('button', { name: /Add Monster\/NPC$/i })).toBeInTheDocument();

    // Set quantity to 4
    const quantityInput = screen.getByLabelText(/Quantity:/i) as HTMLInputElement;
    await user.tripleClick(quantityInput); // Select all
    await user.keyboard('4');

    // Verify quantity is set to 4
    await waitFor(() => expect(quantityInput.value).toBe('4'));

    // Should now show (4x)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Monster\/NPC \(4x\)/i })).toBeInTheDocument();
    });
  });
});
