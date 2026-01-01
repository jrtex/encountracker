// Public view for active encounter - Read-only, no authentication required

// D&D 5e Conditions with descriptions
const DND_CONDITIONS = {
  blinded: {
    name: "Blinded",
    description: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage."
  },
  charmed: {
    name: "Charmed",
    description: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature."
  },
  deafened: {
    name: "Deafened",
    description: "A deafened creature can't hear and automatically fails any ability check that requires hearing."
  },
  frightened: {
    name: "Frightened",
    description: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear."
  },
  grappled: {
    name: "Grappled",
    description: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the reach of the grappler."
  },
  invisible: {
    name: "Invisible",
    description: "An invisible creature is impossible to see without the aid of magic or a special sense. For the purpose of hiding, the creature is heavily obscured. The creature's location can be detected by any noise it makes or tracks it leaves. Attack rolls against the creature have disadvantage, and the creature's attack rolls have advantage."
  },
  paralyzed: {
    name: "Paralyzed",
    description: "A paralyzed creature is incapacitated and can't move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature."
  },
  petrified: {
    name: "Petrified",
    description: "A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging. The creature is incapacitated, can't move or speak, and is unaware of its surroundings. Attack rolls against the creature have advantage. The creature automatically fails Strength and Dexterity saving throws. The creature has resistance to all damage and is immune to poison and disease."
  },
  poisoned: {
    name: "Poisoned",
    description: "A poisoned creature has disadvantage on attack rolls and ability checks."
  },
  prone: {
    name: "Prone",
    description: "A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage."
  },
  restrained: {
    name: "Restrained",
    description: "A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws."
  },
  stunned: {
    name: "Stunned",
    description: "A stunned creature is incapacitated, can't move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage."
  },
  unconscious: {
    name: "Unconscious",
    description: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. The creature drops whatever it's holding and falls prone. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature."
  }
};

