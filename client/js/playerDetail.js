// Player Detail Page Module
const PlayerDetail = {
  currentPlayer: null,
  originalPlayerData: null,
  isEditMode: false,

  async init(playerId) {
    this.currentPlayer = null;
    this.originalPlayerData = null;
    this.isEditMode = false;

    await this.loadPlayer(playerId);
    this.setupEventListeners();
  },

  setupEventListeners() {
    const backBtn = document.getElementById('player-detail-back-btn');

    if (backBtn) {
      backBtn.onclick = () => {
        if (this.isEditMode) {
          Components.confirm('Discard unsaved changes?', () => {
            this.navigateBack();
          });
        } else {
          this.navigateBack();
        }
      };
    }

    // Set up edit/save/cancel buttons
    this.setupActionButtons();
  },

  setupActionButtons() {
    const editBtn = document.getElementById('player-edit-toggle-btn');
    const cancelBtn = document.getElementById('player-detail-cancel-btn');
    const saveBtn = document.getElementById('player-detail-save-btn');

    if (editBtn) {
      editBtn.onclick = () => this.toggleEditMode();
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelEdit();
    }

    if (saveBtn) {
      saveBtn.onclick = () => this.saveChanges();
    }
  },

  navigateBack() {
    App.showPage('players-page');
  },

  async loadPlayer(playerId) {
    const contentEl = document.getElementById('player-detail-content');

    try {
      Components.showSpinner(contentEl);

      const response = await API.players.getById(playerId);
      this.currentPlayer = response.data;
      this.originalPlayerData = JSON.parse(JSON.stringify(response.data));

      this.render();

      // Show edit button if admin
      if (Auth.isAdmin()) {
        this.showViewModeButtons();
      }
    } catch (error) {
      Components.hideSpinner(contentEl);

      if (error.message.includes('not found')) {
        contentEl.innerHTML = Components.createAlert(
          'This player has been deleted or you do not have permission to view it.',
          'error'
        ).outerHTML;

        setTimeout(() => {
          this.navigateBack();
        }, 2000);
      } else {
        contentEl.innerHTML = Components.createAlert(
          error.message || 'Failed to load player',
          'error'
        ).outerHTML;
      }
    }
  },

  render() {
    const titleEl = document.getElementById('player-detail-page-title');
    const contentEl = document.getElementById('player-detail-content');

    if (!this.currentPlayer) return;

    titleEl.textContent = this.currentPlayer.character_name;

    if (this.isEditMode) {
      this.renderEditMode();
    } else {
      this.renderViewMode();
    }

    Components.hideSpinner(contentEl);
  },

  renderViewMode() {
    const contentEl = document.getElementById('player-detail-content');
    const p = this.currentPlayer;

    // Breadcrumb navigation
    const breadcrumb = `
      <div class="breadcrumb">
        <span>${p.campaign_name || 'Campaign'}</span>
        <i class="fas fa-chevron-right"></i>
        <span>Players</span>
        <i class="fas fa-chevron-right"></i>
        <span>${p.character_name}</span>
      </div>
    `;

    // Core stats section
    const hpBadge = this.getHPBadge(p);
    const initiativeDisplay = p.initiative_bonus >= 0 ? `+${p.initiative_bonus}` : `${p.initiative_bonus}`;
    const statusIcon = p.is_active
      ? '<i class="fas fa-check success-text"></i> Active'
      : '<i class="fas fa-times danger-text"></i> Inactive';

    const coreStatsSection = `
      <div class="detail-section">
        <h3>Character Information</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <label>Character Class</label>
            <div class="stat-value">${p.character_class || 'N/A'}</div>
          </div>
          <div class="stat-item">
            <label>Level</label>
            <div class="stat-value">${p.level}</div>
          </div>
          <div class="stat-item">
            <label>Hit Points</label>
            <div class="stat-value">
              <span class="hp-display">${p.current_hp} / ${p.max_hp}</span>
              ${hpBadge.outerHTML}
            </div>
          </div>
          <div class="stat-item">
            <label>Armor Class</label>
            <div class="stat-value">${p.armor_class}</div>
          </div>
          <div class="stat-item">
            <label>Speed</label>
            <div class="stat-value">${p.speed} ft</div>
          </div>
          <div class="stat-item">
            <label>Initiative Bonus</label>
            <div class="stat-value">${initiativeDisplay}</div>
          </div>
          <div class="stat-item">
            <label>Status</label>
            <div class="stat-value">${statusIcon}</div>
          </div>
        </div>
        ${p.notes ? `
          <div class="stat-item full-width" style="margin-top: 1rem;">
            <label>Notes</label>
            <div class="stat-value notes-display">${p.notes}</div>
          </div>
        ` : ''}
      </div>
    `;

    contentEl.innerHTML = breadcrumb + coreStatsSection;
  },

  renderEditMode() {
    const contentEl = document.getElementById('player-detail-content');
    const p = this.currentPlayer;

    const html = `
      <form id="player-detail-edit-form" onsubmit="return false;">
        <div class="detail-section">
          <h3>Character Information</h3>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-character-name">Character Name *</label>
              <input type="text" id="edit-character-name" class="form-control"
                     value="${p.character_name}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-character-class">Class</label>
              <input type="text" id="edit-character-class" class="form-control"
                     value="${p.character_class || ''}" placeholder="e.g., Fighter, Wizard">
            </div>
            <div class="form-group">
              <label for="edit-level">Level *</label>
              <input type="number" id="edit-level" class="form-control"
                     value="${p.level}" min="1" max="20" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-max-hp">Max HP *</label>
              <input type="number" id="edit-max-hp" class="form-control"
                     value="${p.max_hp}" min="1" required>
            </div>
            <div class="form-group">
              <label for="edit-current-hp">Current HP *</label>
              <input type="number" id="edit-current-hp" class="form-control"
                     value="${p.current_hp}" min="0" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-ac">Armor Class *</label>
              <input type="number" id="edit-ac" class="form-control"
                     value="${p.armor_class}" min="0" required>
            </div>
            <div class="form-group">
              <label for="edit-speed">Speed (ft) *</label>
              <input type="number" id="edit-speed" class="form-control"
                     value="${p.speed}" min="0" required>
            </div>
            <div class="form-group">
              <label for="edit-initiative">Initiative Bonus</label>
              <input type="number" id="edit-initiative" class="form-control"
                     value="${p.initiative_bonus || 0}">
            </div>
          </div>

          <div class="form-group">
            <label for="edit-notes">Notes</label>
            <textarea id="edit-notes" class="form-control" rows="3">${p.notes || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="edit-is-active" ${p.is_active ? 'checked' : ''}>
              <span>Active</span>
            </label>
          </div>
        </div>
      </form>
    `;

    contentEl.innerHTML = html;
  },

  showViewModeButtons() {
    const editBtn = document.getElementById('player-edit-toggle-btn');
    const cancelBtn = document.getElementById('player-detail-cancel-btn');
    const saveBtn = document.getElementById('player-detail-save-btn');

    if (editBtn) editBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  },

  showEditModeButtons() {
    const editBtn = document.getElementById('player-edit-toggle-btn');
    const cancelBtn = document.getElementById('player-detail-cancel-btn');
    const saveBtn = document.getElementById('player-detail-save-btn');

    if (editBtn) editBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (saveBtn) saveBtn.style.display = 'inline-block';
  },

  toggleEditMode() {
    if (this.isEditMode) {
      this.cancelEdit();
    } else {
      this.isEditMode = true;
      this.showEditModeButtons();
      this.render();
    }
  },

  cancelEdit() {
    // Revert to original data and exit edit mode
    this.currentPlayer = JSON.parse(JSON.stringify(this.originalPlayerData));
    this.isEditMode = false;
    this.showViewModeButtons();
    this.render();
  },

  async saveChanges() {
    const characterName = document.getElementById('edit-character-name').value.trim();
    const characterClass = document.getElementById('edit-character-class').value.trim();
    const level = parseInt(document.getElementById('edit-level').value);
    const maxHp = parseInt(document.getElementById('edit-max-hp').value);
    const currentHp = parseInt(document.getElementById('edit-current-hp').value);
    const ac = parseInt(document.getElementById('edit-ac').value);
    const speed = parseInt(document.getElementById('edit-speed').value);
    const initiative = parseInt(document.getElementById('edit-initiative').value) || 0;
    const notes = document.getElementById('edit-notes').value.trim();
    const isActive = document.getElementById('edit-is-active').checked;

    // Validation
    if (!characterName) {
      Components.showToast('Character name is required', 'error');
      return;
    }
    if (isNaN(level) || level < 1 || level > 20) {
      Components.showToast('Level must be between 1 and 20', 'error');
      return;
    }
    if (isNaN(maxHp) || maxHp < 1) {
      Components.showToast('Max HP must be at least 1', 'error');
      return;
    }
    if (isNaN(currentHp) || currentHp < 0) {
      Components.showToast('Current HP must be non-negative', 'error');
      return;
    }
    if (currentHp > maxHp) {
      Components.showToast('Current HP cannot exceed max HP', 'error');
      return;
    }
    if (isNaN(ac) || ac < 0) {
      Components.showToast('Armor Class must be non-negative', 'error');
      return;
    }
    if (isNaN(speed) || speed < 0) {
      Components.showToast('Speed must be non-negative', 'error');
      return;
    }

    try {
      const data = {
        character_name: characterName,
        character_class: characterClass || null,
        level: level,
        max_hp: maxHp,
        current_hp: currentHp,
        armor_class: ac,
        speed: speed,
        initiative_bonus: initiative,
        notes: notes || null,
        is_active: isActive
      };

      await API.players.update(this.currentPlayer.id, data);
      Components.showToast('Player updated successfully', 'success');

      this.isEditMode = false;
      this.showViewModeButtons();
      await this.loadPlayer(this.currentPlayer.id);
    } catch (error) {
      Components.showToast(error.message || 'Failed to save changes', 'error');
    }
  },

  getHPBadge(player) {
    const hpPercent = (player.current_hp / player.max_hp) * 100;
    if (hpPercent > 75) {
      return Components.createBadge('Healthy', 'success');
    } else if (hpPercent > 25) {
      return Components.createBadge('Wounded', 'warning');
    } else {
      return Components.createBadge('Critical', 'danger');
    }
  }
};

// Initialize when page becomes active
document.addEventListener('DOMContentLoaded', () => {
  const playerDetailPage = document.getElementById('player-detail-page');
  if (playerDetailPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (playerDetailPage.classList.contains('active')) {
            const playerId = playerDetailPage.dataset.playerId;
            if (playerId) {
              PlayerDetail.init(playerId);
            }
          }
        }
      });
    });
    observer.observe(playerDetailPage, { attributes: true });
  }
});
