// Player Management
const Players = {
  currentPlayers: [],
  currentCampaigns: [],
  selectedCampaignId: null,

  async init() {
    await this.loadCampaigns();
    await this.loadPlayers();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const newPlayerBtn = document.getElementById('new-player-btn');
    if (newPlayerBtn) {
      newPlayerBtn.addEventListener('click', () => {
        this.showPlayerModal();
      });
    }

    const campaignFilter = document.getElementById('player-campaign-filter');
    if (campaignFilter) {
      campaignFilter.addEventListener('change', (e) => {
        this.selectedCampaignId = e.target.value;
        this.loadPlayers();
      });
    }
  },

  async loadCampaigns() {
    try {
      const response = await API.campaigns.getAll();
      this.currentCampaigns = response.data || [];
      this.renderCampaignFilter();
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  },

  renderCampaignFilter() {
    const filterSelect = document.getElementById('player-campaign-filter');
    if (!filterSelect) return;

    const options = this.currentCampaigns.map(c =>
      `<option value="${c.id}" ${this.selectedCampaignId == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    filterSelect.innerHTML = `
      <option value="">All Campaigns</option>
      ${options}
    `;
  },

  async loadPlayers() {
    const listContainer = document.getElementById('players-list');
    if (!listContainer) return;

    Components.showSpinner(listContainer);

    try {
      const response = await API.players.getAll(this.selectedCampaignId);
      this.currentPlayers = response.data || [];
      this.renderPlayers();
    } catch (error) {
      Components.showToast(error.message || 'Failed to load players', 'error');
      listContainer.innerHTML = Components.createAlert(
        'Failed to load players. Please try again.',
        'error'
      ).outerHTML;
    } finally {
      Components.hideSpinner(listContainer);
    }
  },

  renderPlayers() {
    const listContainer = document.getElementById('players-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (this.currentPlayers.length === 0) {
      const alert = Components.createAlert(
        'No players yet. Create your first character to get started!',
        'info'
      );
      listContainer.appendChild(alert);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'player-grid';

    this.currentPlayers.forEach(player => {
      const card = this.createPlayerCard(player);
      grid.appendChild(card);
    });

    listContainer.appendChild(grid);
  },

  createPlayerCard(player) {
    const levelBadge = Components.createBadge(`Lvl ${player.level}`, 'info');
    const classBadge = player.character_class
      ? Components.createBadge(player.character_class, 'secondary')
      : '';

    const content = `
      <div class="player-class-info">
        ${levelBadge.outerHTML}
        ${classBadge ? classBadge.outerHTML : ''}
      </div>
      <div class="player-stats">
        <div class="player-stat">
          <strong>HP:</strong>
          <span>${player.max_hp}</span>
        </div>
        <div class="player-stat">
          <strong>AC:</strong>
          <span>${player.armor_class}</span>
        </div>
        <div class="player-stat">
          <strong>Speed:</strong>
          <span>${player.speed} ft</span>
        </div>
        <div class="player-stat">
          <strong>Initiative:</strong>
          <span>${player.initiative_bonus >= 0 ? '+' : ''}${player.initiative_bonus}</span>
        </div>
      </div>
      ${player.notes ? `<p class="player-notes">${player.notes}</p>` : ''}
      <p class="player-meta">
        <small>Campaign: ${player.campaign_name || 'Unknown'}</small>
      </p>
    `;

    const footer = document.createElement('div');
    footer.className = 'card-actions';

    if (Auth.isAdmin()) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.showPlayerModal(player));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.deletePlayer(player.id));

      footer.appendChild(editBtn);
      footer.appendChild(deleteBtn);
    }

    return Components.createCard(player.character_name, content, footer);
  },

  showPlayerModal(player = null) {
    const isEdit = !!player;
    const title = isEdit ? 'Edit Character' : 'New Character';

    const campaignOptions = this.currentCampaigns.map(c =>
      `<option value="${c.id}" ${player && player.campaign_id === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const content = `
      <form id="player-form" onsubmit="return false;">
        <div class="form-group">
          <label for="player-campaign">Campaign *</label>
          <select id="player-campaign" class="form-control" required ${isEdit ? 'disabled' : ''}>
            <option value="">Select a campaign</option>
            ${campaignOptions}
          </select>
          ${isEdit ? `<input type="hidden" id="player-campaign-hidden" value="${player.campaign_id}">` : ''}
        </div>
        <div class="form-group">
          <label for="player-name">Character Name *</label>
          <input
            type="text"
            id="player-name"
            class="form-control"
            value="${player ? player.character_name : ''}"
            required
          >
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="player-class">Class</label>
            <input
              type="text"
              id="player-class"
              class="form-control"
              value="${player ? (player.character_class || '') : ''}"
              placeholder="e.g., Fighter, Wizard"
            >
          </div>
          <div class="form-group">
            <label for="player-level">Level</label>
            <input
              type="number"
              id="player-level"
              class="form-control"
              value="${player ? player.level : 1}"
              min="1"
              max="20"
            >
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="player-max-hp">Max HP *</label>
            <input
              type="number"
              id="player-max-hp"
              class="form-control"
              value="${player ? player.max_hp : ''}"
              min="1"
              required
            >
          </div>
          <div class="form-group">
            <label for="player-ac">Armor Class *</label>
            <input
              type="number"
              id="player-ac"
              class="form-control"
              value="${player ? player.armor_class : ''}"
              min="0"
              required
            >
          </div>
          <div class="form-group">
            <label for="player-speed">Speed (ft)</label>
            <input
              type="number"
              id="player-speed"
              class="form-control"
              value="${player ? player.speed : 30}"
              min="0"
            >
          </div>
          <div class="form-group">
            <label for="player-initiative">Initiative Bonus</label>
            <input
              type="number"
              id="player-initiative"
              class="form-control"
              value="${player ? player.initiative_bonus : 0}"
            >
          </div>
        </div>
        <div class="form-group">
          <label for="player-notes">Notes</label>
          <textarea
            id="player-notes"
            class="form-control"
            rows="3"
            placeholder="Background, personality, equipment, etc."
          >${player ? (player.notes || '') : ''}</textarea>
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
        id: 'save',
        label: isEdit ? 'Update' : 'Create',
        class: 'btn-primary',
        handler: () => this.savePlayer(player?.id),
        closeOnClick: false
      }
    ];

    Components.showModal(title, content, actions);
  },

  async savePlayer(playerId = null) {
    const campaignInput = document.getElementById('player-campaign');
    const campaignHiddenInput = document.getElementById('player-campaign-hidden');
    const nameInput = document.getElementById('player-name');
    const classInput = document.getElementById('player-class');
    const levelInput = document.getElementById('player-level');
    const maxHpInput = document.getElementById('player-max-hp');
    const acInput = document.getElementById('player-ac');
    const speedInput = document.getElementById('player-speed');
    const initiativeInput = document.getElementById('player-initiative');
    const notesInput = document.getElementById('player-notes');

    const campaign_id = campaignHiddenInput ? campaignHiddenInput.value : campaignInput.value;
    const character_name = nameInput.value.trim();
    const character_class = classInput.value.trim();
    const level = parseInt(levelInput.value);
    const max_hp = parseInt(maxHpInput.value);
    const armor_class = parseInt(acInput.value);
    const speed = parseInt(speedInput.value);
    const initiative_bonus = parseInt(initiativeInput.value);
    const notes = notesInput.value.trim();

    if (!character_name) {
      Components.showToast('Character name is required', 'error');
      return;
    }

    if (!campaign_id) {
      Components.showToast('Please select a campaign', 'error');
      return;
    }

    if (isNaN(max_hp) || max_hp < 1) {
      Components.showToast('Max HP must be at least 1', 'error');
      return;
    }

    if (isNaN(armor_class) || armor_class < 0) {
      Components.showToast('Armor class must be non-negative', 'error');
      return;
    }

    const data = {
      campaign_id,
      character_name,
      character_class: character_class || null,
      level: !isNaN(level) ? level : 1,
      max_hp,
      current_hp: max_hp,
      armor_class,
      speed: !isNaN(speed) ? speed : 30,
      initiative_bonus: !isNaN(initiative_bonus) ? initiative_bonus : 0,
      notes: notes || ''
    };

    try {
      if (playerId) {
        await API.players.update(playerId, data);
        Components.showToast('Player updated successfully', 'success');
      } else {
        await API.players.create(data);
        Components.showToast('Player created successfully', 'success');
      }

      document.querySelector('.modal-overlay').remove();
      await this.loadPlayers();
    } catch (error) {
      Components.showToast(error.message || 'Failed to save player', 'error');
    }
  },

  async deletePlayer(playerId) {
    Components.confirm(
      'Are you sure you want to delete this player character?',
      async () => {
        try {
          await API.players.delete(playerId);
          Components.showToast('Player deleted successfully', 'success');
          await this.loadPlayers();
        } catch (error) {
          Components.showToast(error.message || 'Failed to delete player', 'error');
        }
      }
    );
  }
};

// Initialize players when the players page is shown
document.addEventListener('DOMContentLoaded', () => {
  const playersPage = document.getElementById('players-page');
  if (playersPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (playersPage.classList.contains('active')) {
            Players.init();
          }
        }
      });
    });

    observer.observe(playersPage, { attributes: true });
  }
});
