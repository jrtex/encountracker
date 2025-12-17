// Settings Management
const Settings = {
  async init() {
    await this.renderCurrentCampaign();
    await this.renderAllCampaigns();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const newBtn = document.getElementById('settings-new-campaign-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        CampaignManager.showCampaignModal();
      });
    }

    // Subscribe to campaign changes
    CampaignContext.subscribe(() => {
      this.renderCurrentCampaign();
      this.renderAllCampaigns();
    });
  },

  renderCurrentCampaign() {
    const container = document.getElementById('current-campaign-info');
    if (!container) return;

    const campaign = CampaignContext.getActiveCampaign();

    if (!campaign) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <p>No campaign selected. Create a campaign to get started.</p>
        </div>
      `;
      return;
    }

    const createdDate = new Date(campaign.created_at).toLocaleDateString();

    container.innerHTML = `
      <div class="settings-card-row">
        <span class="settings-card-label">Name:</span>
        <span class="settings-card-value">${campaign.name}</span>
      </div>
      ${campaign.description ? `
        <div class="settings-card-row">
          <span class="settings-card-label">Description:</span>
          <span class="settings-card-value">${campaign.description}</span>
        </div>
      ` : ''}
      <div class="settings-card-row">
        <span class="settings-card-label">Created:</span>
        <span class="settings-card-value">${createdDate}</span>
      </div>
      ${Auth.isAdmin() ? `
        <div class="settings-card-row">
          <span class="settings-card-label">Actions:</span>
          <button class="btn btn-sm btn-primary" onclick="CampaignManager.showCampaignModal(${JSON.stringify(campaign).replace(/"/g, '&quot;')})">
            Edit Campaign
          </button>
        </div>
      ` : ''}
    `;
  },

  async renderAllCampaigns() {
    const container = document.getElementById('settings-campaigns-list');
    if (!container) return;

    const campaigns = CampaignContext.getAllCampaigns();
    const activeCampaignId = CampaignContext.getActiveCampaignId();

    if (campaigns.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <p>No campaigns yet. Create your first campaign to get started!</p>
        </div>
      `;
      return;
    }

    const campaignCards = campaigns.map(campaign => {
      const isActive = campaign.id === activeCampaignId;
      const card = CampaignManager.createCampaignCard(campaign);

      // Add active campaign styling
      if (isActive) {
        card.classList.add('settings-campaign-card', 'active-campaign');

        // Add active badge
        const badge = Components.createBadge('Active', 'success');
        badge.classList.add('settings-campaign-badge');
        card.querySelector('.card').appendChild(badge);
      } else {
        card.classList.add('settings-campaign-card');
      }

      return card;
    });

    container.innerHTML = '';
    campaignCards.forEach(card => container.appendChild(card));
  }
};

// Initialize settings when the settings page is shown
document.addEventListener('DOMContentLoaded', () => {
  const settingsPage = document.getElementById('settings-page');
  if (settingsPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (settingsPage.classList.contains('active')) {
            Settings.init();
          }
        }
      });
    });

    observer.observe(settingsPage, { attributes: true });
  }
});
