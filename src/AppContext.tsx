import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Character, Encounter, Monster, Combatant } from './types';

interface AppContextType {
  state: AppState;
  addCharacter: (character: Omit<Character, 'id'>) => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  createEncounter: (name: string, description?: string) => void;
  addMonsterToEncounter: (encounterId: string, monster: Omit<Monster, 'id'>) => void;
  removeMonsterFromEncounter: (encounterId: string, monsterId: string) => void;
  startEncounter: (encounterId: string, characters: Character[], initiatives?: Record<string, number>) => void;
  setInitiative: (combatantId: string, initiative: number) => void;
  updateCombatantHp: (combatantId: string, newHp: number) => void;
  nextTurn: () => void;
  endEncounter: () => void;
  deleteEncounter: (encounterId: string) => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'dnd-encounter-tracker-data';

const loadFromStorage = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  return { characters: [], encounters: [] };
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

  const startEncounter = (encounterId: string, characters: Character[], initiatives?: Record<string, number>) => {
    setState(prev => {
      const encounter = prev.encounters.find(e => e.id === encounterId);
      if (!encounter) return prev;

      const combatants: Combatant[] = [
        ...characters.map(c => ({
          ...c,
          initiative: initiatives?.[c.id] ?? c.initiative ?? 0,
          conditions: [],
        })),
        ...encounter.monsters.map(m => ({
          ...m,
          initiative: initiatives?.[m.id] ?? m.initiative ?? 0,
          isPlayer: false,
          conditions: [],
        })),
      ].sort((a, b) => b.initiative - a.initiative);

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

  const setInitiative = (combatantId: string, initiative: number) => {
    setState(prev => {
      if (!prev.activeEncounterId) return prev;

      return {
        ...prev,
        encounters: prev.encounters.map(enc => {
          if (enc.id !== prev.activeEncounterId || !enc.combatants) return enc;

          const updatedCombatants = enc.combatants
            .map(c => c.id === combatantId ? { ...c, initiative } : c)
            .sort((a, b) => b.initiative - a.initiative);

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

  return (
    <AppContext.Provider
      value={{
        state,
        addCharacter,
        removeCharacter,
        updateCharacter,
        createEncounter,
        addMonsterToEncounter,
        removeMonsterFromEncounter,
        startEncounter,
        setInitiative,
        updateCombatantHp,
        nextTurn,
        endEncounter,
        deleteEncounter,
        exportData,
        importData,
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
