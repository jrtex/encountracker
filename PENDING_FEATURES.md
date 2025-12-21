# Pending Features & Implementation Roadmap

This document tracks features that have been designed but are awaiting implementation, along with their prerequisites and implementation steps.

---

## 🗡️ Participant Actions Display (In Progress)

**Status**: Design Complete - Awaiting Backend Implementation
**Showcase File**: `client/encounter-showcase.html` (sections: "Actions Section" component + cards #7 and #8)
**Created**: 2025-12-21

### Overview
Display available actions (attacks, abilities, spells) for monsters and players in the active encounter view. Actions are shown in an expandable section below the participant card that spans the full width.

### Design Specifications

#### Visual Design
- **Location**: Below the existing 4-column participant card grid
- **Layout**: Full-width expandable section using `grid-column: 1 / -1`
- **Default State**: Collapsed (minimizes card height)
- **Conditional Display**: Only shown if participant has defined actions
- **Expand/Collapse**: Click on "Actions" header to toggle

#### Component Structure
```
.actions-section
  ├── .actions-header (clickable)
  │   ├── .actions-header-text ("Actions")
  │   └── .actions-toggle (▼ arrow, rotates 180° when expanded)
  └── .actions-content (collapsed by default)
      └── .action-item (for each action)
          ├── .action-name (e.g., "Multiattack", "Bite")
          ├── .action-type (badge: "Melee", "Recharge 5-6", etc.)
          └── .action-description (full action text)
```

#### Styling Details
- **Header**: Light gray background (#f8f9fa), hover effect (#e9ecef)
- **Content**: White background, border, rounded corners
- **Action Items**: Separated by light borders, last item has no border
- **Action Names**: Bold, primary color, 1rem font
- **Action Types**: Small blue badge (similar to condition badges)
- **Action Descriptions**: 0.875rem font, proper formatting with `<em>` for rules text

### Prerequisites (Backend Work Required)

#### 1. Database Schema Changes
**File**: `server/models/schema.js`

Add new table to store participant actions:
```sql
CREATE TABLE IF NOT EXISTS participant_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  participant_type TEXT NOT NULL, -- 'player' or 'monster'
  action_name TEXT NOT NULL,
  action_type TEXT, -- 'Melee', 'Ranged', 'Recharge 5-6', 'Spell', etc.
  action_description TEXT NOT NULL,
  action_order INTEGER DEFAULT 0, -- For sorting (Multiattack first, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES initiative_tracker(id) ON DELETE CASCADE
);
```

**Note**: Consider if actions should be linked to monster templates vs individual encounter instances.

#### 2. API Endpoints
**File**: `server/routes/combat.js` (or new `server/routes/actions.js`)

Endpoints needed:
- `GET /api/combat/encounters/:encounterId/participants/:participantId/actions` - Get actions for a participant
- `POST /api/combat/encounters/:encounterId/participants/:participantId/actions` - Add action to participant
- `PUT /api/combat/participants/actions/:actionId` - Update an action
- `DELETE /api/combat/participants/actions/:actionId` - Delete an action

Or consider batch operations:
- `PUT /api/combat/encounters/:encounterId/participants/:participantId/actions` - Replace all actions for a participant

#### 3. Frontend API Client
**File**: `client/js/api.js`

Add methods:
```javascript
async getParticipantActions(encounterId, participantId) { ... }
async updateParticipantActions(encounterId, participantId, actions) { ... }
```

### Production Implementation Steps

**After backend implementation is complete:**

#### Step 1: Update CSS
**File**: `client/css/styles.css`

Copy styles from showcase (lines 321-413 in `encounter-showcase.html`):
- `.actions-section`
- `.actions-header` and `.actions-header-text`
- `.actions-toggle` and `.actions-toggle.expanded`
- `.actions-content` and `.actions-content.collapsed`
- `.action-item`, `.action-name`, `.action-description`, `.action-type`
- Update mobile responsive section to handle actions

#### Step 2: Update Initiative Tracker JavaScript
**File**: `client/js/initiative.js`

Modify `renderParticipantRow()` method (around line 238):
1. Check if participant has actions (from API response)
2. If actions exist, append actions section HTML to the card
3. Include all action items with proper formatting

Add to `setupEventListeners()` method (around line 367):
```javascript
// Actions toggle handlers
this.container.querySelectorAll('.actions-header').forEach(header => {
  header.addEventListener('click', (e) => {
    const toggle = header.querySelector('.actions-toggle');
    const content = header.nextElementSibling;
    toggle.classList.toggle('expanded');
    content.classList.toggle('collapsed');
  });
});
```

#### Step 3: Update Data Loading
**File**: `client/js/initiative.js`

Modify `loadInitiativeTracker()` method to fetch actions for each participant:
```javascript
// After loading initiative data
for (let participant of this.participants) {
  participant.actions = await API.getParticipantActions(this.encounterId, participant.id);
}
```

Or modify the encounter API to include actions in the participant data.

#### Step 4: Testing
- Verify actions display correctly for monsters with actions
- Verify no actions section for participants without actions
- Test expand/collapse functionality
- Test mobile responsive layout
- Ensure actions persist across page refreshes
- Test with various action types and lengths

### Future Enhancements
- **Action Usage Tracking**: Mark actions as "used" (e.g., Breath Weapon until recharge)
- **Legendary Actions**: Separate section for legendary actions
- **Reactions**: Display reactions in a separate collapsible section
- **D&D 5e API Integration**: Auto-populate monster actions from dnd5eapi.co
- **Player Spell Slots**: Track spell slot usage for player characters
- **Quick Action Buttons**: "Use Action" button that could trigger automated effects

### References
- **Design Showcase**: `client/encounter-showcase.html` - Full visual examples
- **Example Data**: Adult Green Dragon actions used as reference (6 actions including Multiattack, Bite, Claw, Tail, Frightful Presence, Poison Breath)

---

## 📝 Other Potential Features

_(Add other planned features below as they come up)_

### [Feature Name]
**Status**: [Ideation / Design / Awaiting Prerequisites / Ready for Implementation]
**Description**: ...
**Prerequisites**: ...
**Implementation Steps**: ...

---

## Completed Features

_(Move features here after full production implementation)_

- ✅ **Temporary HP System** - Implemented with database, API, and UI (2025-12-21)
- ✅ **Player Card Redesign** - 4-column grid layout with dropdown menu (2025-12-21)
- ✅ **Condition Badges** - Visual status indicators for active conditions (Prior)

---

**Last Updated**: 2025-12-21
