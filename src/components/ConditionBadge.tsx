import type { Condition } from '../types';

interface ConditionBadgeProps {
  condition: Condition;
  onRemove: () => void;
}

export const ConditionBadge = ({ condition, onRemove }: ConditionBadgeProps) => {
  // Use first line of description for tooltip
  const tooltip = condition.desc[0] || condition.name;

  return (
    <span className="condition-badge" title={tooltip}>
      {condition.name}
      <button
        onClick={onRemove}
        className="condition-remove-btn"
        aria-label={`Remove ${condition.name} condition`}
      >
        ×
      </button>
    </span>
  );
};
