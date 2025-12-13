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

  showApp() {
    // Hide auth pages
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('register-page').classList.remove('active');

    // Show navigation
    document.getElementById('main-nav').classList.remove('hidden');

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
});
