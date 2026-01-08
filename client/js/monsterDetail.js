// Monster Detail Page Module
const MonsterDetail = {
  currentMonster: null,
  originalMonsterData: null,
  isEditMode: false,
  dndApiData: null,

  async init(monsterId) {
    this.currentMonster = null;
    this.originalMonsterData = null;
    this.isEditMode = false;
    this.dndApiData = null;

    await this.loadMonster(monsterId);
    this.setupEventListeners();
  },

  setupEventListeners() {
    const backBtn = document.getElementById('monster-detail-back-btn');

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
    const editBtn = document.getElementById('monster-edit-toggle-btn');
    const cancelBtn = document.getElementById('monster-detail-cancel-btn');
    const saveBtn = document.getElementById('monster-detail-save-btn');

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
    if (typeof Router !== 'undefined') {
      const encounterPage = document.getElementById('encounter-detail-page');
      if (encounterPage && encounterPage.dataset.encounterId) {
        Router.navigate(`/encounters/${encounterPage.dataset.encounterId}`);
      } else {
        Router.navigate('/encounters');
      }
    } else {
      const encounterPage = document.getElementById('encounter-detail-page');
      if (encounterPage && encounterPage.dataset.encounterId) {
        App.showPage('encounter-detail-page');
      } else {
        App.showPage('encounters-page');
      }
    }
  },

  async loadMonster(monsterId) {
    const contentEl = document.getElementById('monster-detail-content');

    try {
      Components.showSpinner(contentEl);

      const response = await API.monsters.getById(monsterId);
      this.currentMonster = response.data;
      this.originalMonsterData = JSON.parse(JSON.stringify(response.data));

      // Load D&D API data if available
      if (this.currentMonster.dnd_api_id) {
        try {
          const dndResponse = await API.monsters.getFromDndAPI(this.currentMonster.dnd_api_id);
          this.dndApiData = dndResponse.data;
        } catch (error) {
          console.warn('Failed to load D&D API data:', error);
        }
      }

      this.render();

      // Show edit button if admin
      if (Auth.isAdmin()) {
        this.showViewModeButtons();
      }
    } catch (error) {
      Components.hideSpinner(contentEl);

      if (error.message.includes('not found')) {
        contentEl.innerHTML = Components.createAlert(
          'This monster has been deleted or you do not have permission to view it.',
          'error'
        ).outerHTML;

        setTimeout(() => {
          this.navigateBack();
        }, 2000);
      } else {
        contentEl.innerHTML = Components.createAlert(
          error.message || 'Failed to load monster',
          'error'
        ).outerHTML;
      }
    }
  },

  render() {
    const titleEl = document.getElementById('monster-detail-page-title');
    const contentEl = document.getElementById('monster-detail-content');

    if (!this.currentMonster) return;

    titleEl.textContent = this.currentMonster.name;

    if (this.isEditMode) {
      this.renderEditMode();
    } else {
      this.renderViewMode();
    }

    Components.hideSpinner(contentEl);
  },

  renderViewMode() {
    const contentEl = document.getElementById('monster-detail-content');
    const m = this.currentMonster;

    // Build breadcrumb
    const breadcrumb = `
      <div class="breadcrumb">
        <span>${m.campaign_name || 'Campaign'}</span>
        <i class="fas fa-chevron-right"></i>
        <span>${m.encounter_name || 'Encounter'}</span>
        <i class="fas fa-chevron-right"></i>
        <span>${m.name}</span>
      </div>
    `;

    // Core stats section
    const coreStatsSection = `
      <div class="detail-section">
        <h3>Core Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <label>Hit Points</label>
            <div class="stat-value">
              <span class="hp-display">${m.current_hp} / ${m.max_hp}</span>
              ${this.getHPBadge(m).outerHTML}
            </div>
          </div>
          <div class="stat-item">
            <label>Armor Class</label>
            <div class="stat-value">${m.armor_class}</div>
          </div>
          <div class="stat-item">
            <label>Initiative Bonus</label>
            <div class="stat-value">${m.initiative_bonus >= 0 ? '+' : ''}${m.initiative_bonus}</div>
          </div>
          <div class="stat-item">
            <label>Death Saves Enabled</label>
            <div class="stat-value">
              ${m.allow_death_saves ? '<i class="fas fa-check success-text"></i> Yes' : '<i class="fas fa-times danger-text"></i> No'}
            </div>
          </div>
        </div>
        ${m.notes ? `
          <div class="stat-item full-width">
            <label>Notes</label>
            <div class="stat-value notes-display">${m.notes}</div>
          </div>
        ` : ''}
      </div>
    `;

    // Monster actions section
    const actionsSection = this.renderActionsViewMode();

    // D&D API data section (if available)
    const dndSection = this.dndApiData ? this.renderDndApiData() : '';

    contentEl.innerHTML = breadcrumb + coreStatsSection + actionsSection + dndSection;
  },

  renderActionsViewMode() {
    const actions = this.currentMonster.actions || [];

    if (actions.length === 0) {
      return `
        <div class="detail-section">
          <h3>Actions</h3>
          <p class="text-muted">No actions defined for this monster.</p>
        </div>
      `;
    }

    // Group by category
    const grouped = {
      action: actions.filter(a => a.action_category === 'action'),
      legendary: actions.filter(a => a.action_category === 'legendary'),
      special: actions.filter(a => a.action_category === 'special'),
      reaction: actions.filter(a => a.action_category === 'reaction')
    };

    let html = '<div class="detail-section"><h3>Actions</h3>';

    const categoryLabels = {
      action: 'Actions',
      legendary: 'Legendary Actions',
      special: 'Special Abilities',
      reaction: 'Reactions'
    };

    Object.entries(grouped).forEach(([category, items]) => {
      if (items.length > 0) {
        html += `<h4 class="action-category-header">${categoryLabels[category]}</h4>`;
        items.forEach(action => {
          html += `
            <div class="action-block">
              <strong>${action.name}.</strong>
              <p>${action.description}</p>
            </div>
          `;
        });
      }
    });

    html += '</div>';
    return html;
  },

  renderDndApiData() {
    const monster = this.dndApiData;

    const calcMod = (score) => {
      const mod = Math.floor((score - 10) / 2);
      return mod >= 0 ? `+${mod}` : `${mod}`;
    };

    return `
      <div class="detail-section dnd-api-section">
        <h3>D&D 5e Reference Data</h3>
        <p class="text-muted">Source: ${monster.index}</p>

        <div class="dnd-meta">
          <p>${monster.size} ${monster.type}${monster.alignment ? ', ' + monster.alignment : ''}</p>
        </div>

        <div class="ability-scores-grid">
          <div class="ability-score">
            <div class="ability-label">STR</div>
            <div class="ability-value">${monster.strength} (${calcMod(monster.strength)})</div>
          </div>
          <div class="ability-score">
            <div class="ability-label">DEX</div>
            <div class="ability-value">${monster.dexterity} (${calcMod(monster.dexterity)})</div>
          </div>
          <div class="ability-score">
            <div class="ability-label">CON</div>
            <div class="ability-value">${monster.constitution} (${calcMod(monster.constitution)})</div>
          </div>
          <div class="ability-score">
            <div class="ability-label">INT</div>
            <div class="ability-value">${monster.intelligence} (${calcMod(monster.intelligence)})</div>
          </div>
          <div class="ability-score">
            <div class="ability-label">WIS</div>
            <div class="ability-value">${monster.wisdom} (${calcMod(monster.wisdom)})</div>
          </div>
          <div class="ability-score">
            <div class="ability-label">CHA</div>
            <div class="ability-value">${monster.charisma} (${calcMod(monster.charisma)})</div>
          </div>
        </div>

        ${monster.damage_resistances?.length > 0 ? `
          <div class="dnd-detail-row">
            <strong>Damage Resistances:</strong> ${monster.damage_resistances.join(', ')}
          </div>
        ` : ''}

        ${monster.damage_immunities?.length > 0 ? `
          <div class="dnd-detail-row">
            <strong>Damage Immunities:</strong> ${monster.damage_immunities.join(', ')}
          </div>
        ` : ''}

        ${monster.condition_immunities?.length > 0 ? `
          <div class="dnd-detail-row">
            <strong>Condition Immunities:</strong> ${monster.condition_immunities.map(c => c.name).join(', ')}
          </div>
        ` : ''}

        <div class="dnd-detail-row">
          <strong>Challenge Rating:</strong> ${monster.challenge_rating} (${monster.xp?.toLocaleString() || 0} XP)
        </div>
      </div>
    `;
  },

  renderEditMode() {
    const contentEl = document.getElementById('monster-detail-content');
    const m = this.currentMonster;

    const html = `
      <form id="monster-detail-edit-form" onsubmit="return false;">
        <div class="detail-section">
          <h3>Core Statistics</h3>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-name">Monster Name *</label>
              <input type="text" id="edit-name" class="form-control" value="${m.name}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-max-hp">Max HP *</label>
              <input type="number" id="edit-max-hp" class="form-control" value="${m.max_hp}" min="1" required>
            </div>
            <div class="form-group">
              <label for="edit-current-hp">Current HP *</label>
              <input type="number" id="edit-current-hp" class="form-control" value="${m.current_hp}" min="0" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-ac">Armor Class *</label>
              <input type="number" id="edit-ac" class="form-control" value="${m.armor_class}" min="0" required>
            </div>
            <div class="form-group">
              <label for="edit-initiative">Initiative Bonus</label>
              <input type="number" id="edit-initiative" class="form-control" value="${m.initiative_bonus || 0}">
            </div>
          </div>

          <div class="form-group">
            <label for="edit-notes">Notes</label>
            <textarea id="edit-notes" class="form-control" rows="3">${m.notes || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="edit-allow-death-saves" ${m.allow_death_saves ? 'checked' : ''}>
              <span>Allow death saving throws</span>
            </label>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-header-with-action">
            <h3>Monster Actions</h3>
            <button type="button" id="add-action-btn" class="btn btn-sm btn-primary">
              <i class="fas fa-plus"></i> Add Action
            </button>
          </div>
          <div id="actions-edit-container">
            ${this.renderActionsEditMode()}
          </div>
        </div>
      </form>
    `;

    contentEl.innerHTML = html;

    // Setup add action button
    document.getElementById('add-action-btn')?.addEventListener('click', () => {
      this.showAddActionModal();
    });
  },

  renderActionsEditMode() {
    const actions = this.currentMonster.actions || [];

    if (actions.length === 0) {
      return '<p class="text-muted">No actions defined. Click "Add Action" to create one.</p>';
    }

    const grouped = {
      action: actions.filter(a => a.action_category === 'action'),
      legendary: actions.filter(a => a.action_category === 'legendary'),
      special: actions.filter(a => a.action_category === 'special'),
      reaction: actions.filter(a => a.action_category === 'reaction')
    };

    const categoryLabels = {
      action: 'Actions',
      legendary: 'Legendary Actions',
      special: 'Special Abilities',
      reaction: 'Reactions'
    };

    let html = '';

    Object.entries(grouped).forEach(([category, items]) => {
      if (items.length > 0) {
        html += `<h4 class="action-category-header">${categoryLabels[category]}</h4>`;
        items.forEach(action => {
          html += `
            <div class="action-edit-item" data-action-id="${action.id}">
              <div class="action-content">
                <strong>${action.name}</strong>
                <p>${action.description}</p>
              </div>
              <div class="action-controls">
                <button type="button" class="btn btn-sm btn-secondary" onclick="MonsterDetail.editAction(${action.id})">
                  <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-sm btn-danger" onclick="MonsterDetail.deleteAction(${action.id})">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        });
      }
    });

    return html;
  },

  showViewModeButtons() {
    const editBtn = document.getElementById('monster-edit-toggle-btn');
    const cancelBtn = document.getElementById('monster-detail-cancel-btn');
    const saveBtn = document.getElementById('monster-detail-save-btn');

    if (editBtn) editBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  },

  showEditModeButtons() {
    const editBtn = document.getElementById('monster-edit-toggle-btn');
    const cancelBtn = document.getElementById('monster-detail-cancel-btn');
    const saveBtn = document.getElementById('monster-detail-save-btn');

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
    this.currentMonster = JSON.parse(JSON.stringify(this.originalMonsterData));
    this.isEditMode = false;
    this.showViewModeButtons();
    this.render();
  },

  async saveChanges() {
    const name = document.getElementById('edit-name').value.trim();
    const maxHp = parseInt(document.getElementById('edit-max-hp').value);
    const currentHp = parseInt(document.getElementById('edit-current-hp').value);
    const ac = parseInt(document.getElementById('edit-ac').value);
    const initiative = parseInt(document.getElementById('edit-initiative').value) || 0;
    const notes = document.getElementById('edit-notes').value.trim();
    const allowDeathSaves = document.getElementById('edit-allow-death-saves').checked;

    // Validation
    if (!name) {
      Components.showToast('Monster name is required', 'error');
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
    if (isNaN(ac) || ac < 0) {
      Components.showToast('Armor Class must be non-negative', 'error');
      return;
    }
    if (currentHp > maxHp) {
      Components.showToast('Current HP cannot exceed max HP', 'error');
      return;
    }

    try {
      const data = {
        name: name,
        max_hp: maxHp,
        current_hp: currentHp,
        armor_class: ac,
        initiative_bonus: initiative,
        notes: notes || null,
        allow_death_saves: allowDeathSaves
      };

      await API.monsters.update(this.currentMonster.id, data);
      Components.showToast('Monster updated successfully', 'success');

      // Reload and exit edit mode
      this.isEditMode = false;
      await this.loadMonster(this.currentMonster.id);
      // loadMonster() will call showViewModeButtons() for admin users
    } catch (error) {
      Components.showToast(error.message || 'Failed to save changes', 'error');
    }
  },

  showAddActionModal() {
    const content = `
      <form id="add-action-form" onsubmit="return false;">
        <div class="form-group">
          <label for="action-category">Category *</label>
          <select id="action-category" class="form-control" required>
            <option value="action">Action</option>
            <option value="legendary">Legendary Action</option>
            <option value="special">Special Ability</option>
            <option value="reaction">Reaction</option>
          </select>
        </div>
        <div class="form-group">
          <label for="action-name">Name *</label>
          <input type="text" id="action-name" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="action-description">Description *</label>
          <textarea id="action-description" class="form-control" rows="4" required></textarea>
        </div>
      </form>
    `;

    const actions = [
      { id: 'cancel', label: 'Cancel', class: 'btn-secondary', handler: () => {} },
      {
        id: 'create',
        label: 'Create',
        class: 'btn-primary',
        handler: async () => {
          const category = document.getElementById('action-category').value;
          const name = document.getElementById('action-name').value.trim();
          const description = document.getElementById('action-description').value.trim();

          if (!name || !description) {
            Components.showToast('Name and description are required', 'error');
            return;
          }

          try {
            await API.monsters.createAction(this.currentMonster.id, {
              category,
              name,
              description
            });

            Components.showToast('Action created successfully', 'success');

            // Reload monster data
            const response = await API.monsters.getById(this.currentMonster.id);
            this.currentMonster = response.data;
            this.originalMonsterData = JSON.parse(JSON.stringify(response.data));

            // Re-render actions section
            const actionsContainer = document.getElementById('actions-edit-container');
            if (actionsContainer) {
              actionsContainer.innerHTML = this.renderActionsEditMode();
            }

            // Close modal
            document.querySelector('.modal-overlay')?.remove();
          } catch (error) {
            Components.showToast(error.message || 'Failed to create action', 'error');
          }
        },
        closeOnClick: false
      }
    ];

    Components.showModal('Add Action', content, actions);
  },

  editAction(actionId) {
    const action = this.currentMonster.actions.find(a => a.id === actionId);
    if (!action) return;

    const content = `
      <form id="edit-action-form" onsubmit="return false;">
        <div class="form-group">
          <label for="edit-action-category">Category *</label>
          <select id="edit-action-category" class="form-control" required>
            <option value="action" ${action.action_category === 'action' ? 'selected' : ''}>Action</option>
            <option value="legendary" ${action.action_category === 'legendary' ? 'selected' : ''}>Legendary Action</option>
            <option value="special" ${action.action_category === 'special' ? 'selected' : ''}>Special Ability</option>
            <option value="reaction" ${action.action_category === 'reaction' ? 'selected' : ''}>Reaction</option>
          </select>
        </div>
        <div class="form-group">
          <label for="edit-action-name">Name *</label>
          <input type="text" id="edit-action-name" class="form-control" value="${action.name}" required>
        </div>
        <div class="form-group">
          <label for="edit-action-description">Description *</label>
          <textarea id="edit-action-description" class="form-control" rows="4" required>${action.description}</textarea>
        </div>
      </form>
    `;

    const actions = [
      { id: 'cancel', label: 'Cancel', class: 'btn-secondary', handler: () => {} },
      {
        id: 'update',
        label: 'Update',
        class: 'btn-primary',
        handler: async () => {
          const category = document.getElementById('edit-action-category').value;
          const name = document.getElementById('edit-action-name').value.trim();
          const description = document.getElementById('edit-action-description').value.trim();

          if (!name || !description) {
            Components.showToast('Name and description are required', 'error');
            return;
          }

          try {
            await API.monsters.updateAction(actionId, {
              category,
              name,
              description
            });

            Components.showToast('Action updated successfully', 'success');

            // Reload monster data
            const response = await API.monsters.getById(this.currentMonster.id);
            this.currentMonster = response.data;
            this.originalMonsterData = JSON.parse(JSON.stringify(response.data));

            // Re-render actions section
            const actionsContainer = document.getElementById('actions-edit-container');
            if (actionsContainer) {
              actionsContainer.innerHTML = this.renderActionsEditMode();
            }

            // Close modal
            document.querySelector('.modal-overlay')?.remove();
          } catch (error) {
            Components.showToast(error.message || 'Failed to update action', 'error');
          }
        },
        closeOnClick: false
      }
    ];

    Components.showModal(`Edit Action: ${action.name}`, content, actions);
  },

  async deleteAction(actionId) {
    const action = this.currentMonster.actions.find(a => a.id === actionId);
    if (!action) return;

    Components.confirm(`Delete action "${action.name}"?`, async () => {
      try {
        await API.monsters.deleteAction(actionId);
        Components.showToast('Action deleted successfully', 'success');

        // Reload monster data
        const response = await API.monsters.getById(this.currentMonster.id);
        this.currentMonster = response.data;
        this.originalMonsterData = JSON.parse(JSON.stringify(response.data));

        // Re-render actions section
        const actionsContainer = document.getElementById('actions-edit-container');
        if (actionsContainer) {
          actionsContainer.innerHTML = this.renderActionsEditMode();
        }
      } catch (error) {
        Components.showToast(error.message || 'Failed to delete action', 'error');
      }
    });
  },

  getHPBadge(monster) {
    const hpPercent = (monster.current_hp / monster.max_hp) * 100;
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
  const monsterDetailPage = document.getElementById('monster-detail-page');
  if (monsterDetailPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (monsterDetailPage.classList.contains('active')) {
            const monsterId = monsterDetailPage.dataset.monsterId;
            if (monsterId) {
              MonsterDetail.init(monsterId);
            }
          }
        }
      });
    });
    observer.observe(monsterDetailPage, { attributes: true });
  }
});
