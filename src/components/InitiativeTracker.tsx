import { useState } from 'react';
import { useApp } from '../AppContext';
import { ConditionBadge } from './ConditionBadge';
import { ConditionSelector } from './ConditionSelector';

export const InitiativeTracker = () => {
  const { state, setInitiative, updateCombatantHp, setTempHp, removeCombatant, restoreCombatant, nextTurn, endEncounter, addConditionToCombatant, removeConditionFromCombatant } = useApp();
  const [damageInputs, setDamageInputs] = useState<Record<string, string>>({});
  const [tempHpInputs, setTempHpInputs] = useState<Record<string, string>>({});
  const [initiativeInputs, setInitiativeInputs] = useState<Record<string, string>>({});
  const [conditionModalOpen, setConditionModalOpen] = useState<string | null>(null);
  const [expandedCombatants, setExpandedCombatants] = useState<Record<string, boolean>>({});

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

  const handleSetInitiativeRoll = (combatantId: string) => {
    const roll = parseInt(initiativeInputs[combatantId] || '0');
    setInitiative(combatantId, roll);
    setInitiativeInputs(prev => ({ ...prev, [combatantId]: '' }));
  };

  const handleSetTempHp = (combatantId: string) => {
    const tempHp = parseInt(tempHpInputs[combatantId] || '0');
    if (tempHp >= 0) {
      setTempHp(combatantId, tempHp);
      setTempHpInputs(prev => ({ ...prev, [combatantId]: '' }));
    }
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
          const isRemoved = combatant.removed === true;

          // Render removed combatants with minimal info
          if (isRemoved) {
            return (
              <div
                key={combatant.id}
                className="combatant-card removed"
              >
                <div className="combatant-header">
                  <div className="combatant-name-initiative">
                    <h4>{combatant.name}</h4>
                    <span className="removed-label">(Removed from encounter)</span>
                  </div>
                  <span className={`combatant-type ${combatant.isPlayer ? 'player' : 'monster'}`}>
                    {combatant.isPlayer ? 'PC' : 'NPC'}
                  </span>
                </div>
                <button
                  onClick={() => restoreCombatant(combatant.id)}
                  className="restore-btn"
                >
                  Restore to Encounter
                </button>
              </div>
            );
          }

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
                      value={initiativeInputs[combatant.id] ?? combatant.initiativeRoll}
                      onChange={e => setInitiativeInputs(prev => ({
                        ...prev,
                        [combatant.id]: e.target.value
                      }))}
                      onBlur={() => handleSetInitiativeRoll(combatant.id)}
                      className="initiative-input"
                      min="1"
                      max="20"
                      title="Initiative roll (d20)"
                    />
                    <span className="initiative-modifier">
                      {combatant.initiative >= 0 ? '+' : ''}{combatant.initiative}
                    </span>
                    <span className="initiative-total">
                      = {combatant.initiativeTotal}
                    </span>
                  </div>
                </div>
                <span className={`combatant-type ${combatant.isPlayer ? 'player' : 'monster'}`}>
                  {combatant.isPlayer ? 'PC' : 'NPC'}
                </span>
              </div>

              <div className="combatant-stats">
                <div className="stats-row">
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
                {combatant.tempHp > 0 && (
                  <div className="temp-hp-display">
                    <div className="temp-hp-bar-container">
                      <div
                        className="temp-hp-bar"
                        style={{
                          width: '100%',
                          backgroundColor: '#00bcd4'
                        }}
                      />
                    </div>
                    <span className="temp-hp-text">
                      {combatant.tempHp} Temp HP
                    </span>
                  </div>
                )}
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
                <button
                  onClick={() => removeCombatant(combatant.id)}
                  className="remove-combatant-btn"
                  title="Remove from encounter"
                >
                  Remove
                </button>
              </div>

              <div className="temp-hp-controls">
                <input
                  type="number"
                  placeholder="Temp HP"
                  value={tempHpInputs[combatant.id] || ''}
                  onChange={e => setTempHpInputs(prev => ({
                    ...prev,
                    [combatant.id]: e.target.value
                  }))}
                  className="temp-hp-input"
                  min="0"
                />
                <button
                  onClick={() => handleSetTempHp(combatant.id)}
                  className="set-temp-hp-btn"
                  disabled={!tempHpInputs[combatant.id]}
                >
                  Set Temp HP
                </button>
              </div>

              <div className="conditions-section">
                <div className="conditions-header">
                  <span className="conditions-label">Conditions:</span>
                  <button
                    onClick={() => setConditionModalOpen(combatant.id)}
                    className="add-condition-btn"
                  >
                    + Add
                  </button>
                </div>
                {combatant.conditions && combatant.conditions.length > 0 && (
                  <div className="conditions-list">
                    {combatant.conditions.map(condition => (
                      <ConditionBadge
                        key={condition.index}
                        condition={condition}
                        onRemove={() => removeConditionFromCombatant(combatant.id, condition.index)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {!combatant.isPlayer && (combatant.actions || combatant.special_abilities) && (
                <div className="monster-abilities-section">
                  <button
                    onClick={() => setExpandedCombatants(prev => ({ ...prev, [combatant.id]: !prev[combatant.id] }))}
                    className="expand-abilities-btn"
                  >
                    {expandedCombatants[combatant.id] ? '▼' : '▶'} Actions & Abilities
                  </button>

                  {expandedCombatants[combatant.id] && (
                    <div className="abilities-content">
                      {combatant.special_abilities && combatant.special_abilities.length > 0 && (
                        <div className="special-abilities">
                          <h5>Special Abilities</h5>
                          {combatant.special_abilities.map((ability, idx) => (
                            <div key={idx} className="ability-item">
                              <strong>{ability.name}:</strong> {ability.desc}
                            </div>
                          ))}
                        </div>
                      )}

                      {combatant.actions && combatant.actions.length > 0 && (
                        <div className="actions">
                          <h5>Actions</h5>
                          {combatant.actions.map((action, idx) => (
                            <div key={idx} className="action-item">
                              <strong>{action.name}</strong>
                              {action.attack_bonus !== undefined && (
                                <span className="attack-bonus"> +{action.attack_bonus} to hit</span>
                              )}
                              {action.damage && action.damage.length > 0 && (
                                <span className="damage-info">
                                  {' '}({action.damage.map(d => `${d.damage_dice} ${d.damage_type.name}`).join(', ')})
                                </span>
                              )}
                              <p className="action-desc">{action.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isDead && <div className="dead-indicator">UNCONSCIOUS/DEAD</div>}
            </div>
          );
        })}
      </div>

      {conditionModalOpen && (
        <ConditionSelector
          combatantName={activeEncounter.combatants.find(c => c.id === conditionModalOpen)?.name || ''}
          availableConditions={state.availableConditions}
          onAddCondition={(condition) => {
            addConditionToCombatant(conditionModalOpen, condition);
            setConditionModalOpen(null);
          }}
          onClose={() => setConditionModalOpen(null)}
        />
      )}
    </div>
  );
};
