// API Client
const API = {
  baseURL: '/api',
  token: null,

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  // Auth endpoints
  auth: {
    login(username, password) {
      return API.request('/auth/login', {
        method: 'POST',
        body: { username, password }
      });
    },

    register(username, email, password) {
      return API.request('/auth/register', {
        method: 'POST',
        body: { username, email, password }
      });
    },

    getMe() {
      return API.request('/auth/me');
    },

    logout() {
      return API.request('/auth/logout', { method: 'POST' });
    }
  },

  // Campaign endpoints
  campaigns: {
    getAll() {
      return API.request('/campaigns');
    },

    getById(id) {
      return API.request(`/campaigns/${id}`);
    },

    create(data) {
      return API.request('/campaigns', {
        method: 'POST',
        body: data
      });
    },

    update(id, data) {
      return API.request(`/campaigns/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    delete(id) {
      return API.request(`/campaigns/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Encounter endpoints
  encounters: {
    getAll(campaignId) {
      const query = campaignId ? `?campaign_id=${campaignId}` : '';
      return API.request(`/encounters${query}`);
    },

    getById(id) {
      return API.request(`/encounters/${id}`);
    },

    create(data) {
      return API.request('/encounters', {
        method: 'POST',
        body: data
      });
    },

    update(id, data) {
      return API.request(`/encounters/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    delete(id) {
      return API.request(`/encounters/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Player endpoints
  players: {
    getAll(campaignId) {
      const query = campaignId ? `?campaign_id=${campaignId}` : '';
      return API.request(`/players${query}`);
    },

    getById(id) {
      return API.request(`/players/${id}`);
    },

    create(data) {
      return API.request('/players', {
        method: 'POST',
        body: data
      });
    },

    update(id, data) {
      return API.request(`/players/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    delete(id) {
      return API.request(`/players/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Monster endpoints
  monsters: {
    getAll(encounterId) {
      const query = encounterId ? `?encounter_id=${encounterId}` : '';
      return API.request(`/monsters${query}`);
    },

    search(query) {
      return API.request(`/monsters/search?query=${query}`);
    },

    getFromDndAPI(id) {
      return API.request(`/monsters/dnd/${id}`);
    },

    create(data) {
      return API.request('/monsters', {
        method: 'POST',
        body: data
      });
    },

    update(id, data) {
      return API.request(`/monsters/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    delete(id) {
      return API.request(`/monsters/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Combat endpoints
  combat: {
    getInitiative(encounterId) {
      return API.request(`/combat/${encounterId}/initiative`);
    },

    startCombat(encounterId) {
      return API.request(`/combat/${encounterId}/start`, {
        method: 'POST'
      });
    },

    nextTurn(encounterId) {
      return API.request(`/combat/${encounterId}/next-turn`, {
        method: 'POST'
      });
    },

    updateInitiative(id, data) {
      return API.request(`/combat/initiative/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    endCombat(encounterId) {
      return API.request(`/combat/${encounterId}/end`, {
        method: 'POST'
      });
    }
  },

  // Import/Export endpoints
  importExport: {
    exportCampaign(campaignId) {
      return API.request(`/import-export/export/${campaignId}`, {
        method: 'POST'
      });
    },

    importCampaign(data) {
      return API.request('/import-export/import', {
        method: 'POST',
        body: data
      });
    },

    getSchema() {
      return API.request('/import-export/schema');
    }
  }
};
