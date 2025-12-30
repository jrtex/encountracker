// Initiative Tracker Module

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

const Initiative = {
  currentEncounter: null,
  initiativeData: null,
  container: null,

  async init() {
    this.container = document.getElementById('initiative-tracker-widget');
    if (!this.container) {
      console.error('Initiative tracker widget container not found');
      return;
    }

    await this.loadActiveEncounter();
    this.render();

    // Subscribe to campaign changes
    CampaignContext.subscribe(async () => {
      await this.loadActiveEncounter();
      this.render();
    });
  },

  async loadActiveEncounter() {
    try {
      const campaignId = CampaignContext.getActiveCampaignId();

      if (!campaignId) {
        this.currentEncounter = null;
        this.initiativeData = null;
        return;
      }

      const response = await API.encounters.getActive();
      const encounters = response.data || [];

      // Filter to current campaign
      const campaignEncounters = encounters.filter(e => e.campaign_id == campaignId);

      if (campaignEncounters.length > 0) {
        this.currentEncounter = campaignEncounters[0];
        // Load initiative data
        await this.loadInitiative();
      } else {
        this.currentEncounter = null;
        this.initiativeData = null;
      }
    } catch (error) {
      console.error('Error loading active encounter:', error);
      this.currentEncounter = null;
      this.initiativeData = null;
    }
  },

  async loadInitiative() {
    if (!this.currentEncounter) return;

    try {
      const response = await API.combat.getInitiative(this.currentEncounter.id);
      this.initiativeData = response.data;

      // Load actions for each monster participant
      if (this.initiativeData && this.initiativeData.participants) {
        for (let participant of this.initiativeData.participants) {
          if (participant.participant_type === 'monster' && participant.participant_id) {
            try {
              const actionsResponse = await API.monsters.getActions(participant.participant_id);
              participant.actions = actionsResponse.data || [];
            } catch (error) {
              // If actions can't be loaded, just set to empty array
              participant.actions = [];
            }
          } else {
            participant.actions = [];
          }
        }
      }
    } catch (error) {
      console.error('Error loading initiative:', error);
      this.initiativeData = null;
    }
  },

  render() {
    if (!this.container) return;

    if (!this.currentEncounter) {
      this.renderNoActiveEncounter();
    } else if (!this.initiativeData || this.initiativeData.participants.length === 0) {
      this.renderStartCombat();
    } else {
      this.renderInitiativeTracker();
    }
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
  },

  async renderNoActiveEncounter() {
    // Load pending encounters for the active campaign
    const campaignId = CampaignContext.getActiveCampaignId();

    if (!campaignId) {
      this.container.innerHTML = `
        <div class="no-active-encounter">
          <div class="alert alert-info">
            <p>No campaign selected. Please select a campaign from the navigation bar.</p>
          </div>
        </div>
      `;
      return;
    }

    let pendingEncounters = [];
    try {
      const response = await API.encounters.getAll(campaignId, 'pending');
      pendingEncounters = response.data || [];
    } catch (error) {
      console.error('Error loading pending encounters:', error);
    }

    if (pendingEncounters.length === 0) {
      this.container.innerHTML = `
        <div class="no-active-encounter">
          <div class="alert alert-info">
            <p>No pending encounters. Create an encounter first.</p>
          </div>
          <a href="#" data-page="encounters" class="btn btn-primary">Go to Encounters</a>
        </div>
      `;

      // Set up navigation link
      const link = this.container.querySelector('[data-page="encounters"]');
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          App.showPage('encounters');
        });
      }
    } else {
      // Show list of pending encounters with "Start" button for each
      const encounterCards = pendingEncounters.map(enc => `
        <div class="pending-encounter-card">
          <div class="pending-encounter-header">
            <h4>${enc.name}</h4>
            <span class="badge badge-${this.getDifficultyBadgeType(enc.difficulty)}">${enc.difficulty}</span>
          </div>
          <p class="pending-encounter-description">${enc.description || 'No description'}</p>
          <button class="btn btn-success btn-sm start-encounter-btn admin-only" data-encounter-id="${enc.id}">
            Start Combat
          </button>
        </div>
      `).join('');

      this.container.innerHTML = `
        <div class="pending-encounters-list">
          <h3>Select an Encounter to Start</h3>
          <div class="pending-encounters-grid">
            ${encounterCards}
          </div>
        </div>
      `;

      // Hide admin buttons if not admin
      if (Auth.currentUser && Auth.currentUser.role !== 'admin') {
        this.container.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
      }

      // Set up start buttons
      this.container.querySelectorAll('.start-encounter-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const encounterId = e.target.getAttribute('data-encounter-id');
          this.currentEncounter = pendingEncounters.find(enc => enc.id == encounterId);
          await this.showStartCombatModal();
        });
      });
    }
  },

  getDifficultyBadgeType(difficulty) {
    const types = {
      'easy': 'success',
      'medium': 'info',
      'hard': 'warning',
      'deadly': 'danger'
    };
    return types[difficulty] || 'info';
  },

  renderStartCombat() {
    this.container.innerHTML = `
      <div class="initiative-tracker">
        <div class="tracker-header">
          <h3>Active Encounter: ${this.currentEncounter.name}</h3>
        </div>
        <div class="text-center" style="padding: 2rem;">
          <p>Combat has not started yet.</p>
          <button id="start-combat-btn" class="btn btn-success admin-only">Start Combat</button>
        </div>
      </div>
    `;

    // Hide if not admin
    if (Auth.currentUser && Auth.currentUser.role !== 'admin') {
      const btn = this.container.querySelector('#start-combat-btn');
      if (btn) btn.style.display = 'none';
    }

    // Set up start combat button
    const startBtn = this.container.querySelector('#start-combat-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.showStartCombatModal());
    }
  },

  renderInitiativeTracker() {
    const { participants, current_round } = this.initiativeData;

    const participantRows = participants.map(p => this.renderParticipantRow(p)).join('');

    this.container.innerHTML = `
      <div class="initiative-tracker">
        <div class="tracker-header">
          <div>
            <h3>Active Encounter: ${this.currentEncounter.name}</h3>
          </div>
          <div class="round-counter">Round: ${current_round}</div>
          <div class="tracker-controls-header">
            <button id="end-combat-btn" class="btn btn-danger btn-sm admin-only">End Combat</button>
          </div>
        </div>

        <div class="tracker-controls">
          <button id="next-turn-btn" class="btn btn-primary admin-only">Next Turn ➜</button>
        </div>

        <div class="initiative-list">
          ${participantRows}
        </div>
      </div>
    `;

    // Hide admin buttons if not admin
    if (Auth.currentUser && Auth.currentUser.role !== 'admin') {
      this.container.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    this.setupEventListeners();
  },

  renderParticipantRow(participant) {
    const hpPercentage = (participant.current_hp / participant.max_hp) * 100;
    const isUnconscious = this.hasCondition(participant.conditions, 'unconscious');
    const isCurrent = participant.is_current_turn;

    // Determine participant type (player vs monster)
    const participantType = participant.participant_type || 'player';
    const typeClass = participantType === 'player' ? 'type-player' : 'type-monster';
    const typeLabel = participantType === 'player' ? 'Player' : 'Monster';

    let hpBarClass = 'hp-bar-fill';
    if (hpPercentage > 75) {
      hpBarClass += ' hp-healthy';
    } else if (hpPercentage > 25) {
      hpBarClass += ' hp-warning';
    } else {
      hpBarClass += ' hp-danger';
    }

    const unconsciousBadge = isUnconscious ?
      '<span class="badge badge-danger condition-badge" data-condition="unconscious" data-init-id="' + participant.id + '">Unconscious</span>' : '';

    const tempHpBadge = (participant.temp_hp && participant.temp_hp > 0) ?
      '<span class="badge temp-hp-badge" data-init-id="' + participant.id + '" title="Temporary HP">+' + participant.temp_hp + ' Temp HP</span>' : '';

    const removedBadge = participant.is_removed_from_combat ?
      '<span class="badge badge-secondary removed-badge" data-init-id="' + participant.id + '">Removed</span>' : '';

    // Death saves badge (only for players at 0 HP, not dead or stabilized)
    let deathSavesBadge = '';
    if (participant.participant_type === 'player' &&
        participant.current_hp === 0 &&
        !participant.is_stabilized &&
        !this.hasCondition(participant.conditions, 'Dead')) {
      const failures = participant.death_save_failures || 0;
      deathSavesBadge = '<span class="badge badge-death-saves clickable" data-init-id="' + participant.id + '" title="Click to manage death saves">Death Saves ' + failures + '/3</span>';
    }

    const conditionBadges = participant.conditions
      .filter(c => this.getConditionName(c) !== 'unconscious')
      .map(c => {
        const name = this.getConditionName(c);
        const isCustom = this.isCustomCondition(c);
        // Special badge colors for death save conditions
        let badgeClass;
        if (name === 'Stabilized') {
          badgeClass = 'badge-stabilized';
        } else if (name === 'Dead') {
          badgeClass = 'badge-dead';
        } else {
          badgeClass = isCustom ? 'badge-info' : 'badge-warning';
        }
        const conditionJson = JSON.stringify(c).replace(/"/g, '&quot;');
        return `<span class="badge ${badgeClass} condition-badge" data-condition="${conditionJson}" data-init-id="${participant.id}">${name}</span>`;
      })
      .join('');

    const isRemoved = participant.is_removed_from_combat || false;
    const rowClass = `initiative-row ${isCurrent ? 'current-turn' : ''} ${isUnconscious ? 'unconscious' : ''} ${isRemoved ? 'removed-from-combat' : ''}`;

    return `
      <div class="${rowClass}" data-initiative-id="${participant.id}">
        <!-- Column 1: Turn Indicator -->
        <div class="turn-indicator">${participant.turn_order}</div>

        <!-- Column 2: Creature Information -->
        <div class="creature-info">
          <div class="creature-name">${participant.name}</div>
          <div class="creature-stats">
            <span class="creature-initiative">Init: ${participant.initiative}</span>
            <span class="creature-ac">AC ${participant.armor_class}</span>
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

        <!-- Column 4: Health Section + Menu -->
        <div class="health-section">
          <!-- Actions Menu (3-Dot) -->
          <div class="actions-menu admin-only">
            <button class="btn-icon menu-toggle" data-init-id="${participant.id}" title="Actions">⋮</button>
            <div class="dropdown-menu">
              <button class="dropdown-item toggle-remove-btn" data-init-id="${participant.id}" data-is-removed="${participant.is_removed_from_combat || false}">
                ${participant.is_removed_from_combat ? 'Re-add to Combat' : 'Remove from Combat'}
              </button>
              <button class="dropdown-item add-status-btn" data-init-id="${participant.id}">Manage Status Effects</button>
              <button class="dropdown-item add-temp-hp-btn" data-init-id="${participant.id}">Add Temporary HP</button>
            </div>
          </div>

          <!-- HP Display -->
          <div class="hp-display">${participant.current_hp} / ${participant.max_hp}</div>

          <!-- HP Bar -->
          <div class="hp-bar-container">
            <div class="${hpBarClass}" style="width: ${Math.max(0, hpPercentage)}%"></div>
          </div>

          <!-- HP Controls -->
          <div class="hp-controls admin-only">
            <input type="number" class="hp-input" placeholder="Amount" data-init-id="${participant.id}">
            <button class="btn btn-sm btn-danger hp-damage-btn" data-init-id="${participant.id}">−</button>
            <button class="btn btn-sm btn-success hp-heal-btn" data-init-id="${participant.id}">+</button>
          </div>
        </div>

        <!-- Actions Section (only show if participant has actions) -->
        ${this.renderActionsSection(participant)}
      </div>
    `;
  },

  renderActionsSection(participant) {
    // Only show actions for monsters that have actions defined
    if (!participant.actions || participant.actions.length === 0) {
      return '';
    }

    // Group actions by category
    const actionsByCategory = {
      action: [],
      legendary: [],
      special: [],
      reaction: []
    };

    participant.actions.forEach(action => {
      if (actionsByCategory[action.action_category]) {
        actionsByCategory[action.action_category].push(action);
      }
    });

    // Generate HTML for action items
    const actionItems = [];

    // Add regular actions first
    actionsByCategory.action.forEach(action => {
      actionItems.push(this.renderActionItem(action, 'Action'));
    });

    // Add legendary actions
    actionsByCategory.legendary.forEach(action => {
      actionItems.push(this.renderActionItem(action, 'Legendary'));
    });

    // Add special abilities
    actionsByCategory.special.forEach(action => {
      actionItems.push(this.renderActionItem(action, 'Special'));
    });

    // Add reactions
    actionsByCategory.reaction.forEach(action => {
      actionItems.push(this.renderActionItem(action, 'Reaction'));
    });

    return `
      <div class="actions-section">
        <div class="actions-header" data-init-id="${participant.id}">
          <span class="actions-header-text">Actions (${participant.actions.length})</span>
          <span class="actions-toggle">▼</span>
        </div>
        <div class="actions-content collapsed">
          ${actionItems.join('')}
        </div>
      </div>
    `;
  },

  renderActionItem(action, categoryLabel) {
    return `
      <div class="action-item">
        <div class="action-name">
          ${action.name}
          <span class="action-type">${categoryLabel}</span>
        </div>
        <div class="action-description">${action.description}</div>
      </div>
    `;
  },

  setupEventListeners() {
    // Next turn button
    const nextBtn = this.container.querySelector('#next-turn-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextTurn());
    }

    // End combat button
    const endBtn = this.container.querySelector('#end-combat-btn');
    if (endBtn) {
      endBtn.addEventListener('click', () => this.endCombat());
    }

    // HP damage buttons
    this.container.querySelectorAll('.hp-damage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const initId = e.target.getAttribute('data-init-id');
        const input = this.container.querySelector(`.hp-input[data-init-id="${initId}"]`);
        const amount = parseInt(input.value) || 0;
        if (amount > 0) {
          this.applyDamage(initId, amount);
          input.value = '';
        }
      });
    });

    // HP heal buttons
    this.container.querySelectorAll('.hp-heal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const initId = e.target.getAttribute('data-init-id');
        const input = this.container.querySelector(`.hp-input[data-init-id="${initId}"]`);
        const amount = parseInt(input.value) || 0;
        if (amount > 0) {
          this.applyHealing(initId, amount);
          input.value = '';
        }
      });
    });

    // Add status buttons
    this.container.querySelectorAll('.add-status-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const initId = e.target.getAttribute('data-init-id');
        // Close any open dropdowns
        this.container.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('show');
        });
        this.showAddStatusModal(initId);
      });
    });

    // Add temp HP buttons
    this.container.querySelectorAll('.add-temp-hp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const initId = e.target.getAttribute('data-init-id');
        // Close any open dropdowns
        this.container.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('show');
        });
        this.showAddTempHpModal(initId);
      });
    });

    // Toggle remove from combat buttons
    this.container.querySelectorAll('.toggle-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const initId = e.target.getAttribute('data-init-id');
        const isCurrentlyRemoved = e.target.getAttribute('data-is-removed') === 'true';

        // Close any open dropdowns
        this.container.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('show');
        });

        this.toggleRemoveFromCombat(initId, !isCurrentlyRemoved);
      });
    });

    // Dropdown menu toggles
    this.container.querySelectorAll('.menu-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = toggle.nextElementSibling;

        // Close all other dropdowns
        this.container.querySelectorAll('.dropdown-menu').forEach(menu => {
          if (menu !== dropdown) {
            menu.classList.remove('show');
          }
        });

        // Toggle this dropdown
        dropdown.classList.toggle('show');
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-menu')) {
        this.container.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });

    // Condition badge click handlers
    this.container.querySelectorAll('.condition-badge').forEach(badge => {
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
    this.container.querySelectorAll('.badge-death-saves').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const initId = e.target.getAttribute('data-init-id');
        this.showDeathSavesModal(initId);
      });
    });

    // Actions toggle handlers
    this.container.querySelectorAll('.actions-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const toggle = header.querySelector('.actions-toggle');
        const content = header.nextElementSibling;
        toggle.classList.toggle('expanded');
        content.classList.toggle('collapsed');
      });
    });
  },

  async showStartCombatModal() {
    // Get active players and monsters for this encounter
    let players = [];
    let monsters = [];

    try {
      const playersResponse = await API.players.getAll(this.currentEncounter.campaign_id);
      players = (playersResponse.data || []).filter(p => p.is_active);

      const monstersResponse = await API.monsters.getAll(this.currentEncounter.id);
      monsters = monstersResponse.data || [];
    } catch (error) {
      Components.showToast('Error loading participants: ' + error.message, 'error');
      return;
    }

    if (players.length === 0) {
      Components.showToast('No active players in campaign. Mark players as active first.', 'error');
      return;
    }

    if (monsters.length === 0) {
      Components.showToast('No monsters in encounter. Add monsters first.', 'error');
      return;
    }

    const playerInputs = players.map(p => `
      <div class="form-group player-init-row">
        <label>${p.character_name} (${p.initiative_bonus >= 0 ? '+' : ''}${p.initiative_bonus})</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="number"
                 class="form-control manual-init-input"
                 data-player-id="${p.id}"
                 data-bonus="${p.initiative_bonus}"
                 placeholder="Initiative total">
          <button type="button" class="btn btn-secondary roll-init-btn"
                  data-player-id="${p.id}"
                  data-bonus="${p.initiative_bonus}">
            Roll
          </button>
        </div>
      </div>
    `).join('');

    const content = `
      <form id="start-combat-form">
        <div class="form-group">
          <label>Encounter Settings</label>
          <div>
            <label style="display: block; margin-bottom: 0.5rem;">
              <input type="checkbox" name="start-with-full-health" checked>
              Start encounter with full health
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Initiative Mode</label>
          <div>
            <label style="display: block; margin-bottom: 0.5rem;">
              <input type="radio" name="init-mode" value="manual" checked>
              Manual Initiative (DM enters values)
            </label>
            <label style="display: block;">
              <input type="radio" name="init-mode" value="auto">
              Automatic Initiative (system rolls for all)
            </label>
          </div>
        </div>

        <div id="manual-init-section">
          <h4>Player Initiatives</h4>
          <p style="font-size: 0.9rem; color: #666;">Enter the total initiative for each player, or click "Roll" to roll automatically.</p>
          ${playerInputs}
        </div>
      </form>
    `;

    const actions = [
      {
        id: 'cancel',
        label: 'Cancel',
        class: 'btn-secondary',
        handler: () => {}
      },
      {
        id: 'start',
        label: 'Start Combat',
        class: 'btn-success',
        handler: () => this.handleStartCombat(),
        closeOnClick: false
      }
    ];

    Components.showModal('Start Combat', content, actions);

    // Set up mode toggle
    const form = document.getElementById('start-combat-form');
    const manualSection = document.getElementById('manual-init-section');
    const modeRadios = form.querySelectorAll('input[name="init-mode"]');

    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        manualSection.style.display = e.target.value === 'manual' ? 'block' : 'none';
      });
    });

    // Set up roll buttons
    document.querySelectorAll('.roll-init-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerId = e.target.getAttribute('data-player-id');
        const bonus = parseInt(e.target.getAttribute('data-bonus')) || 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + bonus;

        const input = document.querySelector(`.manual-init-input[data-player-id="${playerId}"]`);
        if (input) {
          input.value = total;
        }
      });
    });
  },

  async handleStartCombat() {
    const form = document.getElementById('start-combat-form');
    const mode = form.querySelector('input[name="init-mode"]:checked').value;
    const startWithFullHealth = form.querySelector('input[name="start-with-full-health"]').checked;

    let manualInitiatives = [];

    if (mode === 'manual') {
      // Collect manual initiatives
      const inputs = form.querySelectorAll('.manual-init-input');
      for (const input of inputs) {
        const initiative = parseInt(input.value);
        if (isNaN(initiative) || initiative === '') {
          Components.showToast('Please enter initiative for all players', 'error');
          return;
        }

        manualInitiatives.push({
          participant_type: 'player',
          participant_id: parseInt(input.getAttribute('data-player-id')),
          initiative: initiative
        });
      }
    }

    try {
      // Close modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) modal.remove();

      // Show loading
      Components.showSpinner(this.container);

      // Start combat
      await API.combat.startCombat(this.currentEncounter.id, mode, manualInitiatives, startWithFullHealth);

      // Reload initiative data
      await this.loadInitiative();

      // Re-render
      this.render();

      Components.showToast('Combat started!', 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error starting combat: ' + error.message, 'error');
    }
  },

  async nextTurn() {
    try {
      Components.showSpinner(this.container);

      await API.combat.nextTurn(this.currentEncounter.id);
      await this.loadInitiative();

      this.render();

      Components.showToast('Turn advanced', 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error advancing turn: ' + error.message, 'error');
    }
  },

  async applyDamage(initiativeId, amount) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const newHp = Math.max(participant.current_hp - amount, 0);
    await this.updateHealth(initiativeId, newHp);
  },

  async applyHealing(initiativeId, amount) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const newHp = Math.min(participant.current_hp + amount, participant.max_hp);
    await this.updateHealth(initiativeId, newHp);
  },

  async updateHealth(initiativeId, newHp) {
    try {
      await API.combat.updateHealth(initiativeId, newHp);
      await this.loadInitiative();
      this.render();
    } catch (error) {
      Components.showToast('Error updating health: ' + error.message, 'error');
    }
  },

  async endCombat() {
    // Determine if all monsters are defeated (health = 0)
    const allMonstersDefeated = this.initiativeData.participants
      .filter(p => p.participant_type === 'monster')
      .every(p => p.current_hp === 0);

    // Create modal content with checkbox
    const content = `
      <p>Are you sure you want to end combat? This will clear the initiative tracker.</p>
      <div class="form-group" style="margin-top: 1rem;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="mark-complete-checkbox" ${allMonstersDefeated ? 'checked' : ''}>
          <span>Encounter is completed</span>
        </label>
      </div>
    `;

    const result = await new Promise((resolve) => {
      Components.showModal(
        'End Combat',
        content,
        [
          {
            id: 'cancel',
            label: 'Cancel',
            class: 'btn-secondary',
            handler: () => resolve(null)
          },
          {
            id: 'confirm',
            label: 'End Combat',
            class: 'btn-danger',
            handler: () => {
              const checkbox = document.getElementById('mark-complete-checkbox');
              resolve(checkbox ? checkbox.checked : false);
            }
          }
        ]
      );
    });

    // User cancelled
    if (result === null) return;

    try {
      Components.showSpinner(this.container);

      await API.combat.endCombat(this.currentEncounter.id, result);

      // Reload encounter status
      await this.loadActiveEncounter();

      this.render();

      Components.showToast('Combat ended', 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error ending combat: ' + error.message, 'error');
    }
  },

  async showAddTempHpModal(initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const currentTempHp = participant.temp_hp || 0;

    const content = `
      <form id="add-temp-hp-form">
        <div class="form-group">
          <label>Current Temporary HP: ${currentTempHp}</label>
        </div>
        <div class="form-group">
          <label>Add Temporary HP</label>
          <input type="number"
                 class="form-control"
                 id="temp-hp-amount"
                 min="1"
                 placeholder="Amount to add"
                 value="">
          <small class="form-text">This will be added to existing temporary HP</small>
        </div>
      </form>
    `;

    const actions = [
      {
        id: 'cancel',
        label: 'Cancel',
        class: 'btn-secondary',
        handler: () => {}
      },
      {
        id: 'add',
        label: 'Add Temp HP',
        class: 'btn-primary',
        handler: () => this.handleAddTempHp(initiativeId),
        closeOnClick: false
      }
    ];

    Components.showModal('Add Temporary HP', content, actions);

    // Focus the input
    setTimeout(() => {
      const input = document.getElementById('temp-hp-amount');
      if (input) input.focus();
    }, 100);
  },

  async handleAddTempHp(initiativeId) {
    const input = document.getElementById('temp-hp-amount');
    const amount = parseInt(input.value);

    if (!amount || amount <= 0) {
      Components.showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      // Close modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) modal.remove();

      // Show loading
      Components.showSpinner(this.container);

      // Update via API
      await API.combat.updateTempHp(initiativeId, amount);

      // Reload initiative
      await this.loadInitiative();
      this.render();

      Components.showToast(`Added ${amount} temporary HP`, 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error adding temporary HP: ' + error.message, 'error');
    }
  },

  async showDeathSavesModal(initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const successes = participant.death_save_successes || 0;
    const failures = participant.death_save_failures || 0;

    const content = `
      <div class="death-save-roll-section">
        <div class="roll-display">
          <button type="button" class="btn btn-secondary" id="roll-d20-btn">Roll d20</button>
          <input type="number" id="roll-result" class="form-control" readonly placeholder="Click Roll">
        </div>
      </div>

      <div class="death-saves-tracker">
        <div class="death-saves-column">
          <div class="death-saves-section">
            <h4>Failures</h4>
            <div class="death-save-pips">
              <span class="death-save-pip ${failures >= 1 ? 'filled failure' : ''}"></span>
              <span class="death-save-pip ${failures >= 2 ? 'filled failure' : ''}"></span>
              <span class="death-save-pip ${failures >= 3 ? 'filled failure' : ''}"></span>
            </div>
            <div class="death-save-count">${failures} / 3</div>
          </div>
          <button type="button" class="btn btn-danger btn-block" id="fail-btn">Fail</button>
        </div>

        <div class="death-saves-column">
          <div class="death-saves-section">
            <h4>Successes</h4>
            <div class="death-save-pips">
              <span class="death-save-pip ${successes >= 1 ? 'filled success' : ''}"></span>
              <span class="death-save-pip ${successes >= 2 ? 'filled success' : ''}"></span>
              <span class="death-save-pip ${successes >= 3 ? 'filled success' : ''}"></span>
            </div>
            <div class="death-save-count">${successes} / 3</div>
          </div>
          <button type="button" class="btn btn-success btn-block" id="pass-btn">Pass</button>
        </div>
      </div>

      <div class="death-save-instant-actions">
        <button type="button" class="btn btn-instant-death" id="instant-death-btn">Instant Death</button>
        <button type="button" class="btn btn-instant-revival" id="instant-revival-btn">Instant Revival</button>
      </div>
    `;

    Components.showModal('Death Saves - ' + participant.name, content, [
      { id: 'close', label: 'Close', class: 'btn-secondary', handler: () => {} }
    ]);

    // Setup roll button (d20 simulation)
    document.getElementById('roll-d20-btn').addEventListener('click', () => {
      const roll = Math.floor(Math.random() * 20) + 1;
      document.getElementById('roll-result').value = roll;
    });

    // Setup pass button
    document.getElementById('pass-btn').addEventListener('click', async () => {
      await this.handleDeathSaveUpdate(initiativeId, Math.min(successes + 1, 3), failures);
    });

    // Setup fail button
    document.getElementById('fail-btn').addEventListener('click', async () => {
      await this.handleDeathSaveUpdate(initiativeId, successes, Math.min(failures + 1, 3));
    });

    // Setup instant death button
    document.getElementById('instant-death-btn').addEventListener('click', async () => {
      await this.handleDeathSaveUpdate(initiativeId, successes, 3);
    });

    // Setup instant revival button
    document.getElementById('instant-revival-btn').addEventListener('click', async () => {
      await this.handleInstantRevival(initiativeId);
    });
  },

  async handleDeathSaveUpdate(initiativeId, successes, failures) {
    try {
      document.querySelector('.modal-overlay')?.remove();
      Components.showSpinner(this.container);

      await API.combat.updateDeathSaves(initiativeId, successes, failures);
      await this.loadInitiative();
      this.render();

      if (successes >= 3) {
        Components.showToast('Player stabilized! Gained 1 HP.', 'success');
      } else if (failures >= 3) {
        Components.showToast('Player has died and been removed from combat.', 'info');
      } else {
        Components.showToast('Death save updated', 'success');
      }
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error: ' + error.message, 'error');
    }
  },

  async handleInstantRevival(initiativeId) {
    try {
      document.querySelector('.modal-overlay')?.remove();
      Components.showSpinner(this.container);

      const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
      if (!participant) {
        throw new Error('Participant not found');
      }

      // Heal by 1 HP (backend will handle clearing death saves)
      await this.updateHealth(initiativeId, 1);

      Components.showToast('Player revived and ready to return to combat!', 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error: ' + error.message, 'error');
    }
  },

  async showAddStatusModal(initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    // Build standard conditions list
    const standardConditionsList = Object.keys(DND_CONDITIONS)
      .sort()
      .map(key => {
        const alreadyHas = this.hasCondition(participant.conditions, key);
        const checkedAttr = alreadyHas ? 'checked' : '';
        return `
          <label class="condition-option">
            <input type="checkbox"
                   name="standard-condition"
                   value="${key}"
                   ${checkedAttr}>
            <span class="condition-name">${DND_CONDITIONS[key].name}</span>
          </label>
        `;
      }).join('');

    // Build existing custom conditions list
    const existingCustomConditions = participant.conditions
      .filter(c => this.isCustomCondition(c))
      .map(c => {
        const conditionJson = JSON.stringify(c).replace(/"/g, '&quot;');
        return `
          <div class="existing-custom-condition">
            <div class="custom-condition-info">
              <strong>${this.getConditionName(c)}</strong>
              <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: #666;">${c.description}</p>
            </div>
            <button type="button"
                    class="btn btn-sm btn-danger remove-custom-condition-btn"
                    data-condition="${conditionJson}">
              Remove
            </button>
          </div>
        `;
      }).join('');

    const existingCustomSection = existingCustomConditions ? `
      <div class="form-group">
        <label>Existing Custom Status Effects</label>
        <div class="existing-custom-conditions-list">
          ${existingCustomConditions}
        </div>
      </div>
    ` : '';

    const content = `
      <div class="tabs-container">
        <div class="tabs-header">
          <button type="button" class="tab-btn active" data-tab="standard">Standard Conditions</button>
          <button type="button" class="tab-btn" data-tab="custom">Custom Status Effects</button>
        </div>

        <form id="manage-status-form">
          <div class="tab-content active" data-tab-content="standard">
            <div class="form-group">
              <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                Check or uncheck conditions to add or remove them.
              </p>
              <div class="conditions-list">
                ${standardConditionsList}
              </div>
            </div>
          </div>

          <div class="tab-content" data-tab-content="custom">
            ${existingCustomSection}

            <div class="form-group">
              <label>Add New Custom Status Effect</label>
              <div class="form-group">
                <label>Name</label>
                <input type="text"
                       class="form-control"
                       id="custom-condition-name"
                       placeholder="e.g., Hex, Hunter's Mark">
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea class="form-control"
                          id="custom-condition-description"
                          rows="3"
                          placeholder="Describe the effect..."></textarea>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    const actions = [
      {
        id: 'cancel',
        label: 'Cancel',
        class: 'btn-secondary',
        handler: () => {}
      },
      {
        id: 'save',
        label: 'Save',
        class: 'btn-primary',
        handler: () => this.handleManageStatus(initiativeId),
        closeOnClick: false
      }
    ];

    Components.showModal('Manage Status Effects', content, actions);

    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.target.getAttribute('data-tab');

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector(`[data-tab-content="${targetTab}"]`).classList.add('active');
      });
    });

    // Setup remove buttons for existing custom conditions
    document.querySelectorAll('.remove-custom-condition-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.existing-custom-condition').remove();
      });
    });
  },

  async handleAddStatus(initiativeId) {
    // Redirect to new handler
    return this.handleManageStatus(initiativeId);
  },

  async handleManageStatus(initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const form = document.getElementById('manage-status-form');
    const newConditions = [];

    // Process standard conditions (add checked ones, remove unchecked ones)
    const selectedStandard = Array.from(form.querySelectorAll('input[name="standard-condition"]:checked'))
      .map(input => input.value);

    // Add all checked standard conditions
    newConditions.push(...selectedStandard);

    // Process existing custom conditions (keep ones that weren't removed)
    const existingCustomConditions = participant.conditions.filter(c => this.isCustomCondition(c));
    const remainingCustomConditions = existingCustomConditions.filter(existing => {
      // Check if this condition still exists in the DOM (wasn't removed)
      const conditionJson = JSON.stringify(existing).replace(/"/g, '&quot;');
      return document.querySelector(`.remove-custom-condition-btn[data-condition="${conditionJson}"]`) !== null;
    });

    newConditions.push(...remainingCustomConditions);

    // Check for new custom condition
    const customName = document.getElementById('custom-condition-name').value.trim();
    const customDesc = document.getElementById('custom-condition-description').value.trim();

    if (customName || customDesc) {
      if (!customName) {
        Components.showToast('Please enter a name for the custom status', 'error');
        return;
      }

      if (!customDesc) {
        Components.showToast('Please enter a description for the custom status', 'error');
        return;
      }

      // Check if custom condition with same name already exists
      if (this.hasCondition(newConditions, customName)) {
        Components.showToast(`Status "${customName}" already exists`, 'error');
        return;
      }

      newConditions.push({
        name: customName,
        description: customDesc,
        type: 'custom'
      });
    }

    try {
      // Close modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) modal.remove();

      // Show loading
      Components.showSpinner(this.container);

      // Update via API
      await API.combat.updateConditions(initiativeId, newConditions);

      // Reload initiative
      await this.loadInitiative();
      this.render();

      Components.showToast('Status effects updated', 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error updating status: ' + error.message, 'error');
    }
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

  async handleRemoveCondition(initiativeId, conditionName) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    // Filter out the condition (handles both string and object forms)
    const newConditions = participant.conditions.filter(c =>
      this.getConditionName(c) !== conditionName
    );

    try {
      // Close modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) modal.remove();

      // Show loading
      Components.showSpinner(this.container);

      // Update via API
      await API.combat.updateConditions(initiativeId, newConditions);

      // Reload initiative
      await this.loadInitiative();
      this.render();

      Components.showToast(`Removed "${conditionName}" status`, 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error removing status: ' + error.message, 'error');
    }
  },

  async toggleRemoveFromCombat(initiativeId, shouldRemove) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const action = shouldRemove ? 'removed from' : 're-added to';

    try {
      Components.showSpinner(this.container);

      // Update via API
      await API.combat.toggleRemoveFromCombat(initiativeId, shouldRemove);

      // Reload initiative (will automatically advance turn if needed)
      await this.loadInitiative();
      this.render();

      Components.showToast(`${participant.name} ${action} combat`, 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast(`Error: ${error.message}`, 'error');
    }
  }
};
