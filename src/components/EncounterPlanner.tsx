import { useState } from 'react';
import { useApp } from '../AppContext';
import { MonsterSelector } from './MonsterSelector';
import { InitiativeSetup } from './InitiativeSetup';

export const EncounterPlanner = () => {
  const {
    state,
    createEncounter,
    addMonsterToEncounter,
    updateMonsterInEncounter,
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
  const [editingMonsterId, setEditingMonsterId] = useState<string | null>(null);
  const [monsterEditData, setMonsterEditData] = useState({
    name: '',
    maxHp: 10,
    armorClass: 10,
  });

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

  const handleEditMonster = (encounterId: string, monster: typeof state.encounters[0]['monsters'][0]) => {
    setMonsterEditData({
      name: monster.name,
      maxHp: monster.maxHp,
      armorClass: monster.armorClass,
    });
    setEditingMonsterId(monster.id);
    setSelectedEncounterId(encounterId);
  };

  const handleSaveMonsterEdit = (encounterId: string, monsterId: string) => {
    updateMonsterInEncounter(encounterId, monsterId, {
      ...monsterEditData,
      currentHp: monsterEditData.maxHp,
    });
    setEditingMonsterId(null);
    setMonsterEditData({ name: '', maxHp: 10, armorClass: 10 });
  };

  const handleCancelMonsterEdit = () => {
    setEditingMonsterId(null);
    setMonsterEditData({ name: '', maxHp: 10, armorClass: 10 });
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
        {state.encounters.map(encounter => (
          <div
            key={encounter.id}
            className={`encounter-card ${selectedEncounterId === encounter.id ? 'selected' : ''} ${encounter.isActive ? 'active-encounter' : ''}`}
          >
            <div className="encounter-header">
              <h3 onClick={() => !encounter.isActive && setSelectedEncounterId(encounter.id)}>
                {encounter.name}
                {encounter.isActive && <span className="active-badge"> (Active)</span>}
              </h3>
              <div className="encounter-actions">
                {!encounter.isActive && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {encounter.description && (
              <p className="encounter-description">{encounter.description}</p>
            )}

            {selectedEncounterId === encounter.id && !encounter.isActive && (
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
                      {editingMonsterId === monster.id ? (
                        <div className="monster-edit-form">
                          <input
                            type="text"
                            value={monsterEditData.name}
                            onChange={e => setMonsterEditData({ ...monsterEditData, name: e.target.value })}
                            placeholder="Name"
                          />
                          <input
                            type="number"
                            value={monsterEditData.maxHp}
                            onChange={e => setMonsterEditData({ ...monsterEditData, maxHp: parseInt(e.target.value) })}
                            placeholder="HP"
                            min="1"
                          />
                          <input
                            type="number"
                            value={monsterEditData.armorClass}
                            onChange={e => setMonsterEditData({ ...monsterEditData, armorClass: parseInt(e.target.value) })}
                            placeholder="AC"
                            min="1"
                          />
                          <button
                            onClick={() => handleSaveMonsterEdit(encounter.id, monster.id)}
                            className="save-btn"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelMonsterEdit}
                            className="cancel-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="monster-info">
                            <strong>{monster.name}</strong>
                            <span className="monster-stats">
                              HP: {monster.maxHp} | AC: {monster.armorClass}
                              {monster.challenge_rating && ` | CR: ${monster.challenge_rating}`}
                            </span>
                          </div>
                          <div className="monster-actions">
                            <button
                              onClick={() => handleEditMonster(encounter.id, monster)}
                              className="edit-btn"
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => removeMonsterFromEncounter(encounter.id, monster.id)}
                              className="remove-btn"
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {encounter.monsters.length === 0 && (
                  <p className="empty-message">No monsters added yet.</p>
                )}
              </div>
            )}

            {encounter.isActive && (
              <div className="encounter-details read-only">
                <div className="monsters-header">
                  <h4>Monsters ({encounter.monsters.length})</h4>
                </div>

                <div className="monsters-list">
                  {encounter.monsters.map(monster => (
                    <div key={monster.id} className="monster-card read-only">
                      <div className="monster-info">
                        <strong>{monster.name}</strong>
                        <span className="monster-stats">
                          HP: {monster.maxHp} | AC: {monster.armorClass}
                          {monster.challenge_rating && ` | CR: ${monster.challenge_rating}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {encounter.monsters.length === 0 && (
                  <p className="empty-message">No monsters in this encounter.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {state.encounters.length === 0 && !showNewEncounterForm && (
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
