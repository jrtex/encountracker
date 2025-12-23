// Encounter Management
const Encounters = {
  currentEncounters: [],

  async init() {
    await this.loadEncounters();
    this.setupEventListeners();
    CampaignContext.subscribe(() => this.loadEncounters());
  },

  setupEventListeners() {
    const newEncounterBtn = document.getElementById('new-encounter-btn');
    if (newEncounterBtn) {
      newEncounterBtn.addEventListener('click', () => {
        this.showEncounterModal();
      });
    }
  },

  async loadEncounters() {
    const listContainer = document.getElementById('encounters-list');
    if (!listContainer) return;

    const campaignId = CampaignContext.getActiveCampaignId();

    if (!campaignId) {
      listContainer.innerHTML = Components.createAlert(
        'No campaign selected. Please select a campaign from the navigation bar.',
        'warning'
      ).outerHTML;
      return;
    }

    Components.showSpinner(listContainer);

    try {
      const response = await API.encounters.getAll(campaignId);
      this.currentEncounters = response.data || [];
      this.renderEncounters();
    } catch (error) {
      Components.showToast(error.message || 'Failed to load encounters', 'error');
      listContainer.innerHTML = Components.createAlert(
        'Failed to load encounters. Please try again.',
        'error'
      ).outerHTML;
    } finally {
      Components.hideSpinner(listContainer);
    }
  },

  renderEncounters() {
    const listContainer = document.getElementById('encounters-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (this.currentEncounters.length === 0) {
      const alert = Components.createAlert(
        'No encounters yet. Create your first encounter to get started!',
        'info'
      );
      listContainer.appendChild(alert);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'encounter-grid';

    this.currentEncounters.forEach(encounter => {
      const card = this.createEncounterCard(encounter);
      grid.appendChild(card);
    });

    listContainer.appendChild(grid);
  },

  createEncounterCard(encounter) {
    const createdDate = new Date(encounter.created_at).toLocaleDateString();
    const difficultyBadge = Components.createBadge(
      encounter.difficulty || 'medium',
      this.getDifficultyBadgeType(encounter.difficulty)
    );
    const statusBadge = Components.createBadge(
      encounter.status || 'pending',
      this.getStatusBadgeType(encounter.status)
    );

    const content = `
      <p class="encounter-campaign">
        <small><strong>Campaign:</strong> ${encounter.campaign_name || 'Unknown'}</small>
      </p>
      <p class="encounter-description">${encounter.description || 'No description provided.'}</p>
      <div class="encounter-badges">
        ${difficultyBadge.outerHTML}
        ${statusBadge.outerHTML}
      </div>
      <p class="encounter-meta">
        <small>Created: ${createdDate}</small>
      </p>
    `;

    const footer = document.createElement('div');
    footer.className = 'card-actions';

    // View Details button (visible to all users)
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-primary';
    viewBtn.textContent = 'View Details';
    viewBtn.addEventListener('click', () => {
      const detailPage = document.getElementById('encounter-detail-page');
      detailPage.dataset.encounterId = encounter.id;
      App.showPage('encounter-detail-page');
    });
    footer.appendChild(viewBtn);

    if (Auth.isAdmin()) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.showEncounterModal(encounter));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.deleteEncounter(encounter.id));

      footer.appendChild(editBtn);
      footer.appendChild(deleteBtn);
    }

    const card = Components.createCard(encounter.name, content, footer);

    // Make the card header (title) clickable
    const cardHeader = card.querySelector('.card-header');
    if (cardHeader) {
      cardHeader.classList.add('clickable');
      cardHeader.style.cursor = 'pointer';
      cardHeader.addEventListener('click', () => {
        const detailPage = document.getElementById('encounter-detail-page');
        detailPage.dataset.encounterId = encounter.id;
        App.showPage('encounter-detail-page');
      });
    }

    return card;
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

  showEncounterModal(encounter = null) {
    const isEdit = !!encounter;
    const title = isEdit ? 'Edit Encounter' : 'New Encounter';

    const campaigns = CampaignContext.getAllCampaigns();
    const activeCampaignId = CampaignContext.getActiveCampaignId();
    const selectedCampaignId = encounter ? encounter.campaign_id : activeCampaignId;

    const campaignOptions = campaigns.map(c =>
      `<option value="${c.id}" ${c.id == selectedCampaignId ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const content = `
      <form id="encounter-form" onsubmit="return false;">
        <div class="form-group">
          <label for="encounter-campaign">Campaign *</label>
          <select id="encounter-campaign" class="form-control" required ${isEdit ? 'disabled' : ''}>
            <option value="">Select a campaign</option>
            ${campaignOptions}
          </select>
          ${isEdit ? `<input type="hidden" id="encounter-campaign-hidden" value="${encounter.campaign_id}">` : ''}
        </div>
        <div class="form-group">
          <label for="encounter-name">Encounter Name *</label>
          <input
            type="text"
            id="encounter-name"
            class="form-control"
            value="${encounter ? encounter.name : ''}"
            required
          >
        </div>
        <div class="form-group">
          <label for="encounter-description">Description</label>
          <textarea
            id="encounter-description"
            class="form-control"
            rows="3"
          >${encounter ? encounter.description : ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="encounter-difficulty">Difficulty</label>
            <select id="encounter-difficulty" class="form-control">
              <option value="easy" ${encounter && encounter.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
              <option value="medium" ${!encounter || encounter.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="hard" ${encounter && encounter.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
              <option value="deadly" ${encounter && encounter.difficulty === 'deadly' ? 'selected' : ''}>Deadly</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const actions = [
      {
        id: 'cancel',
        label: 'Cancel',
        class: 'btn-secondary',
        handler: () => {} // Empty handler allows modal to close automatically
      },
      {
        id: 'save',
        label: isEdit ? 'Update' : 'Create',
        class: 'btn-primary',
        handler: () => this.saveEncounter(encounter?.id),
        closeOnClick: false
      }
    ];

    Components.showModal(title, content, actions);
  },

  async saveEncounter(encounterId = null) {
    const campaignInput = document.getElementById('encounter-campaign');
    const campaignHiddenInput = document.getElementById('encounter-campaign-hidden');
    const nameInput = document.getElementById('encounter-name');
    const descriptionInput = document.getElementById('encounter-description');
    const difficultyInput = document.getElementById('encounter-difficulty');

    const campaign_id = campaignHiddenInput ? campaignHiddenInput.value : campaignInput.value;
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    const difficulty = difficultyInput.value;

    if (!campaign_id) {
      Components.showToast('Please select a campaign', 'error');
      return;
    }

    if (!name) {
      Components.showToast('Encounter name is required', 'error');
      return;
    }

    const data = { campaign_id: parseInt(campaign_id), name, description, difficulty };

    try {
      if (encounterId) {
        await API.encounters.update(encounterId, data);
        Components.showToast('Encounter updated successfully', 'success');
      } else {
        await API.encounters.create(data);
        Components.showToast('Encounter created successfully', 'success');
      }

      document.querySelector('.modal-overlay').remove();
      await this.loadEncounters();
    } catch (error) {
      Components.showToast(error.message || 'Failed to save encounter', 'error');
    }
  },

  async deleteEncounter(encounterId) {
    Components.confirm(
      'Are you sure you want to delete this encounter? This will also delete all associated monsters and combat data.',
      async () => {
        try {
          await API.encounters.delete(encounterId);
          Components.showToast('Encounter deleted successfully', 'success');
          await this.loadEncounters();
        } catch (error) {
          Components.showToast(error.message || 'Failed to delete encounter', 'error');
        }
      }
    );
  }
};

// Initialize encounters when the encounters page is shown
document.addEventListener('DOMContentLoaded', () => {
  const encountersPage = document.getElementById('encounters-page');
  if (encountersPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (encountersPage.classList.contains('active')) {
            Encounters.init();
          }
        }
      });
    });

    observer.observe(encountersPage, { attributes: true });
  }
});
