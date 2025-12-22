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

  renderNoActiveEncounter() {
    this.container.innerHTML = `
      <div class="no-active-encounter">
        <div class="alert alert-info">
          <p>No active encounter. Start an encounter to begin combat tracking.</p>
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

    const conditionBadges = participant.conditions
      .filter(c => this.getConditionName(c) !== 'unconscious')
      .map(c => {
        const name = this.getConditionName(c);
        const isCustom = this.isCustomCondition(c);
        const badgeClass = isCustom ? 'badge-info' : 'badge-warning';
        const conditionJson = JSON.stringify(c).replace(/"/g, '&quot;');
        return `<span class="badge ${badgeClass} condition-badge" data-condition='${conditionJson}' data-init-id="${participant.id}">${name}</span>`;
      })
      .join('');

    const rowClass = `initiative-row ${isCurrent ? 'current-turn' : ''} ${isUnconscious ? 'unconscious' : ''}`;

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
              <button class="dropdown-item add-status-btn" data-init-id="${participant.id}">Add Status Effect</button>
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
        const conditionData = e.target.getAttribute('data-condition');
        const initId = e.target.getAttribute('data-init-id');

        let condition;
        try {
          condition = JSON.parse(conditionData);
        } catch {
          condition = conditionData; // Simple string
        }

        this.showConditionDetailModal(condition, initId);
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
      await API.combat.startCombat(this.currentEncounter.id, mode, manualInitiatives);

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
    const confirmed = await Components.confirm(
      'Are you sure you want to end combat? This will clear the initiative tracker.'
    );

    if (!confirmed) return;

    try {
      Components.showSpinner(this.container);

      await API.combat.endCombat(this.currentEncounter.id);

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

  async showAddStatusModal(initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    // Build standard conditions list
    const standardConditionsList = Object.keys(DND_CONDITIONS)
      .sort()
      .map(key => {
        const alreadyHas = this.hasCondition(participant.conditions, key);
        const disabledAttr = alreadyHas ? 'disabled' : '';
        const checkedAttr = alreadyHas ? 'checked' : '';
        return `
          <label class="condition-option ${alreadyHas ? 'disabled' : ''}">
            <input type="checkbox"
                   name="standard-condition"
                   value="${key}"
                   ${disabledAttr}
                   ${checkedAttr}>
            <span class="condition-name">${DND_CONDITIONS[key].name}</span>
          </label>
        `;
      }).join('');

    const content = `
      <form id="add-status-form">
        <div class="form-group">
          <h4>Standard D&D 5e Conditions</h4>
          <div class="conditions-list">
            ${standardConditionsList}
          </div>
        </div>

        <div class="form-group">
          <h4>Custom Status Effect</h4>
          <label>
            <input type="checkbox" id="custom-condition-toggle"> Add custom status
          </label>
          <div id="custom-condition-fields" style="display: none; margin-top: 1rem;">
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
        label: 'Add Status',
        class: 'btn-primary',
        handler: () => this.handleAddStatus(initiativeId),
        closeOnClick: false
      }
    ];

    Components.showModal('Add Status Effect', content, actions);

    // Setup custom condition toggle
    document.getElementById('custom-condition-toggle').addEventListener('change', (e) => {
      document.getElementById('custom-condition-fields').style.display =
        e.target.checked ? 'block' : 'none';
    });
  },

  async handleAddStatus(initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const form = document.getElementById('add-status-form');
    const newConditions = [...participant.conditions];

    // Collect selected standard conditions
    const selectedStandard = Array.from(form.querySelectorAll('input[name="standard-condition"]:checked'))
      .map(input => input.value)
      .filter(val => !this.hasCondition(newConditions, val)); // Don't add duplicates

    newConditions.push(...selectedStandard);

    // Check for custom condition
    const customToggle = document.getElementById('custom-condition-toggle');
    if (customToggle.checked) {
      const customName = document.getElementById('custom-condition-name').value.trim();
      const customDesc = document.getElementById('custom-condition-description').value.trim();

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

    // Validate at least one condition was added
    if (newConditions.length === participant.conditions.length) {
      Components.showToast('Please select at least one status effect', 'error');
      return;
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

      const addedCount = newConditions.length - participant.conditions.length;
      Components.showToast(`Added ${addedCount} status effect(s)`, 'success');
    } catch (error) {
      Components.hideSpinner(this.container);
      Components.showToast('Error adding status: ' + error.message, 'error');
    }
  },

  async showConditionDetailModal(condition, initiativeId) {
    const participant = this.initiativeData.participants.find(p => p.id == initiativeId);
    if (!participant) return;

    const conditionName = this.getConditionName(condition);
    const conditionDesc = this.getConditionDescription(condition);
    const isCustom = this.isCustomCondition(condition);

    // Special handling for unconscious
    const isUnconscious = conditionName === 'unconscious';
    const warningText = isUnconscious ?
      '<p class="alert alert-warning" style="margin-top: 1rem;"><strong>Note:</strong> The unconscious condition is automatically managed based on HP. Removing it manually will be overridden if HP is still 0 or below.</p>' : '';

    const content = `
      <div class="condition-detail">
        <h4>${conditionName} ${isCustom ? '<span class="badge badge-info">Custom</span>' : ''}</h4>
        <p style="white-space: pre-wrap; margin-top: 1rem;">${conditionDesc}</p>
        ${warningText}
      </div>
    `;

    const actions = [
      {
        id: 'close',
        label: 'Close',
        class: 'btn-secondary',
        handler: () => {}
      },
      {
        id: 'remove',
        label: 'Remove Status',
        class: 'btn-danger',
        handler: () => this.handleRemoveCondition(initiativeId, conditionName),
        closeOnClick: false
      }
    ];

    Components.showModal('Status Effect Details', content, actions);
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
  }
};
