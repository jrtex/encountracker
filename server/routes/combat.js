const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const database = require('../utils/database');

// All combat routes require authentication
router.use(authenticate);

// Helper function to roll a d20
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

// GET /api/combat/:encounter_id/initiative - Get initiative order
router.get('/:encounter_id/initiative',
  param('encounter_id').isInt(),
  validate,
  async (req, res, next) => {
    try {
      const { encounter_id } = req.params;

      // Verify encounter belongs to user via campaign ownership
      const encounter = await database.get(
        `SELECT e.* FROM encounters e
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE e.id = ? AND c.dm_user_id = ?`,
        [encounter_id, req.user.id]
      );

      if (!encounter) {
        return res.status(404).json({
          success: false,
          message: 'Encounter not found or access denied'
        });
      }

      // Get initiative tracker with participant details
      const participants = await database.all(
        `SELECT
          it.id,
          it.participant_type,
          it.participant_id,
          it.initiative,
          it.turn_order,
          it.is_current_turn,
          it.conditions,
          it.temp_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.character_name
            WHEN it.participant_type = 'monster' THEN m.name
          END as name,
          CASE
            WHEN it.participant_type = 'player' THEN p.current_hp
            WHEN it.participant_type = 'monster' THEN m.current_hp
          END as current_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.max_hp
            WHEN it.participant_type = 'monster' THEN m.max_hp
          END as max_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.armor_class
            WHEN it.participant_type = 'monster' THEN m.armor_class
          END as armor_class
         FROM initiative_tracker it
         LEFT JOIN players p ON it.participant_type = 'player' AND it.participant_id = p.id
         LEFT JOIN monsters m ON it.participant_type = 'monster' AND it.participant_id = m.id
         WHERE it.encounter_id = ?
         ORDER BY it.turn_order ASC`,
        [encounter_id]
      );

      // Parse conditions from JSON strings
      const formattedParticipants = participants.map(p => ({
        ...p,
        is_current_turn: Boolean(p.is_current_turn),
        conditions: p.conditions ? JSON.parse(p.conditions) : []
      }));

      // Calculate current round (count how many times we've wrapped through the turn order)
      const currentParticipant = formattedParticipants.find(p => p.is_current_turn);
      const currentRound = 1; // Simple implementation: always round 1 for now

      res.json({
        success: true,
        data: {
          encounter_id: parseInt(encounter_id),
          current_round: currentRound,
          participants: formattedParticipants
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/combat/:encounter_id/start - Start combat/roll initiative (admin only)
router.post('/:encounter_id/start',
  authorize('admin'),
  param('encounter_id').isInt(),
  body('initiative_mode').isIn(['manual', 'auto']),
  body('manual_initiatives').optional().isArray(),
  validate,
  async (req, res, next) => {
    try {
      const { encounter_id } = req.params;
      const { initiative_mode, manual_initiatives = [] } = req.body;

      // Verify encounter belongs to user
      const encounter = await database.get(
        `SELECT e.*, c.id as campaign_id FROM encounters e
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE e.id = ? AND c.dm_user_id = ?`,
        [encounter_id, req.user.id]
      );

      if (!encounter) {
        return res.status(404).json({
          success: false,
          message: 'Encounter not found or access denied'
        });
      }

      // Check if combat already started
      if (encounter.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Combat already active for this encounter'
        });
      }

      // Get active players from campaign
      const players = await database.all(
        'SELECT * FROM players WHERE campaign_id = ? AND is_active = 1',
        [encounter.campaign_id]
      );

      // Get monsters from encounter
      const monsters = await database.all(
        'SELECT * FROM monsters WHERE encounter_id = ?',
        [encounter_id]
      );

      // Validate we have participants
      if (players.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No active players in campaign. Mark players as active to start combat.'
        });
      }

      if (monsters.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No monsters in encounter. Add monsters before starting combat.'
        });
      }

      // Build participants array with initiatives
      const participants = [];

      // Process players
      for (const player of players) {
        let initiative;

        if (initiative_mode === 'manual') {
          // Find manual initiative for this player
          const manualInit = manual_initiatives.find(
            m => m.participant_type === 'player' && m.participant_id === player.id
          );

          if (!manualInit || manualInit.initiative === undefined) {
            return res.status(400).json({
              success: false,
              message: `Missing initiative for player: ${player.character_name}`
            });
          }

          initiative = parseInt(manualInit.initiative);
        } else {
          // Auto mode: roll d20 + bonus
          initiative = rollD20() + (player.initiative_bonus || 0);
        }

        participants.push({
          participant_type: 'player',
          participant_id: player.id,
          initiative,
          id: player.id // For tie-breaking
        });
      }

      // Process monsters (always auto-roll)
      for (const monster of monsters) {
        const initiative = rollD20() + (monster.initiative_bonus || 0);
        participants.push({
          participant_type: 'monster',
          participant_id: monster.id,
          initiative,
          id: monster.id // For tie-breaking
        });
      }

      // Sort by initiative DESC, then by id ASC (for ties)
      participants.sort((a, b) => {
        if (b.initiative !== a.initiative) {
          return b.initiative - a.initiative;
        }
        return a.id - b.id;
      });

      // Assign turn_order
      participants.forEach((p, index) => {
        p.turn_order = index + 1;
        p.is_current_turn = index === 0 ? 1 : 0;
        p.conditions = JSON.stringify([]);
        delete p.id; // Remove temporary id field
      });

      // Insert into initiative_tracker
      for (const p of participants) {
        await database.run(
          `INSERT INTO initiative_tracker
           (encounter_id, participant_type, participant_id, initiative, turn_order, is_current_turn, conditions)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [encounter_id, p.participant_type, p.participant_id, p.initiative, p.turn_order, p.is_current_turn, p.conditions]
        );
      }

      // Update encounter status to active
      await database.run(
        'UPDATE encounters SET status = ? WHERE id = ?',
        ['active', encounter_id]
      );

      // Get full initiative state to return
      const initiativeState = await database.all(
        `SELECT
          it.id,
          it.participant_type,
          it.participant_id,
          it.initiative,
          it.turn_order,
          it.is_current_turn,
          it.conditions,
          it.temp_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.character_name
            WHEN it.participant_type = 'monster' THEN m.name
          END as name,
          CASE
            WHEN it.participant_type = 'player' THEN p.current_hp
            WHEN it.participant_type = 'monster' THEN m.current_hp
          END as current_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.max_hp
            WHEN it.participant_type = 'monster' THEN m.max_hp
          END as max_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.armor_class
            WHEN it.participant_type = 'monster' THEN m.armor_class
          END as armor_class
         FROM initiative_tracker it
         LEFT JOIN players p ON it.participant_type = 'player' AND it.participant_id = p.id
         LEFT JOIN monsters m ON it.participant_type = 'monster' AND it.participant_id = m.id
         WHERE it.encounter_id = ?
         ORDER BY it.turn_order ASC`,
        [encounter_id]
      );

      const formattedState = initiativeState.map(p => ({
        ...p,
        is_current_turn: Boolean(p.is_current_turn),
        conditions: p.conditions ? JSON.parse(p.conditions) : []
      }));

      res.json({
        success: true,
        message: 'Combat started successfully',
        data: {
          encounter_id: parseInt(encounter_id),
          status: 'active',
          current_round: 1,
          participants: formattedState
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/combat/:encounter_id/next-turn - Advance to next turn (admin only)
router.post('/:encounter_id/next-turn',
  authorize('admin'),
  param('encounter_id').isInt(),
  validate,
  async (req, res, next) => {
    try {
      const { encounter_id } = req.params;

      // Verify encounter belongs to user
      const encounter = await database.get(
        `SELECT e.* FROM encounters e
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE e.id = ? AND c.dm_user_id = ?`,
        [encounter_id, req.user.id]
      );

      if (!encounter) {
        return res.status(404).json({
          success: false,
          message: 'Encounter not found or access denied'
        });
      }

      // Get all participants ordered by turn_order
      const participants = await database.all(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ? ORDER BY turn_order ASC',
        [encounter_id]
      );

      if (participants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No participants in initiative tracker'
        });
      }

      // Find current participant
      const currentIndex = participants.findIndex(p => p.is_current_turn);
      const currentParticipantIndex = currentIndex >= 0 ? currentIndex : 0;

      // Calculate next participant index (wrap around)
      const nextIndex = (currentParticipantIndex + 1) % participants.length;
      const nextParticipant = participants[nextIndex];

      // Update all is_current_turn to 0
      await database.run(
        'UPDATE initiative_tracker SET is_current_turn = 0 WHERE encounter_id = ?',
        [encounter_id]
      );

      // Set next participant as current
      await database.run(
        'UPDATE initiative_tracker SET is_current_turn = 1 WHERE id = ?',
        [nextParticipant.id]
      );

      // Get participant details
      const participantDetails = await database.get(
        `SELECT
          it.id,
          it.participant_type,
          it.participant_id,
          it.turn_order,
          CASE
            WHEN it.participant_type = 'player' THEN p.character_name
            WHEN it.participant_type = 'monster' THEN m.name
          END as name
         FROM initiative_tracker it
         LEFT JOIN players p ON it.participant_type = 'player' AND it.participant_id = p.id
         LEFT JOIN monsters m ON it.participant_type = 'monster' AND it.participant_id = m.id
         WHERE it.id = ?`,
        [nextParticipant.id]
      );

      res.json({
        success: true,
        message: 'Advanced to next turn',
        data: {
          encounter_id: parseInt(encounter_id),
          current_round: 1, // Simple implementation
          next_participant: participantDetails
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/combat/initiative/:id - Update initiative entry (admin only)
router.put('/initiative/:id',
  authorize('admin'),
  param('id').isInt(),
  body('current_hp').optional().isInt(),
  body('conditions').optional().isArray().custom((value) => {
    // Validate mixed array: strings (standard conditions) or objects (custom conditions)
    for (const item of value) {
      if (typeof item === 'string') continue;
      if (typeof item === 'object' && item !== null && item.name && item.description && item.type === 'custom') continue;
      throw new Error('Invalid condition format. Must be string or {name, description, type: "custom"}');
    }
    return true;
  }),
  body('initiative').optional().isInt(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { current_hp, conditions, initiative } = req.body;

      // Get initiative tracker entry and verify ownership
      const entry = await database.get(
        `SELECT it.*, e.campaign_id
         FROM initiative_tracker it
         JOIN encounters e ON it.encounter_id = e.id
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE it.id = ? AND c.dm_user_id = ?`,
        [id, req.user.id]
      );

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Initiative entry not found or access denied'
        });
      }

      // Update current_hp if provided
      if (current_hp !== undefined) {
        // Get current temp_hp to apply damage correctly
        const currentEntry = await database.get(
          'SELECT temp_hp FROM initiative_tracker WHERE id = ?',
          [id]
        );

        const currentTempHp = currentEntry.temp_hp || 0;

        // Calculate damage/healing
        const currentHp = await database.get(
          `SELECT current_hp FROM ${entry.participant_type === 'player' ? 'players' : 'monsters'} WHERE id = ?`,
          [entry.participant_id]
        );

        const hpDiff = current_hp - currentHp.current_hp;

        let newTempHp = currentTempHp;
        let newActualHp = currentHp.current_hp; // Start with current HP from database

        // If taking damage (negative hpDiff), apply to temp HP first
        if (hpDiff < 0) {
          const damage = Math.abs(hpDiff);
          if (currentTempHp > 0) {
            if (damage <= currentTempHp) {
              // All damage absorbed by temp HP
              newTempHp = currentTempHp - damage;
              newActualHp = currentHp.current_hp; // HP unchanged
            } else {
              // Temp HP absorbed some, rest goes to regular HP
              const remainingDamage = damage - currentTempHp;
              newTempHp = 0;
              newActualHp = Math.max(0, currentHp.current_hp - remainingDamage);
            }
          } else {
            // No temp HP, apply all damage to regular HP
            newActualHp = Math.max(0, current_hp);
          }
        } else {
          // Healing - just use the provided HP value
          newActualHp = current_hp;
        }

        const table = entry.participant_type === 'player' ? 'players' : 'monsters';
        await database.run(
          `UPDATE ${table} SET current_hp = ? WHERE id = ?`,
          [newActualHp, entry.participant_id]
        );

        // Update temp HP
        await database.run(
          'UPDATE initiative_tracker SET temp_hp = ? WHERE id = ?',
          [newTempHp, id]
        );

        // Auto-manage unconscious condition
        let updatedConditions = conditions !== undefined ? conditions :
          (entry.conditions ? JSON.parse(entry.conditions) : []);

        // Helper to check if condition exists (handles both string and object)
        const hasCondition = (conditions, name) => {
          return conditions.some(c =>
            (typeof c === 'string' && c === name) ||
            (typeof c === 'object' && c.name === name)
          );
        };

        if (newActualHp <= 0 && !hasCondition(updatedConditions, 'unconscious')) {
          updatedConditions.push('unconscious');
        } else if (newActualHp > 0) {
          updatedConditions = updatedConditions.filter(c =>
            (typeof c === 'string' && c !== 'unconscious') ||
            (typeof c === 'object' && c.name !== 'unconscious')
          );
        }

        await database.run(
          'UPDATE initiative_tracker SET conditions = ? WHERE id = ?',
          [JSON.stringify(updatedConditions), id]
        );
      }

      // Update conditions if provided (and not already updated by HP logic)
      if (conditions !== undefined && current_hp === undefined) {
        await database.run(
          'UPDATE initiative_tracker SET conditions = ? WHERE id = ?',
          [JSON.stringify(conditions), id]
        );
      }

      // Update initiative value if provided
      if (initiative !== undefined) {
        await database.run(
          'UPDATE initiative_tracker SET initiative = ? WHERE id = ?',
          [initiative, id]
        );

        // Recalculate turn_order for all participants in this encounter
        const participants = await database.all(
          'SELECT * FROM initiative_tracker WHERE encounter_id = ? ORDER BY initiative DESC, id ASC',
          [entry.encounter_id]
        );

        for (let i = 0; i < participants.length; i++) {
          await database.run(
            'UPDATE initiative_tracker SET turn_order = ? WHERE id = ?',
            [i + 1, participants[i].id]
          );
        }
      }

      // Get updated entry with participant details
      const updatedEntry = await database.get(
        `SELECT
          it.id,
          it.participant_type,
          it.participant_id,
          it.initiative,
          it.turn_order,
          it.is_current_turn,
          it.conditions,
          it.temp_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.character_name
            WHEN it.participant_type = 'monster' THEN m.name
          END as name,
          CASE
            WHEN it.participant_type = 'player' THEN p.current_hp
            WHEN it.participant_type = 'monster' THEN m.current_hp
          END as current_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.max_hp
            WHEN it.participant_type = 'monster' THEN m.max_hp
          END as max_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.armor_class
            WHEN it.participant_type = 'monster' THEN m.armor_class
          END as armor_class
         FROM initiative_tracker it
         LEFT JOIN players p ON it.participant_type = 'player' AND it.participant_id = p.id
         LEFT JOIN monsters m ON it.participant_type = 'monster' AND it.participant_id = m.id
         WHERE it.id = ?`,
        [id]
      );

      res.json({
        success: true,
        message: 'Initiative entry updated',
        data: {
          ...updatedEntry,
          is_current_turn: Boolean(updatedEntry.is_current_turn),
          conditions: updatedEntry.conditions ? JSON.parse(updatedEntry.conditions) : []
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/combat/initiative/:id/temp-hp - Update temporary HP (admin only)
router.put('/initiative/:id/temp-hp',
  authorize('admin'),
  param('id').isInt(),
  body('temp_hp').isInt({ min: 0 }),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { temp_hp } = req.body;

      // Get initiative tracker entry and verify ownership
      const entry = await database.get(
        `SELECT it.*, e.campaign_id
         FROM initiative_tracker it
         JOIN encounters e ON it.encounter_id = e.id
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE it.id = ? AND c.dm_user_id = ?`,
        [id, req.user.id]
      );

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Initiative entry not found or access denied'
        });
      }

      // Get current temp_hp
      const currentTempHp = entry.temp_hp || 0;

      // According to D&D 5e rules, adding temp HP replaces existing temp HP if new value is higher
      // But based on user requirement: "If temporary is added to a player with existing temporary HP, it should be added to the existing"
      const newTempHp = currentTempHp + temp_hp;

      // Update temp HP
      await database.run(
        'UPDATE initiative_tracker SET temp_hp = ? WHERE id = ?',
        [newTempHp, id]
      );

      // Get updated entry with participant details
      const updatedEntry = await database.get(
        `SELECT
          it.id,
          it.participant_type,
          it.participant_id,
          it.initiative,
          it.turn_order,
          it.is_current_turn,
          it.conditions,
          it.temp_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.character_name
            WHEN it.participant_type = 'monster' THEN m.name
          END as name,
          CASE
            WHEN it.participant_type = 'player' THEN p.current_hp
            WHEN it.participant_type = 'monster' THEN m.current_hp
          END as current_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.max_hp
            WHEN it.participant_type = 'monster' THEN m.max_hp
          END as max_hp,
          CASE
            WHEN it.participant_type = 'player' THEN p.armor_class
            WHEN it.participant_type = 'monster' THEN m.armor_class
          END as armor_class
         FROM initiative_tracker it
         LEFT JOIN players p ON it.participant_type = 'player' AND it.participant_id = p.id
         LEFT JOIN monsters m ON it.participant_type = 'monster' AND it.participant_id = m.id
         WHERE it.id = ?`,
        [id]
      );

      res.json({
        success: true,
        message: 'Temporary HP updated',
        data: {
          ...updatedEntry,
          is_current_turn: Boolean(updatedEntry.is_current_turn),
          conditions: updatedEntry.conditions ? JSON.parse(updatedEntry.conditions) : []
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/combat/:encounter_id/end - End combat (admin only)
router.post('/:encounter_id/end',
  authorize('admin'),
  param('encounter_id').isInt(),
  validate,
  async (req, res, next) => {
    try {
      const { encounter_id } = req.params;

      // Verify encounter belongs to user
      const encounter = await database.get(
        `SELECT e.* FROM encounters e
         JOIN campaigns c ON e.campaign_id = c.id
         WHERE e.id = ? AND c.dm_user_id = ?`,
        [encounter_id, req.user.id]
      );

      if (!encounter) {
        return res.status(404).json({
          success: false,
          message: 'Encounter not found or access denied'
        });
      }

      // Delete all initiative tracker entries
      await database.run(
        'DELETE FROM initiative_tracker WHERE encounter_id = ?',
        [encounter_id]
      );

      // Update encounter status to completed
      await database.run(
        'UPDATE encounters SET status = ? WHERE id = ?',
        ['completed', encounter_id]
      );

      res.json({
        success: true,
        message: 'Combat ended successfully',
        data: {
          encounter_id: parseInt(encounter_id),
          status: 'completed'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
