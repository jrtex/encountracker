// Campaign Manager - for creating/editing/deleting campaigns
const CampaignManager = {
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
          >${campaign ? campaign.description || '' : ''}</textarea>
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
        // Update existing campaign
        response = await API.campaigns.update(campaignId, data);
        Components.showToast('Campaign updated successfully', 'success');

        // Reload campaigns in context
        await CampaignContext.loadCampaigns();

        // If this is the active campaign, refresh it
        if (CampaignContext.getActiveCampaignId() == campaignId) {
          const updatedCampaign = CampaignContext.getAllCampaigns().find(c => c.id == campaignId);
          if (updatedCampaign) {
            CampaignContext.currentCampaign = updatedCampaign;
          }
        }

        // Notify listeners
        CampaignContext.notifyListeners();
      } else {
        // Create new campaign
        response = await API.campaigns.create(data);

        // Reload campaigns in context
        await CampaignContext.loadCampaigns();

        // Auto-select the new campaign
        if (response.data && response.data.id) {
          await CampaignContext.setActiveCampaign(response.data.id);

          // Update dropdown if it exists
          if (typeof App !== 'undefined' && App.renderCampaignDropdown) {
            App.renderCampaignDropdown();
          }

          // Enable dropdown if it was disabled (no campaigns scenario)
          const select = document.getElementById('nav-campaign-select');
          if (select && select.disabled) {
            select.disabled = false;
          }
        }
      }

      // Close modal
      document.querySelector('.modal-overlay').remove();
    } catch (error) {
      Components.showToast(error.message || 'Failed to save campaign', 'error');
    }
  },

  async deleteCampaign(campaignId) {
    Components.confirm(
      'Are you sure you want to delete this campaign? This will also delete all associated encounters and data.',
      async () => {
        try {
          const isActiveCampaign = CampaignContext.getActiveCampaignId() == campaignId;

          await API.campaigns.delete(campaignId);
          Components.showToast('Campaign deleted successfully', 'success');

          // Reload campaigns in context
          await CampaignContext.loadCampaigns();

          // If we deleted the active campaign, select another or handle no campaigns
          if (isActiveCampaign) {
            const allCampaigns = CampaignContext.getAllCampaigns();

            if (allCampaigns.length > 0) {
              // Select the first available campaign
              await CampaignContext.setActiveCampaign(allCampaigns[0].id);

              // Update dropdown
              if (typeof App !== 'undefined' && App.renderCampaignDropdown) {
                App.renderCampaignDropdown();
              }
            } else {
              // No campaigns left, handle no campaigns scenario
              CampaignContext.currentCampaign = null;
              CampaignContext.currentCampaignId = null;

              const select = document.getElementById('nav-campaign-select');
              if (select) {
                select.innerHTML = '<option value="">No campaigns available</option>';
                select.disabled = true;
              }

              // Show settings page
              if (typeof App !== 'undefined' && App.showPage) {
                App.showPage('settings-page');
              }

              Components.showToast('Please create a campaign to get started', 'info');
            }
          }

          // Notify listeners
          CampaignContext.notifyListeners();
        } catch (error) {
          Components.showToast(error.message || 'Failed to delete campaign', 'error');
        }
      }
    );
  }
};
