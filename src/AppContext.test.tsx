import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import type { Character, Monster } from './types';

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Character Management', () => {
    it('should add a character', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const newCharacter: Omit<Character, 'id'> = {
        name: 'Fighter',
        maxHp: 50,
        currentHp: 50,
        armorClass: 18,
        initiative: 10,
        isPlayer: true,
      };

      act(() => {
        result.current.addCharacter(newCharacter);
      });

      expect(result.current.state.characters).toHaveLength(1);
      expect(result.current.state.characters[0]).toMatchObject(newCharacter);
      expect(result.current.state.characters[0].id).toBeDefined();
    });

    it('should remove a character', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const newCharacter: Omit<Character, 'id'> = {
        name: 'Wizard',
        maxHp: 30,
        currentHp: 30,
        armorClass: 14,
        initiative: 15,
        isPlayer: true,
      };

      act(() => {
        result.current.addCharacter(newCharacter);
      });

      expect(result.current.state.characters).toHaveLength(1);
      const characterId = result.current.state.characters[0].id;

      act(() => {
        result.current.removeCharacter(characterId);
      });

      expect(result.current.state.characters).toHaveLength(0);
    });

    it('should update a character', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const newCharacter: Omit<Character, 'id'> = {
        name: 'Rogue',
        maxHp: 40,
        currentHp: 40,
        armorClass: 16,
        initiative: 18,
        isPlayer: true,
      };

      act(() => {
        result.current.addCharacter(newCharacter);
      });

      const characterId = result.current.state.characters[0].id;

      act(() => {
        result.current.updateCharacter(characterId, { currentHp: 25, initiative: 20 });
      });

      expect(result.current.state.characters[0].currentHp).toBe(25);
      expect(result.current.state.characters[0].initiative).toBe(20);
      expect(result.current.state.characters[0].name).toBe('Rogue');
    });
  });

  describe('Encounter Management', () => {
    it('should create an encounter', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      act(() => {
        result.current.createEncounter('Goblin Ambush', 'A sudden attack by goblins');
      });

      expect(result.current.state.encounters).toHaveLength(1);
      expect(result.current.state.encounters[0].name).toBe('Goblin Ambush');
      expect(result.current.state.encounters[0].description).toBe('A sudden attack by goblins');
      expect(result.current.state.encounters[0].monsters).toEqual([]);
      expect(result.current.state.encounters[0].isActive).toBe(false);
    });

    it('should delete an encounter', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      act(() => {
        result.current.createEncounter('Dragon Fight');
      });

      expect(result.current.state.encounters).toHaveLength(1);
      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.deleteEncounter(encounterId);
      });

      expect(result.current.state.encounters).toHaveLength(0);
    });

    it('should add a monster to an encounter', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const monster: Omit<Monster, 'id'> = {
        name: 'Goblin',
        maxHp: 15,
        currentHp: 15,
        armorClass: 13,
        isPlayer: false,
        challenge_rating: '1/4',
      };

      act(() => {
        result.current.createEncounter('Goblin Patrol');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      expect(result.current.state.encounters[0].monsters).toHaveLength(1);
      expect(result.current.state.encounters[0].monsters[0]).toMatchObject(monster);
      expect(result.current.state.encounters[0].monsters[0].id).toBeDefined();
    });

    it('should update a monster in an encounter', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const monster: Omit<Monster, 'id'> = {
        name: 'Orc',
        maxHp: 25,
        currentHp: 25,
        armorClass: 14,
        isPlayer: false,
      };

      act(() => {
        result.current.createEncounter('Orc Raiders');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      const monsterId = result.current.state.encounters[0].monsters[0].id;

      act(() => {
        result.current.updateMonsterInEncounter(encounterId, monsterId, { currentHp: 10 });
      });

      expect(result.current.state.encounters[0].monsters[0].currentHp).toBe(10);
      expect(result.current.state.encounters[0].monsters[0].name).toBe('Orc');
    });

    it('should remove a monster from an encounter', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const monster: Omit<Monster, 'id'> = {
        name: 'Troll',
        maxHp: 60,
        currentHp: 60,
        armorClass: 15,
        isPlayer: false,
      };

      act(() => {
        result.current.createEncounter('Troll Bridge');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      const monsterId = result.current.state.encounters[0].monsters[0].id;

      expect(result.current.state.encounters[0].monsters).toHaveLength(1);

      act(() => {
        result.current.removeMonsterFromEncounter(encounterId, monsterId);
      });

      expect(result.current.state.encounters[0].monsters).toHaveLength(0);
    });
  });

  describe('Combat Management', () => {
    it('should start an encounter with characters and monsters', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const character: Omit<Character, 'id'> = {
        name: 'Paladin',
        maxHp: 60,
        currentHp: 60,
        armorClass: 19,
        initiative: 12,
        isPlayer: true,
      };

      const monster: Omit<Monster, 'id'> = {
        name: 'Skeleton',
        maxHp: 20,
        currentHp: 20,
        armorClass: 13,
        isPlayer: false,
      };

      act(() => {
        result.current.addCharacter(character);
      });

      const addedCharacter = result.current.state.characters[0];

      act(() => {
        result.current.createEncounter('Undead Attack');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      const monsterId = result.current.state.encounters[0].monsters[0].id;

      act(() => {
        result.current.startEncounter(encounterId, [addedCharacter], {
          [addedCharacter.id]: 15,
          [monsterId]: 10,
        });
      });

      const activeEncounter = result.current.state.encounters[0];
      expect(activeEncounter.isActive).toBe(true);
      expect(activeEncounter.combatants).toHaveLength(2);
      expect(activeEncounter.currentTurn).toBe(0);
      expect(result.current.state.activeEncounterId).toBe(encounterId);

      // Check initiative order (higher initiative first)
      expect(activeEncounter.combatants![0].initiative).toBe(15);
      expect(activeEncounter.combatants![1].initiative).toBe(10);
    });

    it('should update combatant initiative and re-sort', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const character: Omit<Character, 'id'> = {
        name: 'Ranger',
        maxHp: 45,
        currentHp: 45,
        armorClass: 16,
        initiative: 10,
        isPlayer: true,
      };

      const monster: Omit<Monster, 'id'> = {
        name: 'Wolf',
        maxHp: 12,
        currentHp: 12,
        armorClass: 13,
        isPlayer: false,
        initiative: 15,
      };

      act(() => {
        result.current.addCharacter(character);
      });

      const addedCharacter = result.current.state.characters[0];

      act(() => {
        result.current.createEncounter('Forest Encounter');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      act(() => {
        result.current.startEncounter(encounterId, [addedCharacter]);
      });

      const combatantId = result.current.state.encounters[0].combatants![1].id;

      act(() => {
        result.current.setInitiative(combatantId, 20);
      });

      const combatants = result.current.state.encounters[0].combatants!;
      expect(combatants[0].initiative).toBe(20);
      expect(combatants[1].initiative).toBe(15);
    });

    it('should update combatant HP with proper clamping', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const character: Omit<Character, 'id'> = {
        name: 'Cleric',
        maxHp: 40,
        currentHp: 40,
        armorClass: 17,
        initiative: 10,
        isPlayer: true,
      };

      act(() => {
        result.current.addCharacter(character);
      });

      const addedCharacter = result.current.state.characters[0];

      act(() => {
        result.current.createEncounter('Healing Test');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.startEncounter(encounterId, [addedCharacter]);
      });

      const combatantId = result.current.state.encounters[0].combatants![0].id;

      // Test normal damage
      act(() => {
        result.current.updateCombatantHp(combatantId, 25);
      });
      expect(result.current.state.encounters[0].combatants![0].currentHp).toBe(25);

      // Test clamping at 0
      act(() => {
        result.current.updateCombatantHp(combatantId, -10);
      });
      expect(result.current.state.encounters[0].combatants![0].currentHp).toBe(0);

      // Test clamping at maxHp
      act(() => {
        result.current.updateCombatantHp(combatantId, 100);
      });
      expect(result.current.state.encounters[0].combatants![0].currentHp).toBe(40);
    });

    it('should advance to next turn with wraparound', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const character: Omit<Character, 'id'> = {
        name: 'Bard',
        maxHp: 35,
        currentHp: 35,
        armorClass: 15,
        initiative: 14,
        isPlayer: true,
      };

      const monster: Omit<Monster, 'id'> = {
        name: 'Bandit',
        maxHp: 18,
        currentHp: 18,
        armorClass: 12,
        isPlayer: false,
        initiative: 10,
      };

      act(() => {
        result.current.addCharacter(character);
      });

      const addedCharacter = result.current.state.characters[0];

      act(() => {
        result.current.createEncounter('Turn Order Test');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      act(() => {
        result.current.startEncounter(encounterId, [addedCharacter]);
      });

      expect(result.current.state.encounters[0].currentTurn).toBe(0);

      act(() => {
        result.current.nextTurn();
      });

      expect(result.current.state.encounters[0].currentTurn).toBe(1);

      // Test wraparound
      act(() => {
        result.current.nextTurn();
      });

      expect(result.current.state.encounters[0].currentTurn).toBe(0);
    });

    it('should end an encounter and clean up combat state', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const character: Omit<Character, 'id'> = {
        name: 'Druid',
        maxHp: 38,
        currentHp: 38,
        armorClass: 14,
        initiative: 11,
        isPlayer: true,
      };

      const monster: Omit<Monster, 'id'> = {
        name: 'Bear',
        maxHp: 34,
        currentHp: 34,
        armorClass: 11,
        isPlayer: false,
      };

      act(() => {
        result.current.addCharacter(character);
      });

      const addedCharacter = result.current.state.characters[0];

      act(() => {
        result.current.createEncounter('Nature Battle');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      act(() => {
        result.current.startEncounter(encounterId, [addedCharacter]);
      });

      expect(result.current.state.encounters[0].isActive).toBe(true);
      expect(result.current.state.encounters[0].combatants).toBeDefined();

      act(() => {
        result.current.endEncounter();
      });

      expect(result.current.state.encounters[0].isActive).toBe(false);
      expect(result.current.state.encounters[0].combatants).toBeUndefined();
      expect(result.current.state.encounters[0].currentTurn).toBeUndefined();
      expect(result.current.state.activeEncounterId).toBeUndefined();
      // Monsters should still be preserved
      expect(result.current.state.encounters[0].monsters).toHaveLength(1);
    });

    it('should preserve monster actions and abilities when starting encounter', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const monster: Omit<Monster, 'id'> = {
        name: 'Goblin',
        maxHp: 7,
        currentHp: 7,
        armorClass: 15,
        dexterity: 14,
        initiative: 2,
        actions: [
          {
            name: 'Scimitar',
            desc: 'Melee attack',
            attack_bonus: 4,
            damage: [{ damage_dice: '1d6+2', damage_type: { name: 'slashing' } }],
          },
        ],
        special_abilities: [
          {
            name: 'Nimble Escape',
            desc: 'Can disengage as bonus action',
          },
        ],
        isPlayer: false,
      };

      act(() => {
        result.current.createEncounter('Goblin Ambush');
      });

      const encounterId = result.current.state.encounters[0].id;

      act(() => {
        result.current.addMonsterToEncounter(encounterId, monster);
      });

      act(() => {
        result.current.startEncounter(encounterId, []);
      });

      const encounter = result.current.state.encounters[0];
      const goblinCombatant = encounter.combatants?.[0];

      expect(goblinCombatant).toBeDefined();
      expect(goblinCombatant?.dexterity).toBe(14);
      expect(goblinCombatant?.actions).toEqual(monster.actions);
      expect(goblinCombatant?.special_abilities).toEqual(monster.special_abilities);
    });
  });

  describe('Data Import/Export', () => {
    it('should export data as JSON', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      act(() => {
        result.current.addCharacter({
          name: 'Monk',
          maxHp: 42,
          currentHp: 42,
          armorClass: 16,
          initiative: 17,
          isPlayer: true,
        });
        result.current.createEncounter('Export Test');
      });

      const exported = result.current.exportData();
      const parsed = JSON.parse(exported);

      expect(parsed.characters).toHaveLength(1);
      expect(parsed.encounters).toHaveLength(1);
      expect(parsed.characters[0].name).toBe('Monk');
    });

    it('should import data from JSON', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      const importData = {
        characters: [
          {
            id: 'test-char-1',
            name: 'Sorcerer',
            maxHp: 32,
            currentHp: 32,
            armorClass: 13,
            initiative: 14,
            isPlayer: true,
          },
        ],
        encounters: [
          {
            id: 'test-enc-1',
            name: 'Import Test',
            monsters: [],
            isActive: false,
            createdAt: Date.now(),
          },
        ],
      };

      act(() => {
        result.current.importData(JSON.stringify(importData));
      });

      expect(result.current.state.characters).toHaveLength(1);
      expect(result.current.state.characters[0].name).toBe('Sorcerer');
      expect(result.current.state.encounters).toHaveLength(1);
      expect(result.current.state.encounters[0].name).toBe('Import Test');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should save state to localStorage on changes', () => {
      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      act(() => {
        result.current.addCharacter({
          name: 'Barbarian',
          maxHp: 70,
          currentHp: 70,
          armorClass: 14,
          initiative: 8,
          isPlayer: true,
        });
      });

      const stored = localStorage.getItem('dnd-encounter-tracker-data');
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.characters).toHaveLength(1);
      expect(parsed.characters[0].name).toBe('Barbarian');
    });

    it('should load state from localStorage on initialization', () => {
      const initialData = {
        characters: [
          {
            id: 'char-1',
            name: 'Warlock',
            maxHp: 36,
            currentHp: 36,
            armorClass: 12,
            initiative: 13,
            isPlayer: true,
          },
        ],
        encounters: [],
      };

      localStorage.setItem('dnd-encounter-tracker-data', JSON.stringify(initialData));

      const { result } = renderHook(() => useApp(), { wrapper: AppProvider });

      expect(result.current.state.characters).toHaveLength(1);
      expect(result.current.state.characters[0].name).toBe('Warlock');
    });
  });
});
