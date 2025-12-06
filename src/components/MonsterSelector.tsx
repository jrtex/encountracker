import { useState, useEffect } from 'react';
import type { Monster } from '../types';

interface MonsterSelectorProps {
  onAddMonster: (monster: Omit<Monster, 'id'>) => void;
  onClose: () => void;
}

interface APIMonster {
  index: string;
  name: string;
  hit_points: number;
  armor_class: Array<{ value: number }>;
  challenge_rating: number;
  type: string;
  size: string;
}

export const MonsterSelector = ({ onAddMonster, onClose }: MonsterSelectorProps) => {
  const [monsters, setMonsters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<APIMonster | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    name: '',
    maxHp: 10,
    armorClass: 10,
    challenge_rating: '0',
    type: '',
    size: 'Medium',
  });

  useEffect(() => {
    fetch('https://www.dnd5eapi.co/api/monsters')
      .then(res => res.json())
      .then(data => {
        setMonsters(data.results || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load monsters:', err);
        setLoading(false);
      });
  }, []);

  const handleSelectMonster = async (index: string) => {
    try {
      const res = await fetch(`https://www.dnd5eapi.co/api/monsters/${index}`);
      const monster: APIMonster = await res.json();
      setSelectedMonster(monster);
    } catch (err) {
      console.error('Failed to load monster details:', err);
    }
  };

  const handleAddFromAPI = () => {
    if (!selectedMonster) return;

    onAddMonster({
      name: selectedMonster.name,
      maxHp: selectedMonster.hit_points,
      currentHp: selectedMonster.hit_points,
      armorClass: selectedMonster.armor_class[0]?.value || 10,
      challenge_rating: selectedMonster.challenge_rating.toString(),
      type: selectedMonster.type,
      size: selectedMonster.size,
      apiIndex: selectedMonster.index,
      isPlayer: false,
    });
    setSelectedMonster(null);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    onAddMonster({
      name: manualData.name,
      maxHp: manualData.maxHp,
      currentHp: manualData.maxHp,
      armorClass: manualData.armorClass,
      challenge_rating: manualData.challenge_rating,
      type: manualData.type,
      size: manualData.size,
      isPlayer: false,
    });
    setManualData({
      name: '',
      maxHp: 10,
      armorClass: 10,
      challenge_rating: '0',
      type: '',
      size: 'Medium',
    });
  };

  const filteredMonsters = monsters.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Monster/NPC</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="mode-toggle">
          <button
            className={!manualMode ? 'active' : ''}
            onClick={() => setManualMode(false)}
          >
            From API
          </button>
          <button
            className={manualMode ? 'active' : ''}
            onClick={() => setManualMode(true)}
          >
            Manual Entry
          </button>
        </div>

        {!manualMode ? (
          <div className="api-mode">
            {loading ? (
              <p>Loading monsters...</p>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search monsters..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="search-input"
                />

                <div className="monster-list">
                  {filteredMonsters.slice(0, 50).map(monster => (
                    <div
                      key={monster.index}
                      className={`monster-item ${selectedMonster?.index === monster.index ? 'selected' : ''}`}
                      onClick={() => handleSelectMonster(monster.index)}
                    >
                      {monster.name}
                    </div>
                  ))}
                </div>

                {selectedMonster && (
                  <div className="monster-details">
                    <h3>{selectedMonster.name}</h3>
                    <p>HP: {selectedMonster.hit_points}</p>
                    <p>AC: {selectedMonster.armor_class[0]?.value}</p>
                    <p>CR: {selectedMonster.challenge_rating}</p>
                    <p>Type: {selectedMonster.size} {selectedMonster.type}</p>
                    <button onClick={handleAddFromAPI} className="add-btn">
                      Add to Encounter
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleAddManual} className="manual-form">
            <label>
              <span>Name:</span>
              <input
                type="text"
                placeholder="Name"
                value={manualData.name}
                onChange={e => setManualData({ ...manualData, name: e.target.value })}
                required
              />
            </label>
            <label>
              <span>Max HP:</span>
              <input
                type="number"
                placeholder="Max HP"
                value={manualData.maxHp}
                onChange={e => setManualData({ ...manualData, maxHp: parseInt(e.target.value) })}
                required
                min="1"
              />
            </label>
            <label>
              <span>Armor Class:</span>
              <input
                type="number"
                placeholder="Armor Class"
                value={manualData.armorClass}
                onChange={e => setManualData({ ...manualData, armorClass: parseInt(e.target.value) })}
                required
                min="1"
              />
            </label>
            <label>
              <span>Challenge Rating:</span>
              <input
                type="text"
                placeholder="Challenge Rating (e.g., 1/4, 2, 13)"
                value={manualData.challenge_rating}
                onChange={e => setManualData({ ...manualData, challenge_rating: e.target.value })}
              />
            </label>
            <label>
              <span>Type:</span>
              <input
                type="text"
                placeholder="Type (e.g., goblin, dragon)"
                value={manualData.type}
                onChange={e => setManualData({ ...manualData, type: e.target.value })}
              />
            </label>
            <label>
              <span>Size:</span>
              <select
                value={manualData.size}
                onChange={e => setManualData({ ...manualData, size: e.target.value })}
              >
                <option>Tiny</option>
                <option>Small</option>
                <option>Medium</option>
                <option>Large</option>
                <option>Huge</option>
                <option>Gargantuan</option>
              </select>
            </label>
            <button type="submit" className="add-btn">Add Monster/NPC</button>
          </form>
        )}
      </div>
    </div>
  );
};
