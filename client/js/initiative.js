// Initiative Tracker Module
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
    const isUnconscious = participant.conditions.includes('unconscious');
    const isCurrent = participant.is_current_turn;

    let hpBarClass = 'hp-bar-fill';
    if (hpPercentage > 75) {
      hpBarClass += ' hp-healthy';
    } else if (hpPercentage > 25) {
      hpBarClass += ' hp-warning';
    } else {
      hpBarClass += ' hp-danger';
    }

    const unconsciousBadge = isUnconscious ?
      '<span class="badge badge-danger">Unconscious</span>' : '';

    const conditionBadges = participant.conditions
      .filter(c => c !== 'unconscious')
      .map(c => `<span class="badge badge-warning">${c}</span>`)
      .join('');

    const rowClass = `initiative-row ${isCurrent ? 'current-turn' : ''} ${isUnconscious ? 'unconscious' : ''}`;

    return `
      <div class="${rowClass}" data-initiative-id="${participant.id}">
        <div class="turn-indicator">${participant.turn_order}</div>
        <div class="participant-name">${participant.name}</div>
        <div class="initiative-value">${participant.initiative}</div>
        <div class="health-section">
          <div class="hp-display">${participant.current_hp} / ${participant.max_hp}</div>
          <div class="hp-bar-container">
            <div class="${hpBarClass}" style="width: ${Math.max(0, hpPercentage)}%"></div>
          </div>
          <div class="hp-controls admin-only">
            <input type="number" class="hp-input" placeholder="Amount" data-init-id="${participant.id}">
            <button class="btn btn-sm btn-danger hp-damage-btn" data-init-id="${participant.id}">−</button>
            <button class="btn btn-sm btn-success hp-heal-btn" data-init-id="${participant.id}">+</button>
          </div>
        </div>
        <div class="participant-ac">AC ${participant.armor_class}</div>
        <div class="conditions-badges">
          ${unconsciousBadge}
          ${conditionBadges}
        </div>
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
  }
};
