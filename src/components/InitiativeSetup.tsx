import { useState } from 'react';
import type { Character, Monster } from '../types';

interface InitiativeSetupProps {
  characters: Character[];
  monsters: Monster[];
  onStart: (initiativeRolls: Record<string, number>) => void;
  onCancel: () => void;
  encounterName: string;
}

export const InitiativeSetup = ({
  characters,
  monsters,
  onStart,
  onCancel,
  encounterName,
}: InitiativeSetupProps) => {
  // Toggle between "roll" mode (enter d20 roll) and "total" mode (enter final total)
  const [pcInputMode, setPcInputMode] = useState<'roll' | 'total'>('total');

  // Store initiative rolls (d20 results), not total initiative
  const [initiativeRolls, setInitiativeRolls] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    characters.forEach(c => {
      initial[c.id] = 10; // Default d20 roll
    });
    monsters.forEach(m => {
      initial[m.id] = 10; // Default d20 roll
    });
    return initial;
  });

  const handleInitiativeRollChange = (id: string, value: string, isPC: boolean, modifier: number) => {
    const numValue = parseInt(value) || 0;

    if (isPC && pcInputMode === 'total') {
      // Player entered a total, back-calculate the roll
      const roll = numValue - modifier;
      setInitiativeRolls(prev => ({ ...prev, [id]: roll }));
    } else {
      // Direct roll entry (for NPCs or when in roll mode)
      setInitiativeRolls(prev => ({ ...prev, [id]: numValue }));
    }
  };

  const handleStart = () => {
    onStart(initiativeRolls);
  };

  const allParticipants = [
    ...characters.map(c => ({ ...c, type: 'PC' as const })),
    ...monsters.map(m => ({ ...m, type: 'NPC' as const })),
  ];

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content initiative-setup-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Set Initiative for {encounterName}</h2>
          <button onClick={onCancel} className="close-btn">×</button>
        </div>

        <div className="initiative-mode-toggle">
          <label>PC Input Mode:</label>
          <div className="toggle-buttons">
            <button
              className={pcInputMode === 'total' ? 'active' : ''}
              onClick={() => setPcInputMode('total')}
            >
              Total (Players rolled)
            </button>
            <button
              className={pcInputMode === 'roll' ? 'active' : ''}
              onClick={() => setPcInputMode('roll')}
            >
              Roll (DM rolls)
            </button>
          </div>
        </div>

        <div className="initiative-setup-list">
          {allParticipants.map(participant => {
            const modifier = participant.initiative || 0;
            const roll = initiativeRolls[participant.id] ?? 10;
            const total = roll + modifier;
            const isPC = participant.type === 'PC';
            const showAsTotal = isPC && pcInputMode === 'total';

            return (
              <div key={participant.id} className="initiative-setup-row">
                <div className="participant-info">
                  <span className="participant-name">{participant.name}</span>
                  <span className={`participant-type ${participant.type.toLowerCase()}`}>
                    {participant.type}
                  </span>
                </div>
                <div className="initiative-input-group">
                  {showAsTotal ? (
                    <>
                      <label htmlFor={`init-${participant.id}`}>Total:</label>
                      <input
                        id={`init-${participant.id}`}
                        type="number"
                        value={total}
                        onChange={e => handleInitiativeRollChange(participant.id, e.target.value, isPC, modifier)}
                        className="initiative-number-input"
                        autoFocus={participant === allParticipants[0]}
                      />
                      <span className="initiative-breakdown">
                        (modifier: {modifier >= 0 ? '+' : ''}{modifier})
                      </span>
                    </>
                  ) : (
                    <>
                      <label htmlFor={`init-${participant.id}`}>Roll (d20):</label>
                      <input
                        id={`init-${participant.id}`}
                        type="number"
                        value={roll}
                        onChange={e => handleInitiativeRollChange(participant.id, e.target.value, isPC, modifier)}
                        className="initiative-number-input"
                        autoFocus={participant === allParticipants[0]}
                        min="1"
                        max="20"
                      />
                      <span className="initiative-modifier">
                        {modifier >= 0 ? '+' : ''}{modifier}
                      </span>
                      <span className="initiative-total">
                        = {total}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} className="cancel-btn">Cancel</button>
          <button onClick={handleStart} className="start-btn">Start Encounter</button>
        </div>
      </div>
    </div>
  );
};
