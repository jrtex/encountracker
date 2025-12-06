import { useState } from 'react';
import { useApp } from '../AppContext';

export const InitiativeTracker = () => {
  const { state, setInitiative, updateCombatantHp, nextTurn, endEncounter } = useApp();
  const [damageInputs, setDamageInputs] = useState<Record<string, string>>({});
  const [initiativeInputs, setInitiativeInputs] = useState<Record<string, string>>({});

  const activeEncounter = state.encounters.find(e => e.id === state.activeEncounterId);

  if (!activeEncounter || !activeEncounter.combatants) {
    return (
      <div className="initiative-tracker">
        <h2>Active Encounter</h2>
        <p className="empty-message">No active encounter. Start an encounter from the planner!</p>
      </div>
    );
  }

  const currentCombatant = activeEncounter.combatants[activeEncounter.currentTurn || 0];

  const handleApplyDamage = (combatantId: string, currentHp: number) => {
    const damage = parseInt(damageInputs[combatantId] || '0');
    if (damage !== 0) {
      updateCombatantHp(combatantId, currentHp - damage);
      setDamageInputs(prev => ({ ...prev, [combatantId]: '' }));
    }
  };

  const handleApplyHealing = (combatantId: string, currentHp: number) => {
    const healing = parseInt(damageInputs[combatantId] || '0');
    if (healing !== 0) {
      updateCombatantHp(combatantId, currentHp + healing);
      setDamageInputs(prev => ({ ...prev, [combatantId]: '' }));
    }
  };

  const handleSetInitiative = (combatantId: string) => {
    const initiative = parseInt(initiativeInputs[combatantId] || '0');
    setInitiative(combatantId, initiative);
    setInitiativeInputs(prev => ({ ...prev, [combatantId]: '' }));
  };

  const handleEndEncounter = () => {
    if (confirm('Are you sure you want to end this encounter?')) {
      endEncounter();
    }
  };

  return (
    <div className="initiative-tracker">
      <div className="section-header">
        <h2>{activeEncounter.name}</h2>
        <div className="encounter-controls">
          <button onClick={nextTurn} className="next-turn-btn">
            Next Turn
          </button>
          <button onClick={handleEndEncounter} className="end-encounter-btn">
            End Encounter
          </button>
        </div>
      </div>

      <div className="current-turn">
        <h3>Current Turn: {currentCombatant?.name}</h3>
      </div>

      <div className="combatants-list">
        {activeEncounter.combatants.map((combatant, index) => {
          const isCurrentTurn = index === activeEncounter.currentTurn;
          const isDead = combatant.currentHp <= 0;
          const hpPercent = (combatant.currentHp / combatant.maxHp) * 100;

          return (
            <div
              key={combatant.id}
              className={`combatant-card ${isCurrentTurn ? 'current-turn' : ''} ${isDead ? 'dead' : ''}`}
            >
              <div className="combatant-header">
                <div className="combatant-name-initiative">
                  <h4>{combatant.name}</h4>
                  <div className="initiative-display">
                    <span className="initiative-label">Init:</span>
                    <input
                      type="number"
                      value={initiativeInputs[combatant.id] ?? combatant.initiative}
                      onChange={e => setInitiativeInputs(prev => ({
                        ...prev,
                        [combatant.id]: e.target.value
                      }))}
                      onBlur={() => handleSetInitiative(combatant.id)}
                      className="initiative-input"
                    />
                  </div>
                </div>
                <span className={`combatant-type ${combatant.isPlayer ? 'player' : 'monster'}`}>
                  {combatant.isPlayer ? 'PC' : 'NPC'}
                </span>
              </div>

              <div className="combatant-stats">
                <div className="hp-display">
                  <div className="hp-bar-container">
                    <div
                      className="hp-bar"
                      style={{
                        width: `${hpPercent}%`,
                        backgroundColor: hpPercent > 50 ? '#4caf50' : hpPercent > 25 ? '#ff9800' : '#f44336'
                      }}
                    />
                  </div>
                  <span className="hp-text">
                    {combatant.currentHp}/{combatant.maxHp} HP
                  </span>
                </div>
                <div className="ac-display">
                  <span className="ac-label">AC:</span>
                  <span className="ac-value">{combatant.armorClass}</span>
                </div>
              </div>

              <div className="damage-controls">
                <input
                  type="number"
                  placeholder="Amount"
                  value={damageInputs[combatant.id] || ''}
                  onChange={e => setDamageInputs(prev => ({
                    ...prev,
                    [combatant.id]: e.target.value
                  }))}
                  className="damage-input"
                />
                <button
                  onClick={() => handleApplyDamage(combatant.id, combatant.currentHp)}
                  className="damage-btn"
                  disabled={!damageInputs[combatant.id]}
                >
                  Damage
                </button>
                <button
                  onClick={() => handleApplyHealing(combatant.id, combatant.currentHp)}
                  className="heal-btn"
                  disabled={!damageInputs[combatant.id]}
                >
                  Heal
                </button>
              </div>

              {isDead && <div className="dead-indicator">UNCONSCIOUS/DEAD</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
