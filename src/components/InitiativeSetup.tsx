import { useState } from 'react';
import type { Character, Monster } from '../types';

interface InitiativeSetupProps {
  characters: Character[];
  monsters: Monster[];
  onStart: (initiatives: Record<string, number>) => void;
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
  const [initiatives, setInitiatives] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    characters.forEach(c => {
      initial[c.id] = c.initiative || 10;
    });
    monsters.forEach(m => {
      initial[m.id] = m.initiative || 10;
    });
    return initial;
  });

  const handleInitiativeChange = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setInitiatives(prev => ({ ...prev, [id]: numValue }));
  };

  const handleStart = () => {
    onStart(initiatives);
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

        <div className="initiative-setup-list">
          {allParticipants.map(participant => (
            <div key={participant.id} className="initiative-setup-row">
              <div className="participant-info">
                <span className="participant-name">{participant.name}</span>
                <span className={`participant-type ${participant.type.toLowerCase()}`}>
                  {participant.type}
                </span>
              </div>
              <div className="initiative-input-group">
                <label htmlFor={`init-${participant.id}`}>Initiative:</label>
                <input
                  id={`init-${participant.id}`}
                  type="number"
                  value={initiatives[participant.id] ?? 10}
                  onChange={e => handleInitiativeChange(participant.id, e.target.value)}
                  className="initiative-number-input"
                  autoFocus={participant === allParticipants[0]}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} className="cancel-btn">Cancel</button>
          <button onClick={handleStart} className="start-btn">Start Encounter</button>
        </div>
      </div>
    </div>
  );
};
