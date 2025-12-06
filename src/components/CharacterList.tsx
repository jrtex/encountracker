import { useState } from 'react';
import { useApp } from '../AppContext';

export const CharacterList = () => {
  const { state, addCharacter, removeCharacter, updateCharacter } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    maxHp: 10,
    currentHp: 10,
    armorClass: 10,
    initiative: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCharacter({
      ...formData,
      isPlayer: true,
    });
    setFormData({ name: '', maxHp: 10, currentHp: 10, armorClass: 10, initiative: 0 });
    setShowForm(false);
  };

  const handleHeal = (id: string, maxHp: number) => {
    updateCharacter(id, { currentHp: maxHp });
  };

  return (
    <div className="character-list">
      <div className="section-header">
        <h2>Player Characters</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Character'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="character-form">
          <label>
            <span>Name:</span>
            <input
              type="text"
              placeholder="Character Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Max HP:</span>
            <input
              type="number"
              placeholder="Max HP"
              value={formData.maxHp}
              onChange={e => {
                const maxHp = parseInt(e.target.value);
                setFormData({ ...formData, maxHp, currentHp: maxHp });
              }}
              required
              min="1"
            />
          </label>
          <label>
            <span>Armor Class:</span>
            <input
              type="number"
              placeholder="Armor Class"
              value={formData.armorClass}
              onChange={e => setFormData({ ...formData, armorClass: parseInt(e.target.value) })}
              required
              min="1"
            />
          </label>
          <label>
            <span>Initiative:</span>
            <input
              type="number"
              placeholder="Initiative"
              value={formData.initiative}
              onChange={e => setFormData({ ...formData, initiative: parseInt(e.target.value) || 0 })}
            />
          </label>
          <button type="submit">Add</button>
        </form>
      )}

      <div className="character-cards">
        {state.characters.map(char => (
          <div key={char.id} className="character-card">
            <div className="character-header">
              <h3>{char.name}</h3>
              <button onClick={() => removeCharacter(char.id)} className="delete-btn">
                ×
              </button>
            </div>
            <div className="character-stats">
              <div className="stat">
                <span className="stat-label">HP:</span>
                <span className="stat-value">{char.currentHp}/{char.maxHp}</span>
              </div>
              <div className="stat">
                <span className="stat-label">AC:</span>
                <span className="stat-value">{char.armorClass}</span>
              </div>
            </div>
            {char.currentHp < char.maxHp && (
              <button
                onClick={() => handleHeal(char.id, char.maxHp)}
                className="heal-btn"
              >
                Full Heal
              </button>
            )}
          </div>
        ))}
      </div>

      {state.characters.length === 0 && !showForm && (
        <p className="empty-message">No characters yet. Add your party members!</p>
      )}
    </div>
  );
};
