const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// All encounter routes require authentication
router.use(authenticate);

// GET /api/encounters - List encounters (optionally filtered by campaign)
router.get('/', async (req, res) => {
  const { campaign_id } = req.query;

  res.json({
    success: true,
    message: 'Encounter list endpoint (stub)',
    data: [
      {
        id: 1,
        campaign_id: campaign_id || 1,
        name: 'Goblin Ambush',
        description: 'A group of goblins attacks the party',
        difficulty: 'medium',
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ]
  });
});

// GET /api/encounters/:id - Get single encounter
router.get('/:id', async (req, res) => {
  res.json({
    success: true,
    message: 'Encounter detail endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      campaign_id: 1,
      name: 'Goblin Ambush',
      description: 'A group of goblins attacks the party',
      difficulty: 'medium',
      status: 'pending',
      created_at: new Date().toISOString()
    }
  });
});

// POST /api/encounters - Create encounter (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Encounter create endpoint (stub)',
    data: {
      id: 1,
      campaign_id: req.body.campaign_id || 1,
      name: req.body.name || 'New Encounter',
      description: req.body.description || '',
      difficulty: req.body.difficulty || 'medium',
      status: 'pending',
      created_at: new Date().toISOString()
    }
  });
});

// PUT /api/encounters/:id - Update encounter (admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Encounter update endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      name: req.body.name || 'Updated Encounter',
      status: req.body.status || 'pending',
      updated_at: new Date().toISOString()
    }
  });
});

// DELETE /api/encounters/:id - Delete encounter (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Encounter delete endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      deleted: true
    }
  });
});

module.exports = router;
