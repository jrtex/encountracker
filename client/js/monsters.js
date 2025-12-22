// Monster Management
const Monsters = {
  currentMonsters: [],
  currentEncounter: null,
  encounterId: null,

  async init(encounterId) {
    this.encounterId = encounterId;
    await this.loadEncounter();
    await this.loadMonsters();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const addMonsterBtn = document.getElementById('add-monster-btn');
    if (addMonsterBtn) {
      addMonsterBtn.addEventListener('click', () => {
        this.showMonsterModal();
      });
    }

    const backBtn = document.getElementById('back-to-encounters-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        App.showPage('encounters-page');
      });
    }

    this.setupStartCombatButton();
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
      this.renderEncounterInfo();
    } catch (error) {
      console.error('Failed to load encounter:', error);
      Components.showToast(error.message || 'Failed to load encounter', 'error');
    }
  },

  renderEncounterInfo() {
    const titleEl = document.getElementById('encounter-detail-title');
    const infoEl = document.getElementById('encounter-detail-info');

    if (!this.currentEncounter) return;

    if (titleEl) {
      titleEl.textContent = this.currentEncounter.name;
    }

    if (infoEl) {
      const difficultyBadge = Components.createBadge(
        this.currentEncounter.difficulty || 'medium',
        this.getDifficultyBadgeType(this.currentEncounter.difficulty)
      );
      const statusBadge = Components.createBadge(
        this.currentEncounter.status || 'pending',
        this.getStatusBadgeType(this.currentEncounter.status)
      );

      infoEl.innerHTML = `
        <div class="encounter-info-card">
          <p><strong>Campaign:</strong> ${this.currentEncounter.campaign_name || 'Unknown'}</p>
          ${this.currentEncounter.description ? `<p><strong>Description:</strong> ${this.currentEncounter.description}</p>` : ''}
          <div class="encounter-badges">
            ${difficultyBadge.outerHTML}
            ${statusBadge.outerHTML}
          </div>
        </div>
      `;
    }

    // Setup Start Combat button visibility
    this.setupStartCombatButton();
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
    const container = document.getElementById('monsters-container');
    if (!container) return;

    Components.showSpinner(container);

    try {
      const response = await API.monsters.getAll(this.encounterId);
      this.currentMonsters = response.data || [];
      this.renderMonsters();
    } catch (error) {
      Components.showToast(error.message || 'Failed to load monsters', 'error');
      container.innerHTML = Components.createAlert(
        'Failed to load monsters. Please try again.',
        'error'
      ).outerHTML;
    } finally {
      Components.hideSpinner(container);
    }
  },

  renderMonsters() {
    const container = document.getElementById('monsters-container');
    if (!container) return;

    container.innerHTML = '';

    if (this.currentMonsters.length === 0) {
      const alert = Components.createAlert(
        'No monsters yet. Add your first monster to this encounter!',
        'info'
      );
      container.appendChild(alert);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'monster-grid';

    this.currentMonsters.forEach(monster => {
      const card = this.createMonsterCard(monster);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  },

  createMonsterCard(monster) {
    const hpBadge = this.getHPBadge(monster);

    const content = `
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
    `;

    const footer = document.createElement('div');
    footer.className = 'card-actions';

    if (Auth.isAdmin()) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.showEditMonsterModal(monster));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.deleteMonster(monster.id));

      footer.appendChild(editBtn);
      footer.appendChild(deleteBtn);
    }

    const card = Components.createCard(monster.name, content, footer);

    // Add HP status class to card
    const hpPercent = (monster.current_hp / monster.max_hp) * 100;
    if (hpPercent <= 25) {
      card.classList.add('monster-card-critical');
    } else if (hpPercent <= 75) {
      card.classList.add('monster-card-wounded');
    }

    return card;
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

  showEditMonsterModal(monster) {
    const title = `Edit Monster: ${monster.name}`;

    const content = `
      <div class="monster-edit-header" style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #dee2e6;">
        <h4 style="margin: 0;">${monster.name}</h4>
        ${monster.dnd_api_id ? `<p class="monster-source"><small>Source: D&D 5e API (${monster.dnd_api_id})</small></p>` : ''}
      </div>

      <form id="monster-edit-form" onsubmit="return false;">
        <div class="form-row">
          <div class="form-group">
            <label for="edit-current-hp">Current HP *</label>
            <input
              type="number"
              id="edit-current-hp"
              class="form-control"
              value="${monster.current_hp}"
              min="0"
              required
            >
          </div>
          <div class="form-group">
            <label for="edit-max-hp">Max HP *</label>
            <input
              type="number"
              id="edit-max-hp"
              class="form-control"
              value="${monster.max_hp}"
              min="1"
              required
            >
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-ac">Armor Class *</label>
            <input
              type="number"
              id="edit-ac"
              class="form-control"
              value="${monster.armor_class}"
              min="0"
              required
            >
          </div>
          <div class="form-group">
            <label for="edit-initiative">Initiative Bonus</label>
            <input
              type="number"
              id="edit-initiative"
              class="form-control"
              value="${monster.initiative_bonus}"
            >
          </div>
        </div>
        <div class="form-group">
          <label for="edit-notes">Notes</label>
          <textarea
            id="edit-notes"
            class="form-control"
            rows="3"
            placeholder="Special abilities, tactics, etc."
          >${monster.notes || ''}</textarea>
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
        label: 'Update Monster',
        class: 'btn-primary',
        handler: () => this.saveEditMonster(monster),
        closeOnClick: false
      }
    ];

    Components.showModal(title, content, actions);
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

    resultsContainer.innerHTML = '<div class="spinner">Searching...</div>';

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

    resultsContainer.innerHTML = '<div class="spinner">Loading monster details...</div>';

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
          <button class="btn btn-sm btn-secondary mb-2" id="back-to-search">← Back to Search</button>

          <div class="form-group" style="margin-top: 1rem;">
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
          <button class="btn btn-sm btn-secondary mt-2" id="back-to-search-error">← Back to Search</button>
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
          actions: actions
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

    // Store monster ID for later use
    detailPage.dataset.monsterId = monsterId;

    // Show loading state
    contentEl.innerHTML = '<div class="spinner" style="text-align: center; padding: 2rem;">Loading monster details...</div>';
    App.showPage('monster-detail-page');

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

    const name = nameInput.value.trim();
    const max_hp = parseInt(maxHpInput.value);
    const armor_class = parseInt(acInput.value);
    const initiative_bonus = parseInt(initiativeInput.value) || 0;
    const notes = notesInput.value.trim();
    const dnd_api_id = dndApiIdInput.value.trim();

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
      dnd_api_id: dnd_api_id || null
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

  async saveEditMonster(monster) {
    const currentHp = parseInt(document.getElementById('edit-current-hp').value);
    const maxHp = parseInt(document.getElementById('edit-max-hp').value);
    const armorClass = parseInt(document.getElementById('edit-ac').value);
    const initiativeBonus = parseInt(document.getElementById('edit-initiative').value) || 0;
    const notes = document.getElementById('edit-notes').value.trim();

    // Validation
    if (isNaN(maxHp) || maxHp < 1) {
      Components.showToast('Max HP must be at least 1', 'error');
      return;
    }

    if (isNaN(currentHp) || currentHp < 0) {
      Components.showToast('Current HP must be non-negative', 'error');
      return;
    }

    if (isNaN(armorClass) || armorClass < 0) {
      Components.showToast('Armor class must be non-negative', 'error');
      return;
    }

    const data = {
      encounter_id: this.encounterId,
      name: monster.name,
      max_hp: maxHp,
      current_hp: currentHp,
      armor_class: armorClass,
      initiative_bonus: initiativeBonus,
      notes: notes || null,
      dnd_api_id: monster.dnd_api_id || null
    };

    try {
      await API.monsters.update(monster.id, data);
      Components.showToast('Monster updated successfully', 'success');
      document.querySelector('.modal-overlay').remove();
      await this.loadMonsters();
    } catch (error) {
      Components.showToast(error.message || 'Failed to update monster', 'error');
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
            notes: `${monsterData.size} ${monsterData.type} (CR ${monsterData.challenge_rating})`
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
