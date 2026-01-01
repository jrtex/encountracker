const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const validate = require('../middleware/validation');
const database = require('../utils/database');

// Public routes - NO authentication required

// GET /api/public/active-encounter - Get currently active encounter (read-only, public view)
// Returns encounter data with monster secret information filtered out
router.get('/active-encounter', async (req, res, next) => {
  try {
    // Get the first active encounter (we can expand this later to filter by campaign)
    const encounter = await database.get(
      `SELECT e.*, c.name as campaign_name
       FROM encounters e
       JOIN campaigns c ON e.campaign_id = c.id
       WHERE e.status = 'active'
       ORDER BY e.updated_at DESC
       LIMIT 1`
    );

    if (!encounter) {
      return res.json({
        success: true,
        data: null,
        message: 'No active encounter found'
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
        it.is_removed_from_combat,
        it.death_save_successes,
        it.death_save_failures,
        it.is_stabilized,
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
        END as armor_class,
        CASE
          WHEN it.participant_type = 'player' THEN false
          WHEN it.participant_type = 'monster' THEN m.allow_death_saves
        END as allow_death_saves
       FROM initiative_tracker it
       LEFT JOIN players p ON it.participant_type = 'player' AND it.participant_id = p.id
       LEFT JOIN monsters m ON it.participant_type = 'monster' AND it.participant_id = m.id
       WHERE it.encounter_id = ?
       ORDER BY it.turn_order ASC`,
      [encounter.id]
    );

    // Filter secret information for monsters
    const publicParticipants = participants.map(p => {
      const baseData = {
        id: p.id,
        participant_type: p.participant_type,
        initiative: p.initiative,
        turn_order: p.turn_order,
        is_current_turn: Boolean(p.is_current_turn),
        conditions: p.conditions ? JSON.parse(p.conditions) : [],
        temp_hp: p.temp_hp,
        is_removed_from_combat: p.is_removed_from_combat,
        name: p.name
      };

      if (p.participant_type === 'player') {
        // Players: show all information
        return {
          ...baseData,
          current_hp: p.current_hp,
          max_hp: p.max_hp,
          armor_class: p.armor_class,
          allow_death_saves: p.allow_death_saves,
          death_save_successes: p.death_save_successes,
          death_save_failures: p.death_save_failures,
          is_stabilized: p.is_stabilized,
          hp_percentage: p.max_hp > 0 ? Math.round((p.current_hp / p.max_hp) * 100) : 0
        };
      } else {
        // Monsters: hide AC, max_hp, current_hp values, show only percentage
        const hp_percentage = p.max_hp > 0 ? Math.round((p.current_hp / p.max_hp) * 100) : 0;
        return {
          ...baseData,
          hp_percentage,
          // Don't include: armor_class, current_hp, max_hp, death saves
          // Actions will not be fetched in public view
        };
      }
    });

    res.json({
      success: true,
      data: {
        encounter: {
          id: encounter.id,
          name: encounter.name,
          description: encounter.description,
          difficulty: encounter.difficulty,
          campaign_name: encounter.campaign_name,
          current_round: encounter.current_round || 1
        },
        participants: publicParticipants
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
