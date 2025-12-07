import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Character, Encounter, Monster, Combatant, Condition } from './types';

interface AppContextType {
  state: AppState;
  addCharacter: (character: Omit<Character, 'id'>) => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  createEncounter: (name: string, description?: string) => void;
  addMonsterToEncounter: (encounterId: string, monster: Omit<Monster, 'id'>) => void;
  updateMonsterInEncounter: (encounterId: string, monsterId: string, updates: Partial<Monster>) => void;
  removeMonsterFromEncounter: (encounterId: string, monsterId: string) => void;
  startEncounter: (encounterId: string, characters: Character[], initiativeRolls?: Record<string, number>) => void;
  setInitiative: (combatantId: string, initiative: number) => void;
  updateCombatantHp: (combatantId: string, newHp: number) => void;
  nextTurn: () => void;
  endEncounter: () => void;
  deleteEncounter: (encounterId: string) => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
  addConditionToCombatant: (combatantId: string, condition: Condition) => void;
  removeConditionFromCombatant: (combatantId: string, conditionIndex: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'dnd-encounter-tracker-data';

const loadFromStorage = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...parsed, availableConditions: parsed.availableConditions || [] };
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  return { characters: [], encounters: [], availableConditions: [] };
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(loadFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [state]);

  // Fetch conditions from D&D 5e API on mount
  useEffect(() => {
    if (state.availableConditions.length > 0) return; // Already loaded

    fetch('https://www.dnd5eapi.co/api/conditions')
      .then(res => res.json())
      .then(data => {
        // Fetch detailed info for each condition
        Promise.all(
          data.results.map((c: { url: string }) =>
            fetch(`https://www.dnd5eapi.co${c.url}`).then(r => r.json())
          )
        ).then(conditions => {
          setState(prev => ({ ...prev, availableConditions: conditions }));
        });
      })
      .catch(err => console.error('Failed to load conditions:', err));
  }, []);

  const addCharacter = (character: Omit<Character, 'id'>) => {
    const newCharacter: Character = {
      ...character,
      id: crypto.randomUUID(),
    };
    setState(prev => ({
      ...prev,
      characters: [...prev.characters, newCharacter],
    }));
  };

