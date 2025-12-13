const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// All combat routes require authentication
router.use(authenticate);

// GET /api/combat/:encounter_id/initiative - Get initiative order
router.get('/:encounter_id/initiative', async (req, res) => {
  res.json({
    success: true,
    message: 'Initiative tracker endpoint (stub)',
    data: {
      encounter_id: parseInt(req.params.encounter_id),
      current_round: 1,
      participants: [
        {
          id: 1,
          participant_type: 'player',
          participant_id: 1,
          name: 'Fighter',
          initiative: 18,
          turn_order: 1,
          is_current_turn: true,
          conditions: []
        },
        {
          id: 2,
          participant_type: 'monster',
          participant_id: 1,
          name: 'Goblin 1',
          initiative: 12,
          turn_order: 2,
          is_current_turn: false,
          conditions: []
        }
      ]
    }
  });
});

// POST /api/combat/:encounter_id/start - Start combat/roll initiative (admin only)
router.post('/:encounter_id/start', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Start combat endpoint (stub - initiative rolling not implemented)',
    data: {
      encounter_id: parseInt(req.params.encounter_id),
      status: 'active',
      current_round: 1,
      message: 'Combat started successfully'
    }
  });
});

// POST /api/combat/:encounter_id/next-turn - Advance to next turn (admin only)
router.post('/:encounter_id/next-turn', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Next turn endpoint (stub - turn tracking not implemented)',
    data: {
      encounter_id: parseInt(req.params.encounter_id),
      current_round: 1,
      next_participant: {
        name: 'Goblin 1',
        turn_order: 2
      }
    }
  });
});

// PUT /api/combat/initiative/:id - Update initiative entry (admin only)
router.put('/initiative/:id', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'Update initiative endpoint (stub)',
    data: {
      id: parseInt(req.params.id),
      initiative: req.body.initiative || 10,
      conditions: req.body.conditions || []
    }
  });
});

// POST /api/combat/:encounter_id/end - End combat (admin only)
router.post('/:encounter_id/end', authorize('admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'End combat endpoint (stub)',
    data: {
      encounter_id: parseInt(req.params.encounter_id),
      status: 'completed',
      message: 'Combat ended successfully'
    }
  });
});

module.exports = router;
