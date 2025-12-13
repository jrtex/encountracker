// Authentication Manager
const Auth = {
  currentUser: null,

  async init() {
    const token = API.getToken();
    if (token) {
      try {
        const response = await API.auth.getMe();
        this.currentUser = response.data;
        return true;
      } catch (error) {
        API.setToken(null);
        return false;
      }
    }
    return false;
  },

  async login(username, password) {
    try {
      const response = await API.auth.login(username, password);
      API.setToken(response.data.token);
      this.currentUser = response.data.user;
      return { success: true, user: this.currentUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async register(username, email, password) {
    try {
      const response = await API.auth.register(username, email, password);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async logout() {
    try {
      await API.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      API.setToken(null);
      this.currentUser = null;
    }
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  },

  getUser() {
    return this.currentUser;
  }
};
