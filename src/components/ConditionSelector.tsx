import { useState } from 'react';
import type { Condition } from '../types';

interface ConditionSelectorProps {
  combatantName: string;
  availableConditions: Condition[];
  onAddCondition: (condition: Condition) => void;
  onClose: () => void;
}

export const ConditionSelector = ({
  combatantName,
  availableConditions,
  onAddCondition,
  onClose,
}: ConditionSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);

  const filteredConditions = availableConditions.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCondition = () => {
    if (!selectedCondition) return;
    onAddCondition(selectedCondition);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Condition to {combatantName}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {availableConditions.length === 0 ? (
          <p>Loading conditions...</p>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search conditions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <div className="monster-list">
              {filteredConditions.map(condition => (
                <div
                  key={condition.index}
                  className={`monster-item ${selectedCondition?.index === condition.index ? 'selected' : ''}`}
                  onClick={() => setSelectedCondition(condition)}
                >
                  {condition.name}
                </div>
              ))}
            </div>

            {selectedCondition && (
              <div className="monster-details">
                <h3>{selectedCondition.name}</h3>
                <div className="condition-description">
                  {selectedCondition.desc.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
                <button onClick={handleAddCondition} className="add-btn">
                  Add Condition
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
