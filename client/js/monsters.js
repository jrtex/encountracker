// Monster Management
const Monsters = {
  currentMonsters: [],
  currentEncounter: null,
  originalEncounterData: null,
  encounterId: null,
  isEditMode: false,

  async init(encounterId) {
    this.encounterId = encounterId;
    this.isEditMode = false;
    await this.loadEncounter();
    await this.loadMonsters();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const backBtn = document.getElementById('back-to-encounters-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        if (this.isEditMode) {
          Components.confirm('Discard unsaved changes?', () => {
            App.showPage('encounters-page');
          });
        } else {
          App.showPage('encounters-page');
        }
      };
    }

    this.setupActionButtons();
    this.setupStartCombatButton();
  },

  setupActionButtons() {
    const editBtn = document.getElementById('encounter-edit-toggle-btn');
    const cancelBtn = document.getElementById('encounter-detail-cancel-btn');
    const saveBtn = document.getElementById('encounter-detail-save-btn');

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

  showViewModeButtons() {
    const editBtn = document.getElementById('encounter-edit-toggle-btn');
    const cancelBtn = document.getElementById('encounter-detail-cancel-btn');
    const saveBtn = document.getElementById('encounter-detail-save-btn');

    if (editBtn) editBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  },

  showEditModeButtons() {
    const editBtn = document.getElementById('encounter-edit-toggle-btn');
    const cancelBtn = document.getElementById('encounter-detail-cancel-btn');
    const saveBtn = document.getElementById('encounter-detail-save-btn');

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
    this.currentEncounter = JSON.parse(JSON.stringify(this.originalEncounterData));
    this.isEditMode = false;
    this.showViewModeButtons();
    this.render();
  },

  async saveChanges() {
    const name = document.getElementById('edit-encounter-name')?.value.trim();
    const description = document.getElementById('edit-encounter-description')?.value.trim();
    const difficulty = document.getElementById('edit-encounter-difficulty')?.value;

    if (!name) {
      Components.showToast('Encounter name is required', 'error');
      return;
    }

    try {
      const data = {
        name,
        description: description || null,
        difficulty
      };

      await API.encounters.update(this.encounterId, data);
      Components.showToast('Encounter updated successfully', 'success');

      this.isEditMode = false;
      await this.loadEncounter();
      this.showViewModeButtons();
    } catch (error) {
      Components.showToast(error.message || 'Failed to save changes', 'error');
    }
  },

  setupStartCombatButton() {
    const startCombatBtn = document.getElementById('start-encounter-combat-btn');
    if (!startCombatBtn || !this.currentEncounter) return;

    // Show button only if encounter status is 'pending'
    if (this.currentEncounter.status === 'pending') {
      startCombatBtn.style.display = 'inline-block';
    } else {
      startCombatBtn.style.display = 'none';
    }

    // Remove existing event listener if any
    const newBtn = startCombatBtn.cloneNode(true);
    startCombatBtn.parentNode.replaceChild(newBtn, startCombatBtn);

    // Add click handler
    newBtn.addEventListener('click', async () => {
      // Set current encounter for Initiative module
      Initiative.currentEncounter = this.currentEncounter;
      await Initiative.showStartCombatModal();

      // After combat starts, reload encounter to update status
      await this.loadEncounter();
      this.setupStartCombatButton();
    });
  },

  async loadEncounter() {
    try {
      const response = await API.encounters.getById(this.encounterId);
      this.currentEncounter = response.data;
      this.originalEncounterData = JSON.parse(JSON.stringify(response.data));
      this.render();

      // Show edit button if admin
      if (Auth.isAdmin()) {
        this.showViewModeButtons();
      }
    } catch (error) {
      console.error('Failed to load encounter:', error);
      Components.showToast(error.message || 'Failed to load encounter', 'error');
    }
  },

  render() {
    const titleEl = document.getElementById('encounter-detail-title');
    const contentEl = document.getElementById('encounter-detail-content');

    if (!this.currentEncounter) return;

    titleEl.textContent = this.currentEncounter.name;

    if (this.isEditMode) {
      this.renderEditMode();
    } else {
      this.renderViewMode();
    }

    this.setupStartCombatButton();
  },

  renderViewMode() {
    const contentEl = document.getElementById('encounter-detail-content');
    const e = this.currentEncounter;

    const breadcrumb = `
      <div class="breadcrumb">
        <span>${e.campaign_name || 'Campaign'}</span>
        <i class="fas fa-chevron-right"></i>
        <span>${e.name}</span>
      </div>
    `;

    const difficultyBadge = Components.createBadge(
      e.difficulty || 'medium',
      this.getDifficultyBadgeType(e.difficulty)
    );
    const statusBadge = Components.createBadge(
      e.status || 'pending',
      this.getStatusBadgeType(e.status)
    );

    const encounterInfoSection = `
      <div class="detail-section">
        <h3>Encounter Details</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <label>Status</label>
            <div class="stat-value">${statusBadge.outerHTML}</div>
          </div>
          <div class="stat-item">
            <label>Difficulty</label>
            <div class="stat-value">${difficultyBadge.outerHTML}</div>
          </div>
        </div>
        ${e.description ? `
          <div class="stat-item full-width">
            <label>Description</label>
            <div class="stat-value notes-display">${e.description}</div>
          </div>
        ` : ''}
      </div>
    `;

    const monstersSection = this.renderMonstersSection();

    contentEl.innerHTML = breadcrumb + encounterInfoSection + monstersSection;
  },

  renderEditMode() {
    const contentEl = document.getElementById('encounter-detail-content');
    const e = this.currentEncounter;

    const html = `
      <form id="encounter-detail-edit-form" onsubmit="return false;">
        <div class="detail-section">
          <h3>Encounter Details</h3>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-encounter-name">Encounter Name *</label>
              <input type="text" id="edit-encounter-name" class="form-control" value="${e.name}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="edit-encounter-description">Description</label>
            <textarea id="edit-encounter-description" class="form-control" rows="3">${e.description || ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-encounter-difficulty">Difficulty</label>
              <select id="edit-encounter-difficulty" class="form-control">
                <option value="easy" ${e.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                <option value="medium" ${e.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="hard" ${e.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                <option value="deadly" ${e.difficulty === 'deadly' ? 'selected' : ''}>Deadly</option>
              </select>
            </div>
          </div>
        </div>
      </form>

      ${this.renderMonstersSection()}
    `;

    contentEl.innerHTML = html;
  },

  renderMonstersSection() {
    let html = '<div class="detail-section"><h3>Monsters</h3>';

    html += '<div class="monster-grid" id="monsters-container-grid">';

    if (this.currentMonsters.length === 0) {
      // Show message when no monsters
      html += '<div style="grid-column: 1 / -1;"><p class="text-muted">No monsters yet. Add your first monster to this encounter!</p></div>';
    } else {
      // Add all monster cards
      this.currentMonsters.forEach(monster => {
        html += this.createMonsterCardHTML(monster);
      });
    }

    // Add "+" button card for adding monsters (admin only)
    if (Auth.isAdmin()) {
      html += `
        <div class="card add-monster-card" id="add-monster-btn-inline" style="cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 200px; border: 2px dashed var(--border-color); background-color: var(--background-color);">
          <i class="fas fa-plus" style="font-size: 3rem; color: var(--primary-color); opacity: 0.6;"></i>
        </div>
      `;
    }

    html += '</div></div>';

    // Set up event listener for add monster button after render
    setTimeout(() => {
      const addMonsterBtn = document.getElementById('add-monster-btn-inline');
      if (addMonsterBtn) {
        addMonsterBtn.addEventListener('click', () => {
          this.showMonsterModal();
        });
      }

      // Set up click handlers for monster cards
      const monsterCards = document.querySelectorAll('.monster-card-clickable');
      monsterCards.forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const monsterId = card.dataset.monsterId;
          if (monsterId) {
            if (typeof Router !== 'undefined') {
              Router.navigate(`/monsters/${monsterId}`);
            } else {
              const detailPage = document.getElementById('monster-detail-page');
              if (detailPage) {
                detailPage.dataset.monsterId = monsterId;
                App.showPage('monster-detail-page');
              }
            }
          }
        });
      });

      // Set up delete handlers
      const deleteButtons = document.querySelectorAll('.monster-delete-btn');
      deleteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const monsterId = btn.dataset.monsterId;
          if (monsterId) {
            this.deleteMonster(parseInt(monsterId));
          }
        });
      });
    }, 0);

    return html;
  },

  createMonsterCardHTML(monster) {
    const hpBadge = this.getHPBadge(monster);
    const hpPercent = (monster.current_hp / monster.max_hp) * 100;
    let cardClass = 'monster-card-clickable';
    if (hpPercent <= 25) cardClass += ' monster-card-critical';
    else if (hpPercent <= 75) cardClass += ' monster-card-wounded';

    return `
      <div class="card ${cardClass}" data-monster-id="${monster.id}" style="cursor: pointer;">
        <div class="card-header">
          <h3>${monster.name}</h3>
        </div>
        <div class="card-body">
          <div class="monster-stats">
            <div class="monster-stat">
              <strong>HP:</strong>
              <span>${monster.current_hp} / ${monster.max_hp} ${hpBadge.outerHTML}</span>
            </div>
            <div class="monster-stat">
              <strong>AC:</strong>
              <span>${monster.armor_class}</span>
            </div>
            <div class="monster-stat">
              <strong>Initiative:</strong>
              <span>${monster.initiative_bonus >= 0 ? '+' : ''}${monster.initiative_bonus}</span>
            </div>
          </div>
          ${monster.notes ? `<p class="monster-notes"><strong>Notes:</strong> ${monster.notes}</p>` : ''}
          ${monster.dnd_api_id ? `<p class="monster-source"><small>Source: D&D 5e API (${monster.dnd_api_id})</small></p>` : ''}
        </div>
        ${Auth.isAdmin() ? `
          <div class="card-footer">
            <div class="card-actions">
              <button class="btn btn-sm btn-danger monster-delete-btn" data-monster-id="${monster.id}">Delete</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
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

  getStatusBadgeType(status) {
    const types = {
      'pending': 'secondary',
      'active': 'warning',
      'completed': 'success'
    };
    return types[status] || 'secondary';
  },

  async loadMonsters() {
    try {
      const response = await API.monsters.getAll(this.encounterId);
      this.currentMonsters = response.data || [];
      this.render();
    } catch (error) {
      Components.showToast(error.message || 'Failed to load monsters', 'error');
    }
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
  },

  showMonsterModal(monster = null) {
    const isEdit = !!monster;
    const title = isEdit ? 'Edit Monster' : 'Add Monster';

    const content = `
      <div class="modal-tabs">
        <button class="tab-btn ${!isEdit ? 'active' : ''}" data-tab="api-search">D&D 5e API</button>
        <button class="tab-btn ${isEdit ? 'active' : ''}" data-tab="manual">Manual Entry</button>
      </div>

      <div class="tab-content ${isEdit ? 'active' : ''}" data-tab-content="manual">
        <form id="monster-form" onsubmit="return false;">
          <div class="form-group">
            <label for="monster-name">Monster Name *</label>
            <input
              type="text"
              id="monster-name"
              class="form-control"
              value="${monster ? monster.name : ''}"
              required
            >
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="monster-max-hp">Max HP *</label>
              <input
                type="number"
                id="monster-max-hp"
                class="form-control"
                value="${monster ? monster.max_hp : ''}"
                min="1"
                required
              >
            </div>
            ${isEdit ? `
            <div class="form-group">
              <label for="monster-current-hp">Current HP</label>
              <input
                type="number"
                id="monster-current-hp"
                class="form-control"
                value="${monster.current_hp}"
                min="0"
              >
            </div>
            ` : ''}
            <div class="form-group">
              <label for="monster-ac">Armor Class *</label>
              <input
                type="number"
                id="monster-ac"
                class="form-control"
                value="${monster ? monster.armor_class : ''}"
                min="0"
                required
              >
            </div>
            <div class="form-group">
              <label for="monster-initiative">Initiative Bonus</label>
              <input
                type="number"
                id="monster-initiative"
                class="form-control"
                value="${monster ? monster.initiative_bonus : 0}"
              >
            </div>
          </div>
          <div class="form-group">
            <label for="monster-notes">Notes</label>
            <textarea
              id="monster-notes"
              class="form-control"
              rows="3"
              placeholder="Special abilities, tactics, etc."
            >${monster ? (monster.notes || '') : ''}</textarea>
          </div>
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 0.5rem;">
              <input
                type="checkbox"
                id="monster-allow-death-saves"
                ${monster && monster.allow_death_saves ? 'checked' : ''}
              >
              <span>Allow death saves</span>
            </label>
            <small style="color: var(--text-muted, #6c757d); display: block; margin-top: 0.25rem;">
              Enable death saving throws for this monster during encounters
            </small>
          </div>
          <input type="hidden" id="monster-dnd-api-id" value="${monster ? (monster.dnd_api_id || '') : ''}">
        </form>
      </div>

      <div class="tab-content ${!isEdit ? 'active' : ''}" data-tab-content="api-search">
        <div class="monster-search-input-wrapper">
          <div class="form-group">
            <label for="monster-search-input">Search for a monster</label>
            <div class="search-input-group">
              <input
                type="text"
                id="monster-search-input"
                class="form-control"
                placeholder="Start typing to search... (e.g., goblin, dragon, orc)"
              >
            </div>
          </div>
        </div>
        <div id="monster-search-results"></div>
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
        label: isEdit ? 'Update' : 'Create',
        class: 'btn-primary',
        handler: () => this.saveMonsterFromModal(monster?.id),
        closeOnClick: false
      }
    ];

    const modal = Components.showModal(title, content, actions);

    // Disable Create button initially if on API search tab (not edit mode)
    const saveBtn = modal.querySelector('[data-action="save"]');
    if (!isEdit && saveBtn) {
      saveBtn.disabled = true;
    }

    // Setup tab switching
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        e.target.classList.add('active');
        const tabName = e.target.dataset.tab;
        modal.querySelector(`[data-tab-content="${tabName}"]`).classList.add('active');

        // Disable Create button when switching to API search tab if no monster selected
        const saveBtn = modal.querySelector('[data-action="save"]');
        if (saveBtn && tabName === 'api-search' && !modal.dataset.currentApiMonster) {
          saveBtn.disabled = true;
        } else if (saveBtn && tabName === 'manual') {
          saveBtn.disabled = false;
        }
      });
    });

    // Setup live API search
    const searchInput = modal.querySelector('#monster-search-input');

    if (searchInput) {
      let searchTimeout = null;

      // Load all monsters initially
      this.searchDndApi('', modal);

      // Live search with debouncing
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchDndApi(e.target.value, modal);
        }, 300); // 300ms debounce
      });
    }
  },


  async searchDndApi(query, modal) {
    const resultsContainer = modal.querySelector('#monster-search-results');
    if (!resultsContainer) return;

    // Make sure search input is visible when showing results
    const searchInputWrapper = modal.querySelector('.monster-search-input-wrapper');
    if (searchInputWrapper) {
      searchInputWrapper.style.display = 'block';
    }

    // Clear stored monster data when showing search results
    delete modal.dataset.currentApiMonster;

    // Reset the modal's button text and disable it
    const modalSaveBtn = modal.querySelector('[data-action="save"]');
    if (modalSaveBtn) {
      modalSaveBtn.textContent = 'Create';
      modalSaveBtn.disabled = true;
    }

    resultsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>';

    try {
      const response = await API.monsters.search(query);
      const monsters = response.data || [];

      if (monsters.length === 0) {
        resultsContainer.innerHTML = Components.createAlert(
          query ? `No monsters found matching "${query}"` : 'No monsters found',
          'info'
        ).outerHTML;
        return;
      }

      resultsContainer.innerHTML = '<div class="api-results-list"></div>';
      const resultsList = resultsContainer.querySelector('.api-results-list');

      monsters.slice(0, 20).forEach(monster => {
        const resultItem = document.createElement('div');
        resultItem.className = 'api-result-item';
        resultItem.style.cursor = 'pointer';
        resultItem.innerHTML = `
          <span class="api-result-name">${monster.name}</span>
          <span class="api-result-arrow">→</span>
        `;

        resultItem.addEventListener('click', () => {
          this.showMonsterDetailInModal(monster.index, modal);
        });

        resultsList.appendChild(resultItem);
      });
    } catch (error) {
      resultsContainer.innerHTML = Components.createAlert(
        'Unable to reach D&D 5e API. Please try again or use manual entry.',
        'error'
      ).outerHTML;
    }
  },

  async showMonsterDetailInModal(monsterId, modal) {
    const resultsContainer = modal.querySelector('#monster-search-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>';

    try {
      // Use server-side proxy to fetch monster details (avoids CSP issues)
      const response = await API.monsters.getFromDndAPI(monsterId);
      const monster = response.data;

      // Calculate ability modifiers
      const calcMod = (score) => {
        const mod = Math.floor((score - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
      };

      // Render monster details with quantity selector
      resultsContainer.innerHTML = `
        <div class="monster-detail-modal-view">
          <button class="btn btn-sm btn-secondary mb-2" id="back-to-search"><i class="fas fa-arrow-left"></i> Back to Search</button>

          <div style="margin-top: 1rem; display: flex; gap: 1.5rem; align-items: flex-start; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0;">
              <label for="monster-quantity">Number to Add</label>
              <input
                type="number"
                id="monster-quantity"
                class="form-control"
                value="1"
                min="1"
                max="20"
                style="max-width: 150px;"
              >
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.75rem;">
                <input
                  type="checkbox"
                  id="api-monster-allow-death-saves"
                >
                <span>Allow death saves</span>
              </label>
            </div>
          </div>

          <div class="monster-detail-full">
            <div class="monster-detail-header">
              <h3>${monster.name}</h3>
              <p class="monster-meta">${monster.size} ${monster.type}${monster.alignment ? `, ${monster.alignment}` : ''}</p>
            </div>

            <div class="monster-detail-stats-block">
              <div class="stat-line">
                <strong>Armor Class:</strong> ${monster.armor_class?.[0]?.value || 10}
              </div>
              <div class="stat-line">
                <strong>Hit Points:</strong> ${monster.hit_points} (${monster.hit_dice || 'N/A'})
              </div>
              <div class="stat-line">
                <strong>Speed:</strong> ${(() => {
                  const speed = monster.speed || {};
                  if (typeof speed === 'object' && !Array.isArray(speed)) {
                    const speedStr = Object.entries(speed).map(([key, val]) => `${key} ${val}`).join(', ');
                    return speedStr || 'N/A';
                  }
                  return 'N/A';
                })()}
              </div>
            </div>

            <div class="monster-detail-abilities">
              <div class="ability-scores">
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
            </div>

            ${monster.proficiencies?.length > 0 ? `
              <div class="monster-detail-section">
                <strong>Proficiencies:</strong> ${monster.proficiencies.map(p => `${p.proficiency.name.replace('Skill: ', '')} ${p.value >= 0 ? '+' : ''}${p.value}`).join(', ')}
              </div>
            ` : ''}

            ${monster.damage_vulnerabilities?.length > 0 ? `
              <div class="monster-detail-section">
                <strong>Damage Vulnerabilities:</strong> ${monster.damage_vulnerabilities.join(', ')}
              </div>
            ` : ''}

            ${monster.damage_resistances?.length > 0 ? `
              <div class="monster-detail-section">
                <strong>Damage Resistances:</strong> ${monster.damage_resistances.join(', ')}
              </div>
            ` : ''}

            ${monster.damage_immunities?.length > 0 ? `
              <div class="monster-detail-section">
                <strong>Damage Immunities:</strong> ${monster.damage_immunities.join(', ')}
              </div>
            ` : ''}

            ${monster.condition_immunities?.length > 0 ? `
              <div class="monster-detail-section">
                <strong>Condition Immunities:</strong> ${monster.condition_immunities.map(c => c.name).join(', ')}
              </div>
            ` : ''}

            <div class="monster-detail-section">
              <strong>Senses:</strong> ${(() => {
                const senses = monster.senses || {};
                const sensesArray = typeof senses === 'object' && !Array.isArray(senses)
                  ? Object.entries(senses).filter(([k]) => k !== 'passive_perception').map(([key, val]) => `${key.replace('_', ' ')} ${val}`)
                  : [];
                if (senses.passive_perception) sensesArray.push(`passive Perception ${senses.passive_perception}`);
                return sensesArray.length > 0 ? sensesArray.join(', ') : 'None';
              })()}
            </div>

            ${monster.languages ? `
              <div class="monster-detail-section">
                <strong>Languages:</strong> ${monster.languages || 'None'}
              </div>
            ` : ''}

            <div class="monster-detail-section">
              <strong>Challenge:</strong> ${monster.challenge_rating} (${monster.xp?.toLocaleString() || 0} XP)
            </div>

            ${monster.special_abilities?.length > 0 ? `
              <div class="monster-detail-section">
                <h4>Special Abilities</h4>
                ${monster.special_abilities.map(ability => `
                  <div class="ability-block">
                    <strong>${ability.name}${ability.usage ? ` (${ability.usage.type})` : ''}.</strong>
                    <p>${ability.desc}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${monster.actions?.length > 0 ? `
              <div class="monster-detail-section">
                <h4>Actions</h4>
                ${monster.actions.map(action => `
                  <div class="ability-block">
                    <strong>${action.name}.</strong>
                    <p>${action.desc}</p>
                    ${action.attack_bonus ? `<p><em>Attack Bonus: +${action.attack_bonus}</em></p>` : ''}
                    ${action.damage?.length > 0 ? `<p><em>Damage: ${action.damage.map(d => `${d.damage_dice} ${d.damage_type.name}`).join(' + ')}</em></p>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${monster.legendary_actions?.length > 0 ? `
              <div class="monster-detail-section">
                <h4>Legendary Actions</h4>
                <p><em>The ${monster.name.toLowerCase()} can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monster.name.toLowerCase()} regains spent legendary actions at the start of its turn.</em></p>
                ${monster.legendary_actions.map(action => `
                  <div class="ability-block">
                    <strong>${action.name}.</strong>
                    <p>${action.desc}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${monster.reactions?.length > 0 ? `
              <div class="monster-detail-section">
                <h4>Reactions</h4>
                ${monster.reactions.map(reaction => `
                  <div class="ability-block">
                    <strong>${reaction.name}.</strong>
                    <p>${reaction.desc}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #dee2e6;">
            <button class="btn btn-primary" id="add-monsters-from-detail">Add</button>
          </div>
        </div>
      `;

      // Setup back button
      const backBtn = resultsContainer.querySelector('#back-to-search');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          const searchInput = modal.querySelector('#monster-search-input');
          this.searchDndApi(searchInput?.value || '', modal);
        });
      }

      // Hide the search input when showing monster details
      const searchInputWrapper = modal.querySelector('.monster-search-input-wrapper');
      if (searchInputWrapper) {
        searchInputWrapper.style.display = 'none';
      }

      // Store current monster data on modal for the Create button
      modal.dataset.currentApiMonster = JSON.stringify(monster);

      // Update the modal's Create button text and enable it
      const modalSaveBtn = modal.querySelector('[data-action="save"]');
      if (modalSaveBtn) {
        modalSaveBtn.textContent = 'Add to Encounter';
        modalSaveBtn.disabled = false;
      }

      // Setup add to encounter button
      const addBtn = resultsContainer.querySelector('#add-monsters-from-detail');
      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          const quantityInput = resultsContainer.querySelector('#monster-quantity');
          const quantity = parseInt(quantityInput?.value) || 1;

          if (quantity < 1 || quantity > 20) {
            Components.showToast('Quantity must be between 1 and 20', 'error');
            return;
          }

          await this.addMonsterFromApi(monster, quantity, modal);
        });
      }

    } catch (error) {
      console.error('Failed to load monster details:', error);
      resultsContainer.innerHTML = `
        <div>
          ${Components.createAlert(
            `Failed to load monster details: ${error.message}`,
            'error'
          ).outerHTML}
          <button class="btn btn-sm btn-secondary mt-2" id="back-to-search-error"><i class="fas fa-arrow-left"></i> Back to Search</button>
        </div>
      `;

      // Setup back button in error state
      const backBtn = resultsContainer.querySelector('#back-to-search-error');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          const searchInput = modal.querySelector('#monster-search-input');
          this.searchDndApi(searchInput?.value || '', modal);
        });
      }
    }
  },

  async addMonsterFromApi(monster, quantity, modal) {
    if (!Auth.isAdmin()) {
      Components.showToast('Only admins can add monsters', 'error');
      return;
    }

    try {
      // Get the allow_death_saves checkbox value
      const allowDeathSavesCheckbox = modal.querySelector('#api-monster-allow-death-saves');
      const allowDeathSaves = allowDeathSavesCheckbox ? allowDeathSavesCheckbox.checked : false;

      // Calculate initiative bonus from dexterity
      const dexMod = Math.floor((monster.dexterity - 10) / 2);

      // Find existing monsters with the same base name to continue numbering
      const existingMonsters = this.currentMonsters.filter(m => {
        // Match both "Goblin", "Goblin #1", "Goblin #2", etc.
        return m.name === monster.name || m.name.startsWith(`${monster.name} #`);
      });

      let startNumber = existingMonsters.length + 1;

      // Extract actions from D&D API
      const actions = [];

      // Extract regular actions
      if (monster.actions && Array.isArray(monster.actions)) {
        monster.actions.forEach(action => {
          actions.push({
            category: 'action',
            name: action.name,
            description: action.desc
          });
        });
      }

      // Extract legendary actions
      if (monster.legendary_actions && Array.isArray(monster.legendary_actions)) {
        monster.legendary_actions.forEach(action => {
          actions.push({
            category: 'legendary',
            name: action.name,
            description: action.desc
          });
        });
      }

      // Extract special abilities
      if (monster.special_abilities && Array.isArray(monster.special_abilities)) {
        monster.special_abilities.forEach(ability => {
          actions.push({
            category: 'special',
            name: ability.name,
            description: ability.desc
          });
        });
      }

      // Extract reactions
      if (monster.reactions && Array.isArray(monster.reactions)) {
        monster.reactions.forEach(reaction => {
          actions.push({
            category: 'reaction',
            name: reaction.name,
            description: reaction.desc
          });
        });
      }

      // Create monsters in database
      const promises = [];
      for (let i = 0; i < quantity; i++) {
        const monsterName = quantity > 1 || existingMonsters.length > 0
          ? `${monster.name} #${startNumber + i}`
          : monster.name;

        const data = {
          encounter_id: this.encounterId,
          name: monsterName,
          max_hp: monster.hit_points,
          armor_class: monster.armor_class?.[0]?.value || 10,
          initiative_bonus: dexMod,
          dnd_api_id: monster.index,
          notes: `${monster.size} ${monster.type} (CR ${monster.challenge_rating})`,
          actions: actions,
          allow_death_saves: allowDeathSaves
        };
        promises.push(API.monsters.create(data));
      }

      await Promise.all(promises);

      const message = quantity === 1
        ? `${monster.name} added to encounter!`
        : `${quantity}x ${monster.name} added to encounter!`;
      Components.showToast(message, 'success');

      // Close modal
      const modalOverlay = document.querySelector('.modal-overlay');
      if (modalOverlay) modalOverlay.remove();

      // Reload monsters list
      await this.loadMonsters();
    } catch (error) {
      Components.showToast(error.message || 'Failed to add monster(s)', 'error');
    }
  },

  async showMonsterDetailFromApi(monsterId) {
    const detailPage = document.getElementById('monster-detail-page');
    const titleEl = document.getElementById('monster-detail-title');
    const contentEl = document.getElementById('monster-detail-content');

    if (!detailPage || !contentEl) return;

    // Show loading state
    contentEl.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>';

    if (typeof Router !== 'undefined') {
      Router.navigate(`/monsters/${monsterId}`);
    } else {
      // Store monster ID for later use
      detailPage.dataset.monsterId = monsterId;
      App.showPage('monster-detail-page');
    }

    try {
      // Use server-side proxy to fetch monster details (avoids CSP issues)
      const response = await API.monsters.getFromDndAPI(monsterId);
      const monster = response.data;

      // Update title
      if (titleEl) {
        titleEl.textContent = monster.name;
      }

      // Calculate ability modifiers
      const calcMod = (score) => {
        const mod = Math.floor((score - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
      };

      // Render full monster details
      contentEl.innerHTML = `
        <div class="monster-detail-full">
          <div class="monster-detail-header">
            <p class="monster-meta">${monster.size} ${monster.type}${monster.alignment ? `, ${monster.alignment}` : ''}</p>
          </div>

          <div class="monster-detail-stats-block">
            <div class="stat-line">
              <strong>Armor Class:</strong> ${monster.armor_class?.[0]?.value || 10}
            </div>
            <div class="stat-line">
              <strong>Hit Points:</strong> ${monster.hit_points} (${monster.hit_dice || 'N/A'})
            </div>
            <div class="stat-line">
              <strong>Speed:</strong> ${Object.entries(monster.speed || {}).map(([key, val]) => `${key} ${val}`).join(', ') || 'N/A'}
            </div>
          </div>

          <div class="monster-detail-abilities">
            <div class="ability-scores">
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
          </div>

          ${monster.proficiencies?.length > 0 ? `
            <div class="monster-detail-section">
              <strong>Proficiencies:</strong> ${monster.proficiencies.map(p => `${p.proficiency.name.replace('Skill: ', '')} ${p.value >= 0 ? '+' : ''}${p.value}`).join(', ')}
            </div>
          ` : ''}

          ${monster.damage_vulnerabilities?.length > 0 ? `
            <div class="monster-detail-section">
              <strong>Damage Vulnerabilities:</strong> ${monster.damage_vulnerabilities.join(', ')}
            </div>
          ` : ''}

          ${monster.damage_resistances?.length > 0 ? `
            <div class="monster-detail-section">
              <strong>Damage Resistances:</strong> ${monster.damage_resistances.join(', ')}
            </div>
          ` : ''}

          ${monster.damage_immunities?.length > 0 ? `
            <div class="monster-detail-section">
              <strong>Damage Immunities:</strong> ${monster.damage_immunities.join(', ')}
            </div>
          ` : ''}

          ${monster.condition_immunities?.length > 0 ? `
            <div class="monster-detail-section">
              <strong>Condition Immunities:</strong> ${monster.condition_immunities.map(c => c.name).join(', ')}
            </div>
          ` : ''}

          <div class="monster-detail-section">
            <strong>Senses:</strong> ${Object.entries(monster.senses || {}).filter(([k]) => k !== 'passive_perception').map(([key, val]) => `${key.replace('_', ' ')} ${val}`).join(', ')}${monster.senses?.passive_perception ? `, passive Perception ${monster.senses.passive_perception}` : ''}
          </div>

          ${monster.languages ? `
            <div class="monster-detail-section">
              <strong>Languages:</strong> ${monster.languages || 'None'}
            </div>
          ` : ''}

          <div class="monster-detail-section">
            <strong>Challenge:</strong> ${monster.challenge_rating} (${monster.xp?.toLocaleString() || 0} XP)
          </div>

          ${monster.special_abilities?.length > 0 ? `
            <div class="monster-detail-section">
              <h3>Special Abilities</h3>
              ${monster.special_abilities.map(ability => `
                <div class="ability-block">
                  <strong>${ability.name}${ability.usage ? ` (${ability.usage.type})` : ''}.</strong>
                  <p>${ability.desc}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${monster.actions?.length > 0 ? `
            <div class="monster-detail-section">
              <h3>Actions</h3>
              ${monster.actions.map(action => `
                <div class="ability-block">
                  <strong>${action.name}.</strong>
                  <p>${action.desc}</p>
                  ${action.attack_bonus ? `<p><em>Attack Bonus: +${action.attack_bonus}</em></p>` : ''}
                  ${action.damage?.length > 0 ? `<p><em>Damage: ${action.damage.map(d => `${d.damage_dice} ${d.damage_type.name}`).join(' + ')}</em></p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${monster.legendary_actions?.length > 0 ? `
            <div class="monster-detail-section">
              <h3>Legendary Actions</h3>
              <p><em>The ${monster.name.toLowerCase()} can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monster.name.toLowerCase()} regains spent legendary actions at the start of its turn.</em></p>
              ${monster.legendary_actions.map(action => `
                <div class="ability-block">
                  <strong>${action.name}.</strong>
                  <p>${action.desc}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${monster.reactions?.length > 0 ? `
            <div class="monster-detail-section">
              <h3>Reactions</h3>
              ${monster.reactions.map(reaction => `
                <div class="ability-block">
                  <strong>${reaction.name}.</strong>
                  <p>${reaction.desc}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;

      // Store full monster data for later
      detailPage.dataset.monsterData = JSON.stringify({
        index: monster.index,
        name: monster.name,
        hit_points: monster.hit_points,
        armor_class: monster.armor_class?.[0]?.value || 10,
        dexterity: monster.dexterity,
        size: monster.size,
        type: monster.type,
        challenge_rating: monster.challenge_rating
      });

    } catch (error) {
      console.error('Failed to load monster details:', error);
      contentEl.innerHTML = Components.createAlert(
        'Failed to load monster details from D&D 5e API',
        'error'
      ).outerHTML;
    }
  },

  async saveMonsterFromModal(monsterId = null) {
    const modal = document.querySelector('.modal-overlay');
    if (!modal) return;

    // Check which tab is active
    const activeTab = modal.querySelector('.tab-btn.active');
    const isApiSearchTab = activeTab && activeTab.dataset.tab === 'api-search';

    // If on API search tab and there's monster data stored, use it
    if (isApiSearchTab && modal.dataset.currentApiMonster) {
      try {
        const monster = JSON.parse(modal.dataset.currentApiMonster);

        // Get quantity from input field
        const quantityInput = modal.querySelector('#monster-quantity');
        const quantity = parseInt(quantityInput?.value) || 1;

        if (quantity < 1 || quantity > 20) {
          Components.showToast('Quantity must be between 1 and 20', 'error');
          return;
        }

        await this.addMonsterFromApi(monster, quantity, modal);
      } catch (error) {
        Components.showToast('Please select a monster from the search results first', 'error');
      }
    } else {
      // Otherwise use manual entry form
      await this.saveMonster(monsterId);
    }
  },

  async saveMonster(monsterId = null) {
    const nameInput = document.getElementById('monster-name');
    const maxHpInput = document.getElementById('monster-max-hp');
    const currentHpInput = document.getElementById('monster-current-hp');
    const acInput = document.getElementById('monster-ac');
    const initiativeInput = document.getElementById('monster-initiative');
    const notesInput = document.getElementById('monster-notes');
    const dndApiIdInput = document.getElementById('monster-dnd-api-id');
    const allowDeathSavesInput = document.getElementById('monster-allow-death-saves');

    const name = nameInput.value.trim();
    const max_hp = parseInt(maxHpInput.value);
    const armor_class = parseInt(acInput.value);
    const initiative_bonus = parseInt(initiativeInput.value) || 0;
    const notes = notesInput.value.trim();
    const dnd_api_id = dndApiIdInput.value.trim();
    const allow_death_saves = allowDeathSavesInput ? allowDeathSavesInput.checked : false;

    // Validation
    if (!name) {
      Components.showToast('Monster name is required', 'error');
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
      encounter_id: this.encounterId,
      name,
      max_hp,
      armor_class,
      initiative_bonus,
      notes: notes || null,
      dnd_api_id: dnd_api_id || null,
      allow_death_saves
    };

    // For edits, include current_hp if provided
    if (monsterId && currentHpInput) {
      const current_hp = parseInt(currentHpInput.value);
      if (!isNaN(current_hp) && current_hp >= 0) {
        data.current_hp = current_hp;
      }
    }

    try {
      if (monsterId) {
        await API.monsters.update(monsterId, data);
        Components.showToast('Monster updated successfully', 'success');
      } else {
        await API.monsters.create(data);
        Components.showToast('Monster created successfully', 'success');
      }

      document.querySelector('.modal-overlay').remove();
      await this.loadMonsters();
    } catch (error) {
      Components.showToast(error.message || 'Failed to save monster', 'error');
    }
  },


  async deleteMonster(monsterId) {
    Components.confirm(
      'Are you sure you want to delete this monster?',
      async () => {
        try {
          await API.monsters.delete(monsterId);
          Components.showToast('Monster deleted successfully', 'success');
          await this.loadMonsters();
        } catch (error) {
          Components.showToast(error.message || 'Failed to delete monster', 'error');
        }
      }
    );
  }
};

// Initialize monsters when the encounter detail page is shown
document.addEventListener('DOMContentLoaded', () => {
  const encounterDetailPage = document.getElementById('encounter-detail-page');
  if (encounterDetailPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (encounterDetailPage.classList.contains('active')) {
            const encounterId = encounterDetailPage.dataset.encounterId;
            if (encounterId) {
              Monsters.init(encounterId);
            }
          }
        }
      });
    });

    observer.observe(encounterDetailPage, { attributes: true });
  }

  // Monster detail page event listeners
  const monsterDetailPage = document.getElementById('monster-detail-page');
  if (monsterDetailPage) {
    // Back button
    const backBtn = document.getElementById('back-to-encounter-detail-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        App.showPage('encounter-detail-page');
      });
    }

    // Add to encounter button
    const addBtn = document.getElementById('add-monster-to-encounter-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!Auth.isAdmin()) {
          Components.showToast('Only admins can add monsters', 'error');
          return;
        }

        const monsterDataStr = monsterDetailPage.dataset.monsterData;
        if (!monsterDataStr) {
          Components.showToast('No monster data available', 'error');
          return;
        }

        const encounterPage = document.getElementById('encounter-detail-page');
        const encounterId = encounterPage?.dataset.encounterId;
        if (!encounterId) {
          Components.showToast('No encounter selected', 'error');
          return;
        }

        try {
          const monsterData = JSON.parse(monsterDataStr);

          // Calculate initiative bonus from dexterity
          const dexMod = Math.floor((monsterData.dexterity - 10) / 2);

          // Create monster in database
          const data = {
            encounter_id: parseInt(encounterId),
            name: monsterData.name,
            max_hp: monsterData.hit_points,
            armor_class: monsterData.armor_class,
            initiative_bonus: dexMod,
            dnd_api_id: monsterData.index,
            notes: `${monsterData.size} ${monsterData.type} (CR ${monsterData.challenge_rating})`,
            allow_death_saves: false
          };

          await API.monsters.create(data);
          Components.showToast(`${monsterData.name} added to encounter!`, 'success');

          // Navigate back to encounter detail page
          App.showPage('encounter-detail-page');

          // Reload monsters list
          if (Monsters.encounterId) {
            await Monsters.loadMonsters();
          }
        } catch (error) {
          Components.showToast(error.message || 'Failed to add monster', 'error');
        }
      });
    }
  }
});
