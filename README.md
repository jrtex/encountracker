# D&D Encounter Tracker

A web application for Dungeon Masters to plan and manage Dungeons & Dragons combat encounters.

## Features

### Character Management
- Add and track player characters
- Store character stats: HP, Armor Class
- Full heal characters between encounters
- Characters persist across sessions

### Encounter Planning
- Create named encounters with descriptions
- Add monsters from D&D 5e API or manually
- Browse and search hundreds of official D&D monsters
- Add multiple instances of the same monster
- Plan encounters in advance

### Combat Tracking
- Initiative order management (editable during combat)
- Turn-by-turn combat tracker
- Real-time HP tracking with visual health bars
- Apply damage or healing to combatants
- Clear indication of current turn
- Track unconscious/dead combatants

### Data Management
- Auto-save to browser LocalStorage
- Export encounters and characters to JSON files
- Import saved data from files
- Backup and share your game data

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

Visit http://localhost:5173/ to use the application.

### Build for Production
```bash
npm run build
```

### Testing
```bash
npm run test          # Run tests in watch mode
npm run test:ui       # Run tests with interactive UI
npm run test:run      # Run tests once (CI mode)
npm run test:coverage # Run tests with coverage report
```

## How to Use

### 1. Add Player Characters
- Navigate to the "Characters" tab
- Click "Add Character"
- Enter character name, max HP, and armor class
- Your party members are now saved

### 2. Plan an Encounter
- Go to the "Encounters" tab
- Click "New Encounter"
- Give it a name and optional description
- Click on the encounter to expand it
- Click "Add Monster/NPC" to add enemies
  - Choose "From API" to browse D&D 5e monsters
  - Choose "Manual Entry" to create custom NPCs
- Add as many monsters as needed

### 3. Start Combat
- Click "Start" on a planned encounter
- The app automatically switches to "Active Combat" tab
- All player characters and monsters are added as combatants

### 4. Track Initiative
- Edit initiative values for each combatant
- The list automatically sorts by initiative (highest first)
- Current turn is highlighted in yellow

### 5. Track Damage
- Enter damage/healing amount in the input field
- Click "Damage" to reduce HP
- Click "Heal" to restore HP
- HP bars change color based on remaining health
- Click "Next Turn" to advance to the next combatant

### 6. End Combat
- Click "End Encounter" when combat is finished
- Encounter returns to planning mode
- All combat data is cleared

### 7. Export/Import
- Click "Export Data" in the header to download your data
- Click "Import Data" to restore from a backup file
- Great for sharing campaigns or backing up your work

## To-do Features

### MVP Features
- ✅ Show monster actions & features
- ✅ Add multiple of a type of monster
- ✅ Support statuses (blinded, prone, poisoned, etc)
- ✅ Support temporary HP
- ✅ Use initiative as modifier, allow PC to roll their own total
- Support in-app rolling, including automatic initiative modifier
  - Button to roll for all, or all monsters
- ✅ When starting encounter, go to current combat screen
- ✅ Don't hide the encounter when it is active, but list it as read-only
- ✅ Basic unit tests
- Build and publish application
- Configuration (port)
- Password/security
- ✅ Confirmation window when deleting objects
- ✅ Mark players/npc as dead or out of combat during encounter.

### Nice-to-Have Features
- Nicer UI
  - left-right carousel to show turn order instead of top-bottom
  - Unified button style
- Github actions to run unit tests on commit
- DM-only and Player-only views
- Campaign management with new sets of players and saved encounters
- Move encounters to finished encounters after combat
- Edit encounters (rename, desc, status)
- Add image map file to Encounter. Track players and npc movements on map during encounter.

## Tech Stack

- React + TypeScript
- Vite (build tool)
- D&D 5e API (https://www.dnd5eapi.co/)
- LocalStorage for persistence
- Vitest + React Testing Library (testing)

## Development

Built with React and TypeScript for type safety. Uses Context API for state management. All data is stored in browser LocalStorage and automatically saves on every change.

### Testing

The project uses Vitest and React Testing Library for comprehensive unit testing:
- All state management functions have tests
- Components have interaction tests
- LocalStorage persistence is tested
- 26 tests covering critical features

**When adding new features, always add corresponding tests!** See `CLAUDE.md` for testing guidelines.

## License

This is a personal project for D&D game management. D&D and all related content are property of Wizards of the Coast.
