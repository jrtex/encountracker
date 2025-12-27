const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const database = require('../utils/database');

// All player routes require authentication
router.use(authenticate);

// GET /api/players - List players (optionally filtered by campaign)
router.get('/', async (req, res) => {
  const { campaign_id } = req.query;

  let query = `
    SELECT p.*, c.name as campaign_name
    FROM players p
    JOIN campaigns c ON p.campaign_id = c.id
    WHERE c.dm_user_id = ?
  `;
  const params = [req.user.id];

  if (campaign_id) {
    query += ' AND p.campaign_id = ?';
    params.push(campaign_id);
  }

  query += ' ORDER BY p.created_at DESC';

  const players = await database.all(query, params);

  res.json({
    success: true,
    data: players
  });
});

// GET /api/players/:id - Get single player
router.get('/:id', async (req, res) => {
  const player = await database.get(
    `SELECT p.*, c.name as campaign_name
     FROM players p
     JOIN campaigns c ON p.campaign_id = c.id
     WHERE p.id = ? AND c.dm_user_id = ?`,
    [req.params.id, req.user.id]
  );

  if (!player) {
    return res.status(404).json({
      success: false,
      message: 'Player not found'
    });
  }

  res.json({
    success: true,
    data: player
  });
});

// POST /api/players - Create player (admin only)
router.post(
  '/',
  authorize('admin'),
  [
    body('campaign_id').isInt().withMessage('Campaign ID is required'),
    body('character_name').trim().notEmpty().withMessage('Character name is required'),
    body('character_class').optional().trim(),
    body('level').optional().isInt({ min: 1, max: 20 }).withMessage('Level must be between 1 and 20'),
    body('max_hp').isInt({ min: 1 }).withMessage('Max HP must be a positive integer'),
    body('current_hp').optional().isInt({ min: 0 }).withMessage('Current HP must be non-negative'),
    body('armor_class').isInt({ min: 0 }).withMessage('Armor class must be non-negative'),
    body('speed').optional().isInt({ min: 0 }).withMessage('Speed must be non-negative'),
    body('initiative_bonus').optional().isInt().withMessage('Initiative bonus must be an integer'),
    body('is_active').optional().isBoolean().withMessage('Active status must be a boolean'),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res) => {
    const { campaign_id, character_name, character_class, level, max_hp, current_hp, armor_class, speed, initiative_bonus, is_active, notes } = req.body;

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
      'INSERT INTO players (campaign_id, character_name, character_class, level, max_hp, current_hp, armor_class, speed, initiative_bonus, is_active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        campaign_id,
        character_name,
        character_class || null,
        level || 1,
        max_hp,
        current_hp !== undefined ? current_hp : max_hp,
        armor_class,
        speed || 30,
        initiative_bonus || 0,
        is_active !== undefined ? is_active : true,
        notes || ''
      ]
    );

    const player = await database.get(
      'SELECT * FROM players WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      success: true,
      message: 'Player created successfully',
      data: player
    });
  }
);

// PUT /api/players/:id - Update player (admin only)
router.put(
  '/:id',
  authorize('admin'),
  [
    body('character_name').trim().notEmpty().withMessage('Character name is required'),
    body('character_class').optional().trim(),
    body('level').optional().isInt({ min: 1, max: 20 }).withMessage('Level must be between 1 and 20'),
    body('max_hp').isInt({ min: 1 }).withMessage('Max HP must be a positive integer'),
    body('current_hp').optional().isInt({ min: 0 }).withMessage('Current HP must be non-negative'),
    body('armor_class').isInt({ min: 0 }).withMessage('Armor class must be non-negative'),
    body('speed').optional().isInt({ min: 0 }).withMessage('Speed must be non-negative'),
    body('initiative_bonus').optional().isInt().withMessage('Initiative bonus must be an integer'),
    body('is_active').optional().isBoolean().withMessage('Active status must be a boolean'),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res) => {
    const { character_name, character_class, level, max_hp, current_hp, armor_class, speed, initiative_bonus, is_active, notes } = req.body;

    // Verify player belongs to user's campaign
    const player = await database.get(
      `SELECT p.* FROM players p
       JOIN campaigns c ON p.campaign_id = c.id
       WHERE p.id = ? AND c.dm_user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    await database.run(
      'UPDATE players SET character_name = ?, character_class = ?, level = ?, max_hp = ?, current_hp = ?, armor_class = ?, speed = ?, initiative_bonus = ?, is_active = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        character_name,
        character_class || null,
        level !== undefined ? level : player.level,
        max_hp,
        current_hp !== undefined ? current_hp : max_hp,
        armor_class,
        speed !== undefined ? speed : player.speed,
        initiative_bonus !== undefined ? initiative_bonus : player.initiative_bonus,
        is_active !== undefined ? is_active : player.is_active,
        notes || '',
        req.params.id
      ]
    );

    const updatedPlayer = await database.get(
      'SELECT * FROM players WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Player updated successfully',
      data: updatedPlayer
    });
  }
);

// DELETE /api/players/:id - Delete player (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  // Verify player belongs to user's campaign
  const player = await database.get(
    `SELECT p.* FROM players p
     JOIN campaigns c ON p.campaign_id = c.id
     WHERE p.id = ? AND c.dm_user_id = ?`,
    [req.params.id, req.user.id]
  );

  if (!player) {
    return res.status(404).json({
      success: false,
      message: 'Player not found'
    });
  }

  await database.run('DELETE FROM players WHERE id = ?', [req.params.id]);

  res.json({
    success: true,
    message: 'Player deleted successfully',
    data: {
      id: parseInt(req.params.id)
    }
  });
});

module.exports = router;
