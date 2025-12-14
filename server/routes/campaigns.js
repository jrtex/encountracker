const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const database = require('../utils/database');

// All campaign routes require authentication
router.use(authenticate);

// GET /api/campaigns - List all campaigns
router.get('/', async (req, res) => {
  const campaigns = await database.all(
    'SELECT * FROM campaigns WHERE dm_user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );

  res.json({
    success: true,
    data: campaigns
  });
});

// GET /api/campaigns/:id - Get single campaign
router.get('/:id', async (req, res) => {
  const campaign = await database.get(
    'SELECT * FROM campaigns WHERE id = ? AND dm_user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found'
    });
  }

  res.json({
    success: true,
    data: campaign
  });
});

// POST /api/campaigns - Create campaign (admin only)
router.post(
  '/',
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('description').optional().trim()
  ],
  validate,
  async (req, res) => {
    const { name, description } = req.body;

    const result = await database.run(
      'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
      [name, description || '', req.user.id]
    );

    const campaign = await database.get(
      'SELECT * FROM campaigns WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign
    });
  }
);

// PUT /api/campaigns/:id - Update campaign (admin only)
router.put(
  '/:id',
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('description').optional().trim()
  ],
  validate,
  async (req, res) => {
    const { name, description } = req.body;

    const campaign = await database.get(
      'SELECT * FROM campaigns WHERE id = ? AND dm_user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    await database.run(
      'UPDATE campaigns SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || '', req.params.id]
    );

    const updatedCampaign = await database.get(
      'SELECT * FROM campaigns WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: updatedCampaign
    });
  }
);

// DELETE /api/campaigns/:id - Delete campaign (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  const campaign = await database.get(
    'SELECT * FROM campaigns WHERE id = ? AND dm_user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found'
    });
  }

  await database.run('DELETE FROM campaigns WHERE id = ?', [req.params.id]);

  res.json({
    success: true,
    message: 'Campaign deleted successfully',
    data: {
      id: parseInt(req.params.id)
    }
  });
});

module.exports = router;
