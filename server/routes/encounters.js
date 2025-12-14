const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const database = require('../utils/database');

// All encounter routes require authentication
router.use(authenticate);

// GET /api/encounters - List encounters (optionally filtered by campaign)
router.get('/', async (req, res) => {
  const { campaign_id } = req.query;

  let query = `
    SELECT e.*, c.name as campaign_name
    FROM encounters e
    JOIN campaigns c ON e.campaign_id = c.id
    WHERE c.dm_user_id = ?
  `;
  const params = [req.user.id];

  if (campaign_id) {
    query += ' AND e.campaign_id = ?';
    params.push(campaign_id);
  }

  query += ' ORDER BY e.created_at DESC';

  const encounters = await database.all(query, params);

  res.json({
    success: true,
    data: encounters
  });
});

// GET /api/encounters/:id - Get single encounter
router.get('/:id', async (req, res) => {
  const encounter = await database.get(
    `SELECT e.*, c.name as campaign_name
     FROM encounters e
     JOIN campaigns c ON e.campaign_id = c.id
     WHERE e.id = ? AND c.dm_user_id = ?`,
    [req.params.id, req.user.id]
  );

  if (!encounter) {
    return res.status(404).json({
      success: false,
      message: 'Encounter not found'
    });
  }

  res.json({
    success: true,
    data: encounter
  });
});

// POST /api/encounters - Create encounter (admin only)
router.post(
  '/',
  authorize('admin'),
  [
    body('campaign_id').isInt().withMessage('Campaign ID is required'),
    body('name').trim().notEmpty().withMessage('Encounter name is required'),
    body('description').optional().trim(),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard', 'deadly']).withMessage('Invalid difficulty level'),
    body('status').optional().isIn(['pending', 'active', 'completed']).withMessage('Invalid status')
  ],
  validate,
  async (req, res) => {
    const { campaign_id, name, description, difficulty, status } = req.body;

    // Verify campaign belongs to user
    const campaign = await database.get(
      'SELECT * FROM campaigns WHERE id = ? AND dm_user_id = ?',
      [campaign_id, req.user.id]
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const result = await database.run(
      'INSERT INTO encounters (campaign_id, name, description, difficulty, status) VALUES (?, ?, ?, ?, ?)',
      [campaign_id, name, description || '', difficulty || 'medium', status || 'pending']
    );

    const encounter = await database.get(
      'SELECT * FROM encounters WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      success: true,
      message: 'Encounter created successfully',
      data: encounter
    });
  }
);

// PUT /api/encounters/:id - Update encounter (admin only)
router.put(
  '/:id',
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Encounter name is required'),
    body('description').optional().trim(),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard', 'deadly']).withMessage('Invalid difficulty level'),
    body('status').optional().isIn(['pending', 'active', 'completed']).withMessage('Invalid status')
  ],
  validate,
  async (req, res) => {
    const { name, description, difficulty, status } = req.body;

    // Verify encounter belongs to user's campaign
    const encounter = await database.get(
      `SELECT e.* FROM encounters e
       JOIN campaigns c ON e.campaign_id = c.id
       WHERE e.id = ? AND c.dm_user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!encounter) {
      return res.status(404).json({
        success: false,
        message: 'Encounter not found'
      });
    }

    await database.run(
      'UPDATE encounters SET name = ?, description = ?, difficulty = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || '', difficulty || encounter.difficulty, status || encounter.status, req.params.id]
    );

    const updatedEncounter = await database.get(
      'SELECT * FROM encounters WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Encounter updated successfully',
      data: updatedEncounter
    });
  }
);

// DELETE /api/encounters/:id - Delete encounter (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  // Verify encounter belongs to user's campaign
  const encounter = await database.get(
    `SELECT e.* FROM encounters e
     JOIN campaigns c ON e.campaign_id = c.id
     WHERE e.id = ? AND c.dm_user_id = ?`,
    [req.params.id, req.user.id]
  );

  if (!encounter) {
    return res.status(404).json({
      success: false,
      message: 'Encounter not found'
    });
  }

  await database.run('DELETE FROM encounters WHERE id = ?', [req.params.id]);

  res.json({
    success: true,
    message: 'Encounter deleted successfully',
    data: {
      id: parseInt(req.params.id)
    }
  });
});

module.exports = router;
