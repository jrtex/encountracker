export interface Condition {
  index: string;
  name: string;
  desc: string[];
}

export interface Character {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  initiative: number;
  isPlayer: boolean;
}

export interface Monster {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  initiative?: number;
  challenge_rating?: string;
  type?: string;
  size?: string;
  isPlayer: boolean;
  // D&D 5e API fields
  apiIndex?: string;
}

export interface Combatant {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  initiative: number;
  isPlayer: boolean;
  conditions?: Condition[];
}

export interface Encounter {
  id: string;
  name: string;
  description?: string;
  monsters: Monster[];
  combatants?: Combatant[];
  isActive: boolean;
  currentTurn?: number;
  createdAt: number;
}

export interface AppState {
  characters: Character[];
  encounters: Encounter[];
  activeEncounterId?: string;
  availableConditions: Condition[];
}
