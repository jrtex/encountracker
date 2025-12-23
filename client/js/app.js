// Main Application
const App = {
  async init() {
    // Try to authenticate with existing token
    const isAuthenticated = await Auth.init();

    if (isAuthenticated) {
      this.showApp();
    } else {
      this.showLogin();
    }

    this.setupEventListeners();
  },

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister();
      });
    }

    // Show register link
    const showRegisterLink = document.getElementById('show-register');
    if (showRegisterLink) {
      showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showPage('register-page');
      });
    }

    // Show login link
    const showLoginLink = document.getElementById('show-login');
    if (showLoginLink) {
      showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showPage('login-page');
      });
    }

    // User avatar dropdown toggle
    const avatarBtn = document.getElementById('user-avatar-btn');
    const userDropdown = document.getElementById('user-dropdown');

    if (avatarBtn && userDropdown) {
      // Toggle dropdown on avatar click
      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && e.target !== avatarBtn) {
          userDropdown.classList.remove('show');
        }
      });
    }

    // Logout button in dropdown
    const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
    if (dropdownLogoutBtn) {
      dropdownLogoutBtn.addEventListener('click', async () => {
        await this.handleLogout();
      });
    }

    // Navigation links
    document.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.getAttribute('data-page');
        this.showPage(`${page}-page`);
      });
    });
  },

  async handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const result = await Auth.login(username, password);

    if (result.success) {
      Components.showToast('Login successful!', 'success');
      this.showApp();
    } else {
      Components.showToast(result.error, 'error');
    }
  },

  async handleRegister() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    const result = await Auth.register(username, email, password);

    if (result.success) {
      Components.showToast('Registration successful! Please login.', 'success');
      this.showPage('login-page');
      document.getElementById('register-form').reset();
    } else {
      Components.showToast(result.error, 'error');
    }
  },

  async handleLogout() {
    await Auth.logout();
    Components.showToast('Logged out successfully', 'info');
    this.showLogin();
  },

  async showApp() {
    // Hide auth pages
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('register-page').classList.remove('active');

    // Show navigation
    document.getElementById('main-nav').classList.remove('hidden');

    // Initialize campaign context
    await CampaignContext.init();

    // Handle no campaigns scenario
    if (CampaignContext.getAllCampaigns().length === 0) {
      this.handleNoCampaigns();
      return;
    }

    // Populate and setup dropdown
    this.renderCampaignDropdown();
    this.setupCampaignDropdown();

    // Update user info in avatar dropdown
    const user = Auth.getUser();
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownRoleBadge = document.getElementById('dropdown-role-badge');

    if (dropdownUsername && dropdownRoleBadge && user) {
      dropdownUsername.textContent = user.username;

      // Set role badge
      dropdownRoleBadge.textContent = user.role;
      dropdownRoleBadge.className = 'badge badge-' + (user.role === 'admin' ? 'warning' : 'info');
    }

    // Show/hide admin-only elements
    document.querySelectorAll('.admin-only').forEach(el => {
      if (Auth.isAdmin()) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Show dashboard
    this.showPage('dashboard-page');
  },

  renderCampaignDropdown() {
    const label = document.getElementById('nav-campaign-label');
    const dropdown = document.getElementById('nav-campaign-dropdown');
    if (!label || !dropdown) return;

    const campaigns = CampaignContext.getAllCampaigns();
    const currentId = CampaignContext.getActiveCampaignId();
    const currentCampaign = CampaignContext.getActiveCampaign();

    // Update button label
    label.textContent = currentCampaign ? currentCampaign.name : 'Select Campaign...';

    // Populate dropdown
    if (campaigns.length === 0) {
      dropdown.innerHTML = '<div class="campaign-dropdown-empty">No campaigns available</div>';
    } else {
      dropdown.innerHTML = campaigns.map(c =>
        `<button class="campaign-dropdown-item ${c.id == currentId ? 'active' : ''}" data-campaign-id="${c.id}">
          ${c.name}
        </button>`
      ).join('');

      // Add click handlers to campaign items
      dropdown.querySelectorAll('.campaign-dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          const campaignId = e.target.getAttribute('data-campaign-id');
          await this.handleCampaignChange(campaignId);
          dropdown.classList.remove('show'); // Close dropdown after selection
        });
      });
    }
  },

  setupCampaignDropdown() {
    const campaignBtn = document.getElementById('nav-campaign-btn');
    const campaignDropdown = document.getElementById('nav-campaign-dropdown');

    if (campaignBtn && campaignDropdown) {
      // Toggle dropdown on button click
      campaignBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        campaignDropdown.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!campaignDropdown.contains(e.target) && e.target !== campaignBtn) {
          campaignDropdown.classList.remove('show');
        }
      });
    }
  },

  async handleCampaignChange(campaignId) {
    if (!campaignId) return;

    const activePage = document.querySelector('.page.active');

    // Navigate away from detail pages
    if (activePage && activePage.id === 'encounter-detail-page') {
      this.showPage('encounters-page');
    }

    await CampaignContext.setActiveCampaign(parseInt(campaignId));

    // Update campaign dropdown to show new campaign name
    this.renderCampaignDropdown();

    // Reload active page
    if (activePage) {
      const pageId = activePage.id;
      if (pageId === 'encounters-page' && typeof Encounters !== 'undefined') {
        await Encounters.init();
      } else if (pageId === 'players-page' && typeof Players !== 'undefined') {
        await Players.init();
      } else if (pageId === 'dashboard-page' && typeof Initiative !== 'undefined') {
        await Initiative.init();
      }
    }
  },

  handleNoCampaigns() {
    document.getElementById('main-nav').classList.remove('hidden');

    const label = document.getElementById('nav-campaign-label');
    const dropdown = document.getElementById('nav-campaign-dropdown');

    if (label) {
      label.textContent = 'No campaigns available';
    }

    if (dropdown) {
      dropdown.innerHTML = '<div class="campaign-dropdown-empty">No campaigns available</div>';
    }

    // Update user info in avatar dropdown
    const user = Auth.getUser();
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownRoleBadge = document.getElementById('dropdown-role-badge');

    if (dropdownUsername && dropdownRoleBadge && user) {
      dropdownUsername.textContent = user.username;

      // Set role badge
      dropdownRoleBadge.textContent = user.role;
      dropdownRoleBadge.className = 'badge badge-' + (user.role === 'admin' ? 'warning' : 'info');
    }

    // Show/hide admin-only elements
    document.querySelectorAll('.admin-only').forEach(el => {
      if (Auth.isAdmin()) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    this.showPage('settings-page');
    Components.showToast('Please create a campaign to get started', 'info');
  },

  showLogin() {
    // Hide navigation
    document.getElementById('main-nav').classList.add('hidden');

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    // Show login page
    document.getElementById('login-page').classList.add('active');
  },

  showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    // Show selected page
    const page = document.getElementById(pageId);
    if (page) {
      page.classList.add('active');
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Initialize Initiative Tracker when dashboard becomes active
  const dashboardPage = document.getElementById('dashboard-page');
  if (dashboardPage) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (dashboardPage.classList.contains('active')) {
            Initiative.init();
          }
        }
      });
    });
    observer.observe(dashboardPage, { attributes: true });
  }
});
