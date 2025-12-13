const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// All campaign routes require authentication
router.use(authenticate);

// GET /api/campaigns - List all campaigns
router.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Campaign list endpoint (stub)',
    data: [
      {
        id: 1,
        name: 'Example Campaign',
        description: 'This is a stub response',
        dm_user_id: req.user.id,
        created_at: new Date().toISOString()
      }
    ]
  });
});

// GET /api/campaigns/:id - Get single campaign
router.get('/:id', async (req, res) => {
  res.json({
    success: true,
    message: 'Campaign detail endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      name: 'Example Campaign',
      description: 'This is a stub response',
      dm_user_id: req.user.id,
      created_at: new Date().toISOString()
    }
  });
});

// POST /api/campaigns - Create campaign (admin only)
router.post('/', authorize('admin'), async (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Campaign create endpoint (stub)',
    data: {
      id: 1,
      name: req.body.name || 'New Campaign',
      description: req.body.description || '',
      dm_user_id: req.user.id,
      created_at: new Date().toISOString()
    }
  });
});

// PUT /api/campaigns/:id - Update campaign (admin only)
router.put('/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Campaign update endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      name: req.body.name || 'Updated Campaign',
      description: req.body.description || '',
      dm_user_id: req.user.id,
      updated_at: new Date().toISOString()
    }
  });
});

// DELETE /api/campaigns/:id - Delete campaign (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Campaign delete endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      deleted: true
    }
  });
});

module.exports = router;
