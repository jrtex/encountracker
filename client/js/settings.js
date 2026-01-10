// Settings Management
const Settings = {
  async init() {
    await this.renderAccountInfo();
    this.setupPreferencesHandlers();
    this.setupImportExportHandlers();
  },

  async renderAccountInfo() {
    const container = document.getElementById('account-info');
    if (!container) return;

    try {
      // Fetch full user data including created_at
      const response = await API.auth.getMe();
      const user = response.data;

      const createdDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString()
        : 'Unknown';

      const roleBadge = Components.createBadge(
        user.role.charAt(0).toUpperCase() + user.role.slice(1),
        user.role === 'admin' ? 'danger' : 'info'
      );

      container.innerHTML = `
        <div class="settings-card-row">
          <span class="settings-card-label">Username:</span>
          <span class="settings-card-value">${user.username}</span>
        </div>
        <div class="settings-card-row">
          <span class="settings-card-label">Email:</span>
          <span class="settings-card-value">${user.email}</span>
        </div>
        <div class="settings-card-row">
          <span class="settings-card-label">Role:</span>
          <span class="settings-card-value" id="role-badge-container"></span>
        </div>
        <div class="settings-card-row">
          <span class="settings-card-label">Member Since:</span>
          <span class="settings-card-value">${createdDate}</span>
        </div>
      `;

      // Insert badge using Component library
      const badgeContainer = container.querySelector('#role-badge-container');
      if (badgeContainer) {
        badgeContainer.appendChild(roleBadge);
      }
    } catch (error) {
      container.innerHTML = `
        <div class="alert alert-danger">
          <p>Failed to load account information.</p>
        </div>
      `;
      console.error('Error loading account info:', error);
    }
  },

  setupPreferencesHandlers() {
    const emailBtn = document.getElementById('email-notifications-btn');
    const pushBtn = document.getElementById('push-notifications-btn');

    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        Components.showToast('Email notification settings coming soon', 'info');
      });
    }

    if (pushBtn) {
      pushBtn.addEventListener('click', () => {
        Components.showToast('Push notification settings coming soon', 'info');
      });
    }
  },

  setupImportExportHandlers() {
    const exportCampaignBtn = document.getElementById('export-campaign-btn');
    const importCampaignBtn = document.getElementById('import-campaign-btn');
    const exportAllBtn = document.getElementById('export-all-btn');
    const importAllBtn = document.getElementById('import-all-btn');

    if (exportCampaignBtn) {
      exportCampaignBtn.addEventListener('click', () => {
        Components.showToast('Campaign export coming soon', 'info');
      });
    }

    if (importCampaignBtn) {
      importCampaignBtn.addEventListener('click', () => {
        Components.showToast('Campaign import coming soon', 'info');
      });
    }

    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => {
        Components.showToast('Full data export coming soon', 'info');
      });
    }

    if (importAllBtn) {
      importAllBtn.addEventListener('click', () => {
        Components.showToast('Full data import coming soon', 'info');
      });
    }
  }
};

// Initialize settings when the settings page is shown
document.addEventListener('DOMContentLoaded', () => {
  // Set up observer for when the page becomes active
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
