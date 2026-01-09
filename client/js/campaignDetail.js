/**
 * Campaign Detail Page Module
 * Handles viewing and editing individual campaign details
 */

const CampaignDetail = {
  currentCampaign: null,
  originalCampaignData: null,
  isEditMode: false,

  /**
   * Initialize the campaign detail page
   * @param {number} campaignId - ID of the campaign to display
   */
  async init(campaignId) {
    this.currentCampaign = null;
    this.originalCampaignData = null;
    this.isEditMode = false;

    await this.loadCampaign(campaignId);
    this.setupEventListeners();
  },

  /**
   * Load campaign data from the API
   * @param {number} campaignId - ID of the campaign to load
   */
  async loadCampaign(campaignId) {
    const contentEl = document.getElementById('campaign-detail-content');

    try {
      Components.showSpinner(contentEl);

      const response = await API.campaigns.getById(campaignId);
      this.currentCampaign = response.data;

      // Deep clone for cancel functionality
      this.originalCampaignData = JSON.parse(JSON.stringify(response.data));

      this.render();

      // Show edit button if admin
      if (Auth.isAdmin()) {
        this.showViewModeButtons();
      }
    } catch (error) {
      Components.hideSpinner(contentEl);

      if (error.message.includes('not found')) {
        contentEl.innerHTML = Components.createAlert(
          'This campaign has been deleted or you do not have permission to view it.',
          'error'
        ).outerHTML;

        setTimeout(() => {
          this.navigateBack();
        }, 2000);
      } else {
        contentEl.innerHTML = Components.createAlert(
          error.message || 'Failed to load campaign',
          'error'
        ).outerHTML;
      }
    }
  },

  /**
   * Setup event listeners for navigation and actions
   */
  setupEventListeners() {
    const backBtn = document.getElementById('campaign-detail-back-btn');
    if (backBtn) {
      backBtn.onclick = () => this.navigateBack();
    }

    this.setupActionButtons();
  },

  /**
   * Setup action button event listeners
   */
  setupActionButtons() {
    const editBtn = document.getElementById('campaign-edit-toggle-btn');
    const cancelBtn = document.getElementById('campaign-detail-cancel-btn');
    const saveBtn = document.getElementById('campaign-detail-save-btn');

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

  /**
   * Navigate back to campaigns list
   */
  navigateBack() {
    if (typeof Router !== 'undefined') {
      Router.navigate('/campaigns');
    } else {
      App.showPage('campaigns-page');
    }
  },

  /**
   * Orchestrate rendering based on current mode
   */
  render() {
    if (!this.currentCampaign) return;

    if (this.isEditMode) {
      this.renderEditMode();
    } else {
      this.renderViewMode();
    }
  },

  /**
   * Render campaign details in view mode
   */
  renderViewMode() {
    const contentEl = document.getElementById('campaign-detail-content');
    const c = this.currentCampaign;

    const activeCampaignId = CampaignContext.getActiveCampaignId();
    const isActiveCampaign = c.id === activeCampaignId;

    // Format dates
    const createdDate = new Date(c.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const updatedDate = new Date(c.updated_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Breadcrumb navigation
    const breadcrumb = `
      <div class="breadcrumb">
        <span>Campaigns</span>
        <i class="fas fa-chevron-right"></i>
        <span>${c.name}</span>
      </div>
    `;

    // Active campaign indicator
    const activeIndicator = isActiveCampaign
      ? '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Active Campaign</span>'
      : '';

    // Campaign information section
    const infoSection = `
      <div class="detail-section">
        <div class="detail-section-header">
          <h3>Campaign Information</h3>
          ${activeIndicator}
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <label>Campaign Name</label>
            <div class="stat-value">${c.name}</div>
          </div>
          <div class="stat-item">
            <label>Dungeon Master</label>
            <div class="stat-value">${c.dm_username || 'Unknown'}</div>
          </div>
          <div class="stat-item">
            <label>Created</label>
            <div class="stat-value">${createdDate}</div>
          </div>
          <div class="stat-item">
            <label>Last Updated</label>
            <div class="stat-value">${updatedDate}</div>
          </div>
        </div>
        ${c.description ? `
          <div class="stat-item full-width" style="margin-top: 1rem;">
            <label>Description</label>
            <div class="stat-value notes-display">${c.description}</div>
          </div>
        ` : `
          <div class="stat-item full-width" style="margin-top: 1rem;">
            <label>Description</label>
            <div class="stat-value text-muted">No description provided.</div>
          </div>
        `}
      </div>
    `;

    // Make Active Campaign button (only show if NOT active)
    const makeActiveSection = !isActiveCampaign ? `
      <div class="detail-section">
        <button id="make-active-campaign-btn" class="btn btn-primary">
          <i class="fas fa-star"></i> Make Active Campaign
        </button>
      </div>
    ` : '';

    contentEl.innerHTML = breadcrumb + infoSection + makeActiveSection;

    // Setup Make Active button if present
    if (!isActiveCampaign) {
      const makeActiveBtn = document.getElementById('make-active-campaign-btn');
      if (makeActiveBtn) {
        makeActiveBtn.onclick = () => this.makeActiveCampaign();
      }
    }
  },

  /**
   * Render campaign details in edit mode
   */
  renderEditMode() {
    const contentEl = document.getElementById('campaign-detail-content');
    const c = this.currentCampaign;

    const html = `
      <form id="campaign-detail-edit-form" onsubmit="return false;">
        <div class="detail-section">
          <h3>Campaign Information</h3>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-campaign-name">Campaign Name *</label>
              <input type="text" id="edit-campaign-name" class="form-control"
                     value="${c.name}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="edit-campaign-description">Description</label>
            <textarea id="edit-campaign-description" class="form-control" rows="4"
                      placeholder="Add a description for this campaign...">${c.description || ''}</textarea>
          </div>
        </div>
      </form>
    `;

    contentEl.innerHTML = html;
  },

  /**
   * Show view mode buttons (Edit button)
   */
  showViewModeButtons() {
    const editBtn = document.getElementById('campaign-edit-toggle-btn');
    const cancelBtn = document.getElementById('campaign-detail-cancel-btn');
    const saveBtn = document.getElementById('campaign-detail-save-btn');

    if (editBtn) editBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  },

  /**
   * Show edit mode buttons (Cancel and Save buttons)
   */
  showEditModeButtons() {
    const editBtn = document.getElementById('campaign-edit-toggle-btn');
    const cancelBtn = document.getElementById('campaign-detail-cancel-btn');
    const saveBtn = document.getElementById('campaign-detail-save-btn');

    if (editBtn) editBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (saveBtn) saveBtn.style.display = 'inline-block';
  },

  /**
   * Toggle between view and edit modes
   */
  toggleEditMode() {
    if (this.isEditMode) {
      this.cancelEdit();
    } else {
      this.isEditMode = true;
      this.showEditModeButtons();
      this.render();
    }
  },

  /**
   * Cancel editing and revert to original data
   */
  cancelEdit() {
    // Revert to original data
    this.currentCampaign = JSON.parse(JSON.stringify(this.originalCampaignData));
    this.isEditMode = false;
    this.showViewModeButtons();
    this.render();
  },

  /**
   * Save changes to the campaign
   */
  async saveChanges() {
    const name = document.getElementById('edit-campaign-name').value.trim();
    const description = document.getElementById('edit-campaign-description').value.trim();

    // Validation
    if (!name) {
      Components.showToast('Campaign name is required', 'error');
      return;
    }

    try {
      const data = {
        name: name,
        description: description || null
      };

      await API.campaigns.update(this.currentCampaign.id, data);
      Components.showToast('Campaign updated successfully', 'success');

      // Reload campaigns in context
      await CampaignContext.loadCampaigns();

      // If this is the active campaign, update it in context
      if (CampaignContext.getActiveCampaignId() == this.currentCampaign.id) {
        const updatedCampaign = CampaignContext.getAllCampaigns().find(
          c => c.id == this.currentCampaign.id
        );
        if (updatedCampaign) {
          CampaignContext.currentCampaign = updatedCampaign;
        }
      }

      // Notify listeners (updates sidebar, dropdown, etc.)
      CampaignContext.notifyListeners();

      this.isEditMode = false;
      this.showViewModeButtons();
      await this.loadCampaign(this.currentCampaign.id);
    } catch (error) {
      Components.showToast(error.message || 'Failed to save changes', 'error');
    }
  },

  /**
   * Make this campaign the active campaign
   */
  async makeActiveCampaign() {
    try {
      await CampaignContext.setActiveCampaign(this.currentCampaign.id);

      Components.showToast(
        `${this.currentCampaign.name} is now your active campaign`,
        'success'
      );

      // Update dropdown if it exists
      if (typeof App !== 'undefined' && App.renderCampaignDropdown) {
        App.renderCampaignDropdown();
      }

      // Re-render to hide the "Make Active" button
      this.render();
    } catch (error) {
      Components.showToast(
        error.message || 'Failed to set active campaign',
        'error'
      );
    }
  }
};

// Initialize on page load using MutationObserver
document.addEventListener('DOMContentLoaded', () => {
  const campaignDetailPage = document.getElementById('campaign-detail-page');
  if (campaignDetailPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (campaignDetailPage.classList.contains('active')) {
            const campaignId = campaignDetailPage.dataset.campaignId;
            if (campaignId) {
              CampaignDetail.init(campaignId);
            }
          }
        }
      });
    });

    observer.observe(campaignDetailPage, { attributes: true });
  }
});