  const removeCharacter = (id: string) => {
    setState(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c.id !== id),
    }));
  };

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setState(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  };

  const createEncounter = (name: string, description?: string) => {
    const newEncounter: Encounter = {
      id: crypto.randomUUID(),
      name,
      description,
      monsters: [],
      isActive: false,
      createdAt: Date.now(),
    };
    setState(prev => ({
      ...prev,
      encounters: [...prev.encounters, newEncounter],
    }));
  };

  const addMonsterToEncounter = (encounterId: string, monster: Omit<Monster, 'id'>) => {
    const newMonster: Monster = {
      ...monster,
      id: crypto.randomUUID(),
    };
    setState(prev => ({
      ...prev,
      encounters: prev.encounters.map(enc =>
        enc.id === encounterId
          ? { ...enc, monsters: [...enc.monsters, newMonster] }
          : enc
      ),
    }));
  };

  const updateMonsterInEncounter = (encounterId: string, monsterId: string, updates: Partial<Monster>) => {
    setState(prev => ({
      ...prev,
      encounters: prev.encounters.map(enc =>
        enc.id === encounterId
          ? { ...enc, monsters: enc.monsters.map(m => m.id === monsterId ? { ...m, ...updates } : m) }
          : enc
      ),
    }));
  };

  const removeMonsterFromEncounter = (encounterId: string, monsterId: string) => {
    setState(prev => ({
      ...prev,
      encounters: prev.encounters.map(enc =>
        enc.id === encounterId
          ? { ...enc, monsters: enc.monsters.filter(m => m.id !== monsterId) }
          : enc
      ),
    }));
  };

  const startEncounter = (encounterId: string, characters: Character[], initiativeRolls?: Record<string, number>) => {
    setState(prev => {
      const encounter = prev.encounters.find(e => e.id === encounterId);
      if (!encounter) return prev;

      const combatants: Combatant[] = [
        ...characters.map(c => {
          const modifier = c.initiative ?? 0;
          const roll = initiativeRolls?.[c.id] ?? 10;
          const total = roll + modifier;

          return {
            ...c,
            initiative: modifier,
            initiativeRoll: roll,
            initiativeTotal: total,
            conditions: [],
          };
        }),
        ...encounter.monsters.map(m => {
          const modifier = m.initiative ?? 0;
          const roll = initiativeRolls?.[m.id] ?? 10;
          const total = roll + modifier;

          return {
            ...m,
            initiative: modifier,
            initiativeRoll: roll,
            initiativeTotal: total,
            isPlayer: false,
            conditions: [],
            dexterity: m.dexterity,
            actions: m.actions,
            special_abilities: m.special_abilities,
          };
        }),
      ].sort((a, b) => b.initiativeTotal - a.initiativeTotal);

      return {
        ...prev,
        encounters: prev.encounters.map(enc =>
          enc.id === encounterId
            ? { ...enc, isActive: true, combatants, currentTurn: 0 }
            : { ...enc, isActive: false }
        ),
        activeEncounterId: encounterId,
      };
    });
  };

  const setInitiative = (combatantId: string, newRoll: number) => {
    setState(prev => {
      if (!prev.activeEncounterId) return prev;

      return {
        ...prev,
        encounters: prev.encounters.map(enc => {
          if (enc.id !== prev.activeEncounterId || !enc.combatants) return enc;

          const updatedCombatants = enc.combatants
            .map(c => {
              if (c.id === combatantId) {
                const modifier = c.initiative;
                const total = newRoll + modifier;
                return { ...c, initiativeRoll: newRoll, initiativeTotal: total };
              }
              return c;
            })
            .sort((a, b) => b.initiativeTotal - a.initiativeTotal);

          return { ...enc, combatants: updatedCombatants };
        }),
      };
    });
  };

  const updateCombatantHp = (combatantId: string, newHp: number) => {
    setState(prev => {
      if (!prev.activeEncounterId) return prev;

      return {
        ...prev,
        encounters: prev.encounters.map(enc => {
          if (enc.id !== prev.activeEncounterId || !enc.combatants) return enc;

          return {
            ...enc,
            combatants: enc.combatants.map(c =>
              c.id === combatantId ? { ...c, currentHp: Math.max(0, Math.min(newHp, c.maxHp)) } : c
            ),
          };
        }),
      };
    });
  };

  const nextTurn = () => {
    setState(prev => {
      if (!prev.activeEncounterId) return prev;

      return {
        ...prev,
        encounters: prev.encounters.map(enc => {
          if (enc.id !== prev.activeEncounterId || !enc.combatants) return enc;

          const nextTurnIndex = ((enc.currentTurn || 0) + 1) % enc.combatants.length;
          return { ...enc, currentTurn: nextTurnIndex };
        }),
      };
    });
  };

  const endEncounter = () => {
    setState(prev => ({
      ...prev,
      encounters: prev.encounters.map(enc =>
        enc.id === prev.activeEncounterId
          ? { ...enc, isActive: false, combatants: undefined, currentTurn: undefined }
          : enc
      ),
      activeEncounterId: undefined,
    }));
  };

  const deleteEncounter = (encounterId: string) => {
    setState(prev => ({
      ...prev,
      encounters: prev.encounters.filter(e => e.id !== encounterId),
      activeEncounterId: prev.activeEncounterId === encounterId ? undefined : prev.activeEncounterId,
    }));
  };

  const exportData = () => {
    return JSON.stringify(state, null, 2);
  };

  const importData = (jsonData: string) => {
    try {
      const importedState = JSON.parse(jsonData) as AppState;
      setState(importedState);
    } catch (error) {
      console.error('Failed to import data:', error);
    }
  };

  const addConditionToCombatant = (combatantId: string, condition: Condition) => {
    setState(prev => {
      if (!prev.activeEncounterId) return prev;

      return {
        ...prev,
        encounters: prev.encounters.map(enc => {
          if (enc.id !== prev.activeEncounterId || !enc.combatants) return enc;

          return {
            ...enc,
            combatants: enc.combatants.map(c => {
              if (c.id !== combatantId) return c;
              // Check if condition already exists
              const hasCondition = c.conditions?.some(cond => cond.index === condition.index);
              if (hasCondition) return c; // Don't add duplicate
              return { ...c, conditions: [...(c.conditions || []), condition] };
            }),
          };
        }),
      };
    });
  };

  const removeConditionFromCombatant = (combatantId: string, conditionIndex: string) => {
    setState(prev => {
      if (!prev.activeEncounterId) return prev;

      return {
        ...prev,
        encounters: prev.encounters.map(enc => {
          if (enc.id !== prev.activeEncounterId || !enc.combatants) return enc;

          return {
            ...enc,
            combatants: enc.combatants.map(c =>
              c.id === combatantId
                ? { ...c, conditions: c.conditions?.filter(cond => cond.index !== conditionIndex) }
                : c
            ),
          };
        }),
      };
    });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        addCharacter,
        removeCharacter,
        updateCharacter,
        createEncounter,
        addMonsterToEncounter,
        updateMonsterInEncounter,
        removeMonsterFromEncounter,
        startEncounter,
        setInitiative,
        updateCombatantHp,
        nextTurn,
        endEncounter,
        deleteEncounter,
        exportData,
        importData,
        addConditionToCombatant,
        removeConditionFromCombatant,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
