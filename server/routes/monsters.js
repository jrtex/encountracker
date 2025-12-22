const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const database = require('../utils/database');

// All monster routes require authentication
router.use(authenticate);

// GET /api/monsters - List monsters in encounter
router.get('/', async (req, res, next) => {
  try {
    const { encounter_id } = req.query;
    const userId = req.user.id;

    let query, params;

    if (encounter_id) {
      // Get monsters for specific encounter, verify ownership
      query = `
        SELECT m.*
        FROM monsters m
        JOIN encounters e ON m.encounter_id = e.id
        JOIN campaigns c ON e.campaign_id = c.id
        WHERE m.encounter_id = ? AND c.dm_user_id = ?
        ORDER BY m.created_at DESC
      `;
      params = [encounter_id, userId];
    } else {
      // Get all monsters for user's encounters
      query = `
        SELECT m.*
        FROM monsters m
        JOIN encounters e ON m.encounter_id = e.id
        JOIN campaigns c ON e.campaign_id = c.id
        WHERE c.dm_user_id = ?
        ORDER BY m.created_at DESC
      `;
      params = [userId];
    }

    const monsters = await database.all(query, params);

    res.json({
      success: true,
      data: monsters
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/monsters/search - Search D&D 5e API for monsters
router.get('/search', async (req, res, next) => {
  try {
    const { query } = req.query;

    // Fetch monster list from D&D 5e API
    const response = await fetch('https://www.dnd5eapi.co/api/monsters');

    if (!response.ok) {
      throw new Error('Failed to fetch from D&D 5e API');
    }

    const data = await response.json();
    let results = data.results || [];

    // Filter by query if provided
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(monster =>
        monster.name.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/monsters/dnd/:id - Get monster details from D&D 5e API
router.get('/dnd/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch monster details from D&D 5e API
    const response = await fetch(`https://www.dnd5eapi.co/api/monsters/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          message: 'Monster not found in D&D 5e API'
        });
      }
      throw new Error('Failed to fetch monster details from D&D 5e API');
    }

    const monster = await response.json();

    // Return full monster data (client needs all fields for detailed view)
    res.json({
      success: true,
      data: monster
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/monsters - Add monster to encounter (admin only)
router.post('/',
  authorize('admin'),
  [
    body('encounter_id').isInt().withMessage('Encounter ID is required'),
    body('name').trim().notEmpty().withMessage('Monster name is required'),
    body('max_hp').isInt({ min: 1 }).withMessage('Max HP must be at least 1'),
    body('armor_class').isInt({ min: 0 }).withMessage('Armor class must be non-negative'),
    body('initiative_bonus').optional().isInt().withMessage('Initiative bonus must be an integer'),
    body('dnd_api_id').optional().trim(),
    body('notes').optional().trim(),
    body('actions').optional().isArray().withMessage('Actions must be an array'),
    body('actions.*.category').optional().isIn(['action', 'legendary', 'special', 'reaction']).withMessage('Invalid action category'),
    body('actions.*.name').optional().trim().notEmpty().withMessage('Action name is required'),
    body('actions.*.description').optional().trim().notEmpty().withMessage('Action description is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { encounter_id, name, max_hp, armor_class, initiative_bonus, dnd_api_id, notes, actions } = req.body;
      const userId = req.user.id;

      // Verify encounter exists and user owns it through campaign
      const encounter = await database.get(
        `SELECT e.id
         FROM encounters e
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE e.id = ? AND c.dm_user_id = ?`,
        [encounter_id, userId]
      );

      if (!encounter) {
        return res.status(404).json({
          success: false,
          message: 'Encounter not found'
        });
      }

      // Auto-set current_hp to max_hp (monsters start at full health)
      const current_hp = max_hp;

      // Insert monster
      const result = await database.run(
        `INSERT INTO monsters (encounter_id, name, dnd_api_id, max_hp, current_hp, armor_class, initiative_bonus, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [encounter_id, name, dnd_api_id || null, max_hp, current_hp, armor_class, initiative_bonus || 0, notes || null]
      );

      const monsterId = result.lastID;

      // Insert actions if provided
      if (actions && Array.isArray(actions) && actions.length > 0) {
        const actionInsertPromises = actions.map(action => {
          return database.run(
            `INSERT INTO monster_actions (monster_id, action_category, name, description)
             VALUES (?, ?, ?, ?)`,
            [monsterId, action.category, action.name, action.description]
          );
        });
        await Promise.all(actionInsertPromises);
      }

      // Get the created monster
      const monster = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      // Get actions for the response
      const monsterActions = await database.all(
        'SELECT * FROM monster_actions WHERE monster_id = ? ORDER BY action_category, name',
        [monsterId]
      );

      res.status(201).json({
        success: true,
        message: 'Monster created successfully',
        data: {
          ...monster,
          actions: monsterActions
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/monsters/:id - Update monster (admin only)
router.put('/:id',
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty().withMessage('Monster name cannot be empty'),
    body('max_hp').optional().isInt({ min: 1 }).withMessage('Max HP must be at least 1'),
    body('current_hp').optional().isInt({ min: 0 }).withMessage('Current HP must be non-negative'),
    body('armor_class').optional().isInt({ min: 0 }).withMessage('Armor class must be non-negative'),
    body('initiative_bonus').optional().isInt().withMessage('Initiative bonus must be an integer'),
    body('dnd_api_id').optional().trim(),
    body('notes').optional().trim(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, max_hp, current_hp, armor_class, initiative_bonus, dnd_api_id, notes } = req.body;

      // Verify monster exists and user owns it through encounter → campaign
      const monster = await database.get(
        `SELECT m.id
         FROM monsters m
         JOIN encounters e ON m.encounter_id = e.id
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE m.id = ? AND c.dm_user_id = ?`,
        [id, userId]
      );

      if (!monster) {
        return res.status(404).json({
          success: false,
          message: 'Monster not found'
        });
      }

      // Build update query dynamically based on provided fields
      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (max_hp !== undefined) {
        updates.push('max_hp = ?');
        params.push(max_hp);
      }
      if (current_hp !== undefined) {
        updates.push('current_hp = ?');
        params.push(current_hp);
      }
      if (armor_class !== undefined) {
        updates.push('armor_class = ?');
        params.push(armor_class);
      }
      if (initiative_bonus !== undefined) {
        updates.push('initiative_bonus = ?');
        params.push(initiative_bonus);
      }
      if (dnd_api_id !== undefined) {
        updates.push('dnd_api_id = ?');
        params.push(dnd_api_id);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      params.push(id);

      await database.run(
        `UPDATE monsters SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      // Get updated monster
      const updatedMonster = await database.get('SELECT * FROM monsters WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Monster updated successfully',
        data: updatedMonster
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/monsters/:id - Remove monster (admin only)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify monster exists and user owns it through encounter → campaign
    const monster = await database.get(
      `SELECT m.id
       FROM monsters m
       JOIN encounters e ON m.encounter_id = e.id
       JOIN campaigns c ON e.campaign_id = c.id
       WHERE m.id = ? AND c.dm_user_id = ?`,
      [id, userId]
    );

    if (!monster) {
      return res.status(404).json({
        success: false,
        message: 'Monster not found'
      });
    }

    // Delete monster
    await database.run('DELETE FROM monsters WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Monster deleted successfully',
      data: {
        id: parseInt(id),
        deleted: true
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/monsters/:id/actions - Get monster actions
router.get('/:id/actions', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify monster exists and user owns it through encounter → campaign
    const monster = await database.get(
      `SELECT m.id
       FROM monsters m
       JOIN encounters e ON m.encounter_id = e.id
       JOIN campaigns c ON e.campaign_id = c.id
       WHERE m.id = ? AND c.dm_user_id = ?`,
      [id, userId]
    );

    if (!monster) {
      return res.status(404).json({
        success: false,
        message: 'Monster not found'
      });
    }

    // Get all actions for this monster
    const actions = await database.all(
      `SELECT * FROM monster_actions
       WHERE monster_id = ?
       ORDER BY
         CASE action_category
           WHEN 'action' THEN 1
           WHEN 'legendary' THEN 2
           WHEN 'special' THEN 3
           WHEN 'reaction' THEN 4
         END,
         name`,
      [id]
    );

    res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
