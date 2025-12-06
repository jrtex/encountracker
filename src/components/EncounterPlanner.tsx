import { useState } from 'react';
import { useApp } from '../AppContext';
import { MonsterSelector } from './MonsterSelector';
import { InitiativeSetup } from './InitiativeSetup';

export const EncounterPlanner = () => {
  const {
    state,
    createEncounter,
    addMonsterToEncounter,
    removeMonsterFromEncounter,
    deleteEncounter,
    startEncounter,
  } = useApp();

  const [showNewEncounterForm, setShowNewEncounterForm] = useState(false);
  const [newEncounterName, setNewEncounterName] = useState('');
  const [newEncounterDesc, setNewEncounterDesc] = useState('');
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [showMonsterSelector, setShowMonsterSelector] = useState(false);
  const [showInitiativeSetup, setShowInitiativeSetup] = useState(false);
  const [encounterToStart, setEncounterToStart] = useState<string | null>(null);

  const handleCreateEncounter = (e: React.FormEvent) => {
    e.preventDefault();
    createEncounter(newEncounterName, newEncounterDesc);
    setNewEncounterName('');
    setNewEncounterDesc('');
    setShowNewEncounterForm(false);
  };

  const handleStartEncounter = (encounterId: string) => {
    if (state.characters.length === 0) {
      alert('Please add at least one player character before starting an encounter.');
      return;
    }
    setEncounterToStart(encounterId);
    setShowInitiativeSetup(true);
  };

  const handleInitiativeStart = (initiatives: Record<string, number>) => {
    if (!encounterToStart) return;

    // Update characters and monsters with their initiative values
    const updatedCharacters = state.characters.map(c => ({
      ...c,
      initiative: initiatives[c.id] ?? c.initiative ?? 0,
    }));

    startEncounter(encounterToStart, updatedCharacters, initiatives);
    setShowInitiativeSetup(false);
    setEncounterToStart(null);
  };

  return (
    <div className="encounter-planner">
      <div className="section-header">
        <h2>Encounter Planning</h2>
        <button onClick={() => setShowNewEncounterForm(!showNewEncounterForm)}>
          {showNewEncounterForm ? 'Cancel' : 'New Encounter'}
        </button>
      </div>

      {showNewEncounterForm && (
        <form onSubmit={handleCreateEncounter} className="encounter-form">
          <input
            type="text"
            placeholder="Encounter Name"
            value={newEncounterName}
            onChange={e => setNewEncounterName(e.target.value)}
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newEncounterDesc}
            onChange={e => setNewEncounterDesc(e.target.value)}
          />
          <button type="submit">Create Encounter</button>
        </form>
      )}

      <div className="encounters-list">
        {state.encounters
          .filter(enc => !enc.isActive)
          .map(encounter => (
            <div
              key={encounter.id}
              className={`encounter-card ${selectedEncounterId === encounter.id ? 'selected' : ''}`}
            >
              <div className="encounter-header">
                <h3 onClick={() => setSelectedEncounterId(encounter.id)}>
                  {encounter.name}
                </h3>
                <div className="encounter-actions">
                  <button
                    onClick={() => handleStartEncounter(encounter.id)}
                    className="start-btn"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => deleteEncounter(encounter.id)}
                    className="delete-btn"
                  >
                    ×
                  </button>
                </div>
              </div>

              {encounter.description && (
                <p className="encounter-description">{encounter.description}</p>
              )}

              {selectedEncounterId === encounter.id && (
                <div className="encounter-details">
                  <div className="monsters-header">
                    <h4>Monsters ({encounter.monsters.length})</h4>
                    <button
                      onClick={() => {
                        setSelectedEncounterId(encounter.id);
                        setShowMonsterSelector(true);
                      }}
                      className="add-monster-btn"
                    >
                      Add Monster/NPC
                    </button>
                  </div>

                  <div className="monsters-list">
                    {encounter.monsters.map(monster => (
                      <div key={monster.id} className="monster-card">
                        <div className="monster-info">
                          <strong>{monster.name}</strong>
                          <span className="monster-stats">
                            HP: {monster.maxHp} | AC: {monster.armorClass}
                            {monster.challenge_rating && ` | CR: ${monster.challenge_rating}`}
                          </span>
                        </div>
                        <button
                          onClick={() => removeMonsterFromEncounter(encounter.id, monster.id)}
                          className="remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {encounter.monsters.length === 0 && (
                    <p className="empty-message">No monsters added yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>

      {state.encounters.filter(e => !e.isActive).length === 0 && !showNewEncounterForm && (
        <p className="empty-message">No planned encounters. Create your first encounter!</p>
      )}

      {showMonsterSelector && selectedEncounterId && (
        <MonsterSelector
          onAddMonster={monster => {
            addMonsterToEncounter(selectedEncounterId, monster);
            setShowMonsterSelector(false);
          }}
          onClose={() => setShowMonsterSelector(false)}
        />
      )}

      {showInitiativeSetup && encounterToStart && (
        <InitiativeSetup
          characters={state.characters}
          monsters={state.encounters.find(e => e.id === encounterToStart)?.monsters || []}
          onStart={handleInitiativeStart}
          onCancel={() => {
            setShowInitiativeSetup(false);
            setEncounterToStart(null);
          }}
          encounterName={state.encounters.find(e => e.id === encounterToStart)?.name || ''}
        />
      )}
    </div>
  );
};
