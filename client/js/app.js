// Sidebar Module
const Sidebar = {
  isOpen: false,
  isCollapsed: false,
  collapsibleState: { campaigns: true, encounters: true },

  init() {
    this.loadCollapsedState();
    this.loadCollapsibleState();
    this.setupEventListeners();
    this.renderCampaignsList();
    this.renderEncountersList();

    // Subscribe to campaign context changes
    CampaignContext.subscribe(() => {
      this.renderCampaignsList();
      this.renderEncountersList();
    });
  },

  loadCollapsedState() {
    const saved = localStorage.getItem('sidebarCollapsed');
    this.isCollapsed = saved === 'true';

    const appWrapper = document.getElementById('app-wrapper');
    if (appWrapper && this.isCollapsed) {
      appWrapper.classList.add('sidebar-collapsed');
    }
  },

  saveCollapsedState() {
    localStorage.setItem('sidebarCollapsed', this.isCollapsed.toString());
  },

  toggleCollapsed() {
    this.isCollapsed = !this.isCollapsed;
    this.saveCollapsedState();

    const appWrapper = document.getElementById('app-wrapper');
    if (appWrapper) {
      if (this.isCollapsed) {
        appWrapper.classList.add('sidebar-collapsed');
      } else {
        appWrapper.classList.remove('sidebar-collapsed');
      }
    }
  },

  loadCollapsibleState() {
    const saved = localStorage.getItem('sidebarCollapsibleState');
    this.collapsibleState = saved ? JSON.parse(saved) : {
      campaigns: true,
      encounters: true
    };

    // Apply saved state
    Object.keys(this.collapsibleState).forEach(key => {
      const header = document.querySelector(`[data-collapsible="${key}"]`);
      const content = document.getElementById(`${key}-section`);

      if (header && content) {
        if (this.collapsibleState[key]) {
          header.classList.add('expanded');
          content.classList.add('expanded');
        }
      }
    });
  },

  saveCollapsibleState() {
    localStorage.setItem('sidebarCollapsibleState', JSON.stringify(this.collapsibleState));
  },

  setupEventListeners() {
    // Collapsible headers
    document.querySelectorAll('[data-collapsible]').forEach(header => {
      header.addEventListener('click', () => {
        const key = header.getAttribute('data-collapsible');
        this.toggleSection(key);
      });
    });

    // Sidebar collapse button (desktop)
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        this.toggleCollapsed();
      });
    }

    // Sidebar toggle (mobile)
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        this.toggle();
      });
    }

    // Backdrop click to close
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.close();
      });
    }

    // New campaign button
    const newCampaignBtn = document.getElementById('sidebar-new-campaign-btn');
    if (newCampaignBtn) {
      newCampaignBtn.addEventListener('click', () => {
        if (typeof Campaigns !== 'undefined' && Campaigns.showCampaignModal) {
          Campaigns.showCampaignModal();
        }
        this.close();
      });
    }

    // New encounter button
    const newEncounterBtn = document.getElementById('sidebar-new-encounter-btn');
    if (newEncounterBtn) {
      newEncounterBtn.addEventListener('click', () => {
        if (typeof Encounters !== 'undefined' && Encounters.showEncounterModal) {
          Encounters.showEncounterModal();
        }
        this.close();
      });
    }

    // Sidebar navigation items
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        App.showPage(`${page}-page`);
        this.close();
      });
    });

    // Top bar settings link
    const settingsLink = document.querySelector('.top-bar-settings');
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        App.showPage('settings-page');
        this.close();
      });
    }
  },

  toggleSection(key) {
    const header = document.querySelector(`[data-collapsible="${key}"]`);
    const content = document.getElementById(`${key}-section`);

    if (!header || !content) return;

    this.collapsibleState[key] = !this.collapsibleState[key];
    this.saveCollapsibleState();

    if (this.collapsibleState[key]) {
      header.classList.add('expanded');
      content.classList.add('expanded');
    } else {
      header.classList.remove('expanded');
      content.classList.remove('expanded');
    }
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
    this.isOpen = true;
  },

  close() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
    this.isOpen = false;
  },

  async renderCampaignsList() {
    const container = document.getElementById('sidebar-campaigns-list');
    if (!container) return;

    container.innerHTML = '';

    const campaigns = CampaignContext.getAllCampaigns();
    const activeCampaignId = CampaignContext.getActiveCampaignId();

    if (campaigns.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      empty.textContent = 'No campaigns';
      container.appendChild(empty);
      return;
    }

    campaigns.forEach(campaign => {
      const item = document.createElement('a');
      item.className = 'sidebar-list-item';
      if (campaign.id === activeCampaignId) {
        item.classList.add('active');
      }
      item.textContent = campaign.name;
      item.title = campaign.name;

      item.addEventListener('click', async (e) => {
        e.preventDefault();
        await App.handleCampaignChange(campaign.id);
        this.close();
      });

      container.appendChild(item);
    });
  },

  async renderEncountersList() {
    const container = document.getElementById('sidebar-encounters-list');
    if (!container) return;

    container.innerHTML = '';

    const campaignId = CampaignContext.getActiveCampaignId();

    if (!campaignId) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      empty.textContent = 'No campaign selected';
      container.appendChild(empty);
      return;
    }

    try {
      const response = await API.encounters.getAll(campaignId);
      const encounters = response.data || [];

      // Filter to only pending/active encounters
      const activeEncounters = encounters.filter(e =>
        e.status === 'pending' || e.status === 'active'
      );

      if (activeEncounters.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sidebar-empty';
        empty.textContent = 'No encounters';
        container.appendChild(empty);
        return;
      }

      activeEncounters.forEach(encounter => {
        const item = document.createElement('a');
        item.className = 'sidebar-list-item';
        item.textContent = encounter.name;
        item.title = encounter.name;

        item.addEventListener('click', (e) => {
          e.preventDefault();

          // Navigate to encounter detail page
          if (typeof EncounterDetail !== 'undefined' && EncounterDetail.loadEncounter) {
            EncounterDetail.loadEncounter(encounter.id);
            App.showPage('encounter-detail-page');
          }

          this.close();
        });

        container.appendChild(item);
      });
    } catch (error) {
      console.error('Failed to load encounters:', error);
      const empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      empty.textContent = 'Failed to load';
      container.appendChild(empty);
    }
  }
};

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

    // Show top bar and sidebar
    document.getElementById('top-bar').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');

    // Initialize campaign context
    await CampaignContext.init();

    // Handle no campaigns scenario
    if (CampaignContext.getAllCampaigns().length === 0) {
      this.handleNoCampaigns();
      return;
    }

    // Initialize sidebar
    Sidebar.init();

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

  async handleCampaignChange(campaignId) {
    if (!campaignId) return;

    const activePage = document.querySelector('.page.active');

    // Navigate away from detail pages
    if (activePage && activePage.id === 'encounter-detail-page') {
      this.showPage('encounters-page');
    }

    await CampaignContext.setActiveCampaign(parseInt(campaignId));

    // Update sidebar to show new active campaign and encounters
    Sidebar.renderCampaignsList();
    Sidebar.renderEncountersList();

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
    // Show top bar and sidebar
    document.getElementById('top-bar').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');

    // Initialize sidebar (will show "No campaigns")
    Sidebar.init();

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
    // Hide top bar and sidebar
    const topBar = document.getElementById('top-bar');
    const sidebar = document.getElementById('sidebar');

    if (topBar) topBar.classList.add('hidden');
    if (sidebar) sidebar.style.display = 'none';

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

    // Update active state on sidebar navigation
    const pageName = pageId.replace('-page', '');

    // Remove active class from all sidebar nav items
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to the corresponding sidebar nav item
    const activeItem = document.querySelector(`.sidebar-nav-item[data-page="${pageName}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Update settings link styling in top bar
    const settingsLink = document.querySelector('.top-bar-settings');
    if (settingsLink) {
      if (pageName === 'settings') {
        settingsLink.style.fontWeight = '600';
        settingsLink.style.color = 'var(--primary-color)';
      } else {
        settingsLink.style.fontWeight = '500';
        settingsLink.style.color = 'var(--text-color)';
      }
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
