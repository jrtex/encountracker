const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// All monster routes require authentication
router.use(authenticate);

// GET /api/monsters - List monsters in encounter
router.get('/', async (req, res) => {
  const { encounter_id } = req.query;

  res.json({
    success: true,
    message: 'Monster list endpoint (stub)',
    data: [
      {
        id: 1,
        encounter_id: encounter_id || 1,
        name: 'Goblin 1',
        dnd_api_id: 'goblin',
        max_hp: 7,
        current_hp: 7,
        armor_class: 15,
        initiative_bonus: 2,
        notes: 'Sneaky goblin'
      }
    ]
  });
});

// GET /api/monsters/search - Search D&D 5e API for monsters
router.get('/search', async (req, res) => {
  const { query } = req.query;

  res.json({
    success: true,
    message: 'D&D 5e API search endpoint (stub - integration not implemented)',
    data: [
      {
        index: 'goblin',
        name: 'Goblin',
        url: '/api/monsters/goblin'
      },
      {
        index: 'orc',
        name: 'Orc',
        url: '/api/monsters/orc'
      }
    ]
  });
});

// GET /api/monsters/dnd/:id - Get monster details from D&D 5e API
router.get('/dnd/:id', async (req, res) => {
  res.json({
    success: true,
    message: 'D&D 5e API monster detail endpoint (stub - integration not implemented)',
    data: {
      index: req.params.id,
      name: 'Goblin',
      size: 'Small',
      type: 'humanoid',
      hit_points: 7,
      armor_class: 15,
      challenge_rating: 0.25
    }
  });
});

// POST /api/monsters - Add monster to encounter (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Monster create endpoint (stub)',
    data: {
      id: 1,
      encounter_id: req.body.encounter_id || 1,
      name: req.body.name || 'New Monster',
      dnd_api_id: req.body.dnd_api_id || null,
      max_hp: req.body.max_hp || 10,
      current_hp: req.body.current_hp || 10,
      armor_class: req.body.armor_class || 10,
      initiative_bonus: req.body.initiative_bonus || 0,
      created_at: new Date().toISOString()
    }
  });
});

// PUT /api/monsters/:id - Update monster (admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Monster update endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      current_hp: req.body.current_hp || 10,
      updated_at: new Date().toISOString()
    }
  });
});

// DELETE /api/monsters/:id - Remove monster (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Monster delete endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      deleted: true
    }
  });
});

module.exports = router;
