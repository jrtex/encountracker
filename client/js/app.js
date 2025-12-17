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

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
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

    const campaignSelect = document.getElementById('nav-campaign-select');
    if (campaignSelect) {
      campaignSelect.addEventListener('change', async (e) => {
        await this.handleCampaignChange(e.target.value);
      });
    }

    // Update user info
    const user = Auth.getUser();
    const userInfo = document.getElementById('user-info');
    if (userInfo && user) {
      userInfo.textContent = `${user.username} (${user.role})`;
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
    const select = document.getElementById('nav-campaign-select');
    if (!select) return;

    const campaigns = CampaignContext.getAllCampaigns();
    const currentId = CampaignContext.getActiveCampaignId();

    select.innerHTML = campaigns.map(c =>
      `<option value="${c.id}" ${c.id == currentId ? 'selected' : ''}>${c.name}</option>`
    ).join('');
  },

  async handleCampaignChange(campaignId) {
    if (!campaignId) return;

    const activePage = document.querySelector('.page.active');

    // Navigate away from detail pages
    if (activePage && activePage.id === 'encounter-detail-page') {
      this.showPage('encounters-page');
    }

    await CampaignContext.setActiveCampaign(parseInt(campaignId));

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

    Components.showToast('Campaign switched', 'success');
  },

  handleNoCampaigns() {
    document.getElementById('main-nav').classList.remove('hidden');

    const select = document.getElementById('nav-campaign-select');
    if (select) {
      select.innerHTML = '<option value="">No campaigns available</option>';
      select.disabled = true;
    }

    // Update user info
    const user = Auth.getUser();
    const userInfo = document.getElementById('user-info');
    if (userInfo && user) {
      userInfo.textContent = `${user.username} (${user.role})`;
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
