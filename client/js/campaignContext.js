// Campaign Context - Global campaign state management
const CampaignContext = {
  currentCampaign: null,
  currentCampaignId: null,
  allCampaigns: [],
  listeners: [],

  async init() {
    await this.loadCampaigns();

    if (this.allCampaigns.length === 0) {
      this.currentCampaign = null;
      this.currentCampaignId = null;
      return;
    }

    // Try to restore from localStorage
    const savedCampaignId = localStorage.getItem('selectedCampaignId');

    if (savedCampaignId) {
      const savedCampaign = this.allCampaigns.find(c => c.id == savedCampaignId);
      if (savedCampaign) {
        this.currentCampaign = savedCampaign;
        this.currentCampaignId = savedCampaign.id;
        return;
      }
    }

    // Default to first campaign
    this.currentCampaign = this.allCampaigns[0];
    this.currentCampaignId = this.allCampaigns[0].id;
    localStorage.setItem('selectedCampaignId', this.currentCampaignId);
  },

  async loadCampaigns() {
    try {
      const response = await API.campaigns.getAll();
      this.allCampaigns = response.data || [];
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      this.allCampaigns = [];
    }
  },

  async setActiveCampaign(campaignId) {
    const campaign = this.allCampaigns.find(c => c.id == campaignId);

    if (!campaign) {
      console.error('Campaign not found:', campaignId);
      return;
    }

    this.currentCampaign = campaign;
    this.currentCampaignId = campaign.id;
    localStorage.setItem('selectedCampaignId', campaignId);

    this.notifyListeners();
  },

  getActiveCampaign() {
    return this.currentCampaign;
  },

  getActiveCampaignId() {
    return this.currentCampaignId;
  },

  getAllCampaigns() {
    return this.allCampaigns;
  },

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  },

  unsubscribe(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  },

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in campaign context listener:', error);
      }
    });
  }
};