const PublicView = {
  encounterData: null,
  refreshInterval: null,
  REFRESH_RATE: 5000, // 5 seconds

  async init() {
    await this.loadEncounter();
    this.startAutoRefresh();
  },

  async loadEncounter() {
    try {
      const response = await fetch('/api/public/active-encounter');
      const result = await response.json();

      if (result.success && result.data) {
        this.encounterData = result.data;
        this.render();
      } else {
        this.encounterData = null;
        this.showNoEncounter();
      }
    } catch (error) {
      console.error('Error loading encounter:', error);
      this.showNoEncounter();
    }
  },

  startAutoRefresh() {
    // Clear existing interval if any
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Refresh every 5 seconds
    this.refreshInterval = setInterval(() => {
      this.loadEncounter();
    }, this.REFRESH_RATE);
  },

  showNoEncounter() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('no-encounter-state').style.display = 'block';
    document.getElementById('initiative-tracker-container').style.display = 'none';
  },

  render() {
    if (!this.encounterData) {
      this.showNoEncounter();
      return;
    }

    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('no-encounter-state').style.display = 'none';
    document.getElementById('initiative-tracker-container').style.display = 'block';

    this.renderInitiativeTracker();
  },

  renderInitiativeTracker() {
    const { encounter, participants } = this.encounterData;
    const container = document.getElementById('initiative-tracker-container');

    const participantRows = participants.map(p => this.renderParticipantRow(p)).join('');

    container.innerHTML = `
      <div class="initiative-tracker">
        <div class="tracker-header">
          <div>
            <h3>${encounter.name}</h3>
            <p style="color: #666; margin: 0.5rem 0 0 0;">
              ${encounter.campaign_name} - ${this.getDifficultyLabel(encounter.difficulty)}
            </p>
          </div>
          <div class="round-counter">Round: ${encounter.current_round}</div>
        </div>

        <div class="initiative-list">
          ${participantRows}
        </div>
      </div>
    `;

    // Setup event listeners for clickable badges
    this.setupEventListeners();
  },

  renderParticipantRow(participant) {
    const isUnconscious = this.hasCondition(participant.conditions, 'unconscious');
    const isCurrent = participant.is_current_turn;
    const participantType = participant.participant_type || 'player';
    const typeClass = participantType === 'player' ? 'type-player' : 'type-monster';
    const typeLabel = participantType === 'player' ? 'Player' : 'Monster';

    // For monsters, we only have hp_percentage, no actual HP values
    const hpPercentage = participant.hp_percentage || 0;

    let hpBarClass = 'hp-bar-fill';
    if (hpPercentage > 75) {
      hpBarClass += ' hp-healthy';
    } else if (hpPercentage > 25) {
      hpBarClass += ' hp-warning';
    } else {
      hpBarClass += ' hp-danger';
    }

    const unconsciousBadge = isUnconscious ?
      `<span class="badge badge-danger condition-badge clickable" data-condition="unconscious">Unconscious</span>` : '';

    const tempHpBadge = (participant.temp_hp && participant.temp_hp > 0) ?
      `<span class="badge temp-hp-badge" title="Temporary HP">+${participant.temp_hp} Temp HP</span>` : '';

    const removedBadge = participant.is_removed_from_combat ?
      `<span class="badge badge-secondary removed-badge">Removed</span>` : '';

    // Death saves badge (for players at 0 HP, not dead or stabilized)
    let deathSavesBadge = '';
    if (participantType === 'player' &&
        participant.current_hp === 0 &&
        !participant.is_stabilized &&
        !this.hasCondition(participant.conditions, 'Dead')) {
      const failures = participant.death_save_failures || 0;
      const successes = participant.death_save_successes || 0;
      deathSavesBadge = `<span class="badge badge-death-saves clickable"
        data-death-save-successes="${successes}"
        data-death-save-failures="${failures}"
        data-participant-name="${participant.name}"
        title="Click to view death saves">Death Saves ${failures}/3</span>`;
    }

    const conditionBadges = participant.conditions
      .filter(c => this.getConditionName(c) !== 'unconscious')
      .map(c => {
        const name = this.getConditionName(c);
        const isCustom = this.isCustomCondition(c);
        let badgeClass;
        if (name === 'Stabilized') {
          badgeClass = 'badge-stabilized';
        } else if (name === 'Dead') {
          badgeClass = 'badge-dead';
        } else {
          badgeClass = isCustom ? 'badge-info' : 'badge-warning';
        }
        const conditionJson = JSON.stringify(c).replace(/"/g, '&quot;');
        return `<span class="badge ${badgeClass} condition-badge clickable" data-condition="${conditionJson}">${name}</span>`;
      })
      .join('');

    const isRemoved = participant.is_removed_from_combat || false;
    const rowClass = `initiative-row ${isCurrent ? 'current-turn' : ''} ${isUnconscious ? 'unconscious' : ''} ${isRemoved ? 'removed-from-combat' : ''}`;

    // Build HP display based on participant type
    let hpDisplay = '';
    let armorClassDisplay = '';

    if (participantType === 'player') {
      // Players: show actual HP values and AC
      hpDisplay = `<div class="hp-display">${participant.current_hp} / ${participant.max_hp}</div>`;
      armorClassDisplay = `<span class="creature-ac">AC ${participant.armor_class}</span>`;
    } else {
      // Monsters: no HP values or AC (secret info)
      hpDisplay = `<div class="hp-display" style="visibility: hidden;">0 / 0</div>`; // Maintain layout
      armorClassDisplay = ''; // No AC for monsters
    }

    return `
      <div class="${rowClass}">
        <!-- Column 1: Turn Indicator -->
        <div class="turn-indicator">${participant.turn_order}</div>

        <!-- Column 2: Creature Information -->
        <div class="creature-info">
          <div class="creature-name">${participant.name}</div>
          <div class="creature-stats">
            <span class="creature-initiative">Init: ${participant.initiative}</span>
            ${armorClassDisplay}
          </div>
          <span class="participant-type ${typeClass}">${typeLabel}</span>
        </div>

        <!-- Column 3: Temporary Badges -->
        <div class="temporary-badges">
          ${removedBadge}
          ${deathSavesBadge}
          ${tempHpBadge}
          ${unconsciousBadge}
          ${conditionBadges}
        </div>

        <!-- Column 4: Health Section (read-only) -->
        <div class="health-section">
          ${hpDisplay}

          <!-- HP Bar -->
          <div class="hp-bar-container">
            <div class="${hpBarClass}" style="width: ${Math.max(0, hpPercentage)}%"></div>
          </div>
        </div>
      </div>
    `;
  },

  getDifficultyLabel(difficulty) {
    const labels = {
      'easy': 'Easy',
      'medium': 'Medium',
      'hard': 'Hard',
      'deadly': 'Deadly'
    };
    return labels[difficulty] || 'Unknown';
  },

  setupEventListeners() {
    const container = document.getElementById('initiative-tracker-container');
    if (!container) return;

    // Condition badge click handlers
    container.querySelectorAll('.condition-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const conditionData = e.target.getAttribute('data-condition');

        let condition;
        try {
          condition = JSON.parse(conditionData);
        } catch {
          condition = conditionData; // Simple string
        }

        this.showConditionBubble(condition, e.target);
      });
    });

    // Death saves badge click handlers
    container.querySelectorAll('.badge-death-saves').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const successes = parseInt(e.target.getAttribute('data-death-save-successes')) || 0;
        const failures = parseInt(e.target.getAttribute('data-death-save-failures')) || 0;
        const participantName = e.target.getAttribute('data-participant-name') || 'Combatant';

        this.showDeathSavesBubble(successes, failures, participantName, e.target);
      });
    });
  },

  showConditionBubble(condition, badgeElement) {
    // Close any existing bubbles
    const existingBubble = document.querySelector('.condition-bubble');
    if (existingBubble) {
      existingBubble.remove();
    }

    const conditionName = this.getConditionName(condition);
    const conditionDesc = this.getConditionDescription(condition);
    const isCustom = this.isCustomCondition(condition);

    // Create bubble element
    const bubble = document.createElement('div');
    bubble.className = 'condition-bubble';
    bubble.innerHTML = `
      <div class="condition-bubble-header">
        ${conditionName}
        ${isCustom ? '<span class="badge badge-info">Custom</span>' : ''}
      </div>
      <div class="condition-bubble-description">${conditionDesc}</div>
    `;

    // Add to body
    document.body.appendChild(bubble);

    // Position the bubble near the badge
    const badgeRect = badgeElement.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    // Calculate position (below the badge, centered)
    let top = badgeRect.bottom + window.scrollY + 8;
    let left = badgeRect.left + window.scrollX + (badgeRect.width / 2) - (bubbleRect.width / 2);

    // Adjust if bubble goes off-screen to the right
    if (left + bubbleRect.width > window.innerWidth) {
      left = window.innerWidth - bubbleRect.width - 10;
    }

    // Adjust if bubble goes off-screen to the left
    if (left < 10) {
      left = 10;
    }

    // Adjust if bubble goes off-screen at the bottom
    if (top + bubbleRect.height > window.innerHeight + window.scrollY) {
      // Show above the badge instead
      top = badgeRect.top + window.scrollY - bubbleRect.height - 8;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    // Show the bubble
    setTimeout(() => bubble.classList.add('show'), 10);

    // Close on click outside
    const closeHandler = (e) => {
      if (!bubble.contains(e.target) && e.target !== badgeElement) {
        bubble.classList.remove('show');
        setTimeout(() => {
          bubble.remove();
        }, 200);
        document.removeEventListener('click', closeHandler);
      }
    };

    // Also close on scroll
    const scrollHandler = () => {
      bubble.classList.remove('show');
      setTimeout(() => {
        bubble.remove();
      }, 200);
      document.removeEventListener('click', closeHandler);
      window.removeEventListener('scroll', scrollHandler, true);
    };

    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      window.addEventListener('scroll', scrollHandler, true);
    }, 100);
  },

  showDeathSavesBubble(successes, failures, participantName, badgeElement) {
    // Close any existing bubbles
    const existingBubble = document.querySelector('.condition-bubble');
    if (existingBubble) {
      existingBubble.remove();
    }

    // Create bubble element
    const bubble = document.createElement('div');
    bubble.className = 'condition-bubble';
    bubble.style.minWidth = 'auto';
    bubble.style.padding = '0.75rem';
    bubble.innerHTML = `
      <div class="condition-bubble-header" style="margin-bottom: 0.25rem;">
        Death Saves - ${participantName}
      </div>
      <div class="condition-bubble-description" style="line-height: 1.3;">
        <p style="margin: 0 0 0.25rem 0;">Combatant is fighting for their lives. At 3 successes, they will be stabilized. After 3 failures, they will die permanently.</p>
        <p style="margin: 0;"><strong style="color: #27ae60;">Successes:</strong> ${successes}/3</p>
        <p style="margin: 0;"><strong style="color: #e74c3c;">Failures:</strong> ${failures}/3</p>
      </div>
    `;

    // Add to body
    document.body.appendChild(bubble);

    // Position the bubble near the badge
    const badgeRect = badgeElement.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    // Calculate position (below the badge, centered)
    let top = badgeRect.bottom + window.scrollY + 8;
    let left = badgeRect.left + window.scrollX + (badgeRect.width / 2) - (bubbleRect.width / 2);

    // Adjust if bubble goes off-screen to the right
    if (left + bubbleRect.width > window.innerWidth) {
      left = window.innerWidth - bubbleRect.width - 10;
    }

    // Adjust if bubble goes off-screen to the left
    if (left < 10) {
      left = 10;
    }

    // Adjust if bubble goes off-screen at the bottom
    if (top + bubbleRect.height > window.innerHeight + window.scrollY) {
      // Show above the badge instead
      top = badgeRect.top + window.scrollY - bubbleRect.height - 8;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    // Show the bubble
    setTimeout(() => bubble.classList.add('show'), 10);

    // Close on click outside
    const closeHandler = (e) => {
      if (!bubble.contains(e.target) && e.target !== badgeElement) {
        bubble.classList.remove('show');
        setTimeout(() => {
          bubble.remove();
        }, 200);
        document.removeEventListener('click', closeHandler);
      }
    };

    // Also close on scroll
    const scrollHandler = () => {
      bubble.classList.remove('show');
      setTimeout(() => {
        bubble.remove();
      }, 200);
      document.removeEventListener('click', closeHandler);
      window.removeEventListener('scroll', scrollHandler, true);
    };

    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      window.addEventListener('scroll', scrollHandler, true);
    }, 100);
  },

  // Helper methods for condition management
  getConditionName(condition) {
    return typeof condition === 'string' ? condition : condition.name;
  },

  getConditionDescription(condition) {
    if (typeof condition === 'object' && condition.description) {
      return condition.description;
    }
    const name = this.getConditionName(condition);
    return DND_CONDITIONS[name]?.description || 'No description available';
  },

  isCustomCondition(condition) {
    return typeof condition === 'object' && condition.type === 'custom';
  },

  hasCondition(conditions, conditionName) {
    return conditions.some(c => this.getConditionName(c) === conditionName);
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  PublicView.init();
});

// Cleanup interval on page unload
window.addEventListener('beforeunload', () => {
  if (PublicView.refreshInterval) {
    clearInterval(PublicView.refreshInterval);
  }
});
