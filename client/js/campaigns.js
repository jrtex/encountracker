// Campaign Management
const Campaigns = {
  currentCampaigns: [],

  async init() {
    await this.loadCampaigns();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const newCampaignBtn = document.getElementById('new-campaign-btn');
    if (newCampaignBtn) {
      newCampaignBtn.addEventListener('click', () => {
        this.showCampaignModal();
      });
    }
  },

  async loadCampaigns() {
    const listContainer = document.getElementById('campaigns-list');
    if (!listContainer) return;

    Components.showSpinner(listContainer);

    try {
      const response = await API.campaigns.getAll();
      this.currentCampaigns = response.data || [];
      this.renderCampaigns();
    } catch (error) {
      Components.showToast(error.message || 'Failed to load campaigns', 'error');
      listContainer.innerHTML = Components.createAlert(
        'Failed to load campaigns. Please try again.',
        'error'
      ).outerHTML;
    } finally {
      Components.hideSpinner(listContainer);
    }
  },

  renderCampaigns() {
    const listContainer = document.getElementById('campaigns-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (this.currentCampaigns.length === 0) {
      const alert = Components.createAlert(
        'No campaigns yet. Create your first campaign to get started!',
        'info'
      );
      listContainer.appendChild(alert);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'campaign-grid';

    this.currentCampaigns.forEach(campaign => {
      const card = this.createCampaignCard(campaign);
      grid.appendChild(card);
    });

    listContainer.appendChild(grid);
  },

  createCampaignCard(campaign) {
    const createdDate = new Date(campaign.created_at).toLocaleDateString();

    const content = `
      <p class="campaign-description">${campaign.description || 'No description provided.'}</p>
      <p class="campaign-meta">
        <small>Created: ${createdDate}</small>
      </p>
    `;

    const footer = document.createElement('div');
    footer.className = 'card-actions';

    if (Auth.isAdmin()) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.showCampaignModal(campaign));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.deleteCampaign(campaign.id));

      footer.appendChild(editBtn);
      footer.appendChild(deleteBtn);
    }

    return Components.createCard(campaign.name, content, footer);
  },

  showCampaignModal(campaign = null) {
    const isEdit = !!campaign;
    const title = isEdit ? 'Edit Campaign' : 'New Campaign';

    const content = `
      <form id="campaign-form" onsubmit="return false;">
        <div class="form-group">
          <label for="campaign-name">Campaign Name *</label>
          <input
            type="text"
            id="campaign-name"
            class="form-control"
            value="${campaign ? campaign.name : ''}"
            required
          >
        </div>
        <div class="form-group">
          <label for="campaign-description">Description</label>
          <textarea
            id="campaign-description"
            class="form-control"
            rows="4"
          >${campaign ? campaign.description : ''}</textarea>
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
        handler: () => this.saveCampaign(campaign?.id),
        closeOnClick: false
      }
    ];

    Components.showModal(title, content, actions);
  },

  async saveCampaign(campaignId = null) {
    const nameInput = document.getElementById('campaign-name');
    const descriptionInput = document.getElementById('campaign-description');

    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!name) {
      Components.showToast('Campaign name is required', 'error');
      return;
    }

    const data = { name, description };

    try {
      let response;
      if (campaignId) {
        response = await API.campaigns.update(campaignId, data);
        Components.showToast('Campaign updated successfully', 'success');
      } else {
        response = await API.campaigns.create(data);
        Components.showToast('Campaign created successfully', 'success');
      }

      document.querySelector('.modal-overlay').remove();
      await this.loadCampaigns();
    } catch (error) {
      Components.showToast(error.message || 'Failed to save campaign', 'error');
    }
  },

  async deleteCampaign(campaignId) {
    Components.confirm(
      'Are you sure you want to delete this campaign? This will also delete all associated encounters and data.',
      async () => {
        try {
          await API.campaigns.delete(campaignId);
          Components.showToast('Campaign deleted successfully', 'success');
          await this.loadCampaigns();
        } catch (error) {
          Components.showToast(error.message || 'Failed to delete campaign', 'error');
        }
      }
    );
  }
};

// Initialize campaigns when the campaigns page is shown
document.addEventListener('DOMContentLoaded', () => {
  const campaignsPage = document.getElementById('campaigns-page');
  if (campaignsPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (campaignsPage.classList.contains('active')) {
            Campaigns.init();
          }
        }
      });
    });

    observer.observe(campaignsPage, { attributes: true });
  }
});
