const createTablesSQL = `
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('admin', 'player')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Campaigns table
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    dm_user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Encounters table
  CREATE TABLE IF NOT EXISTS encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard', 'deadly')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  );

  -- Monsters table (for encounter participants)
  CREATE TABLE IF NOT EXISTS monsters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    dnd_api_id TEXT,
    max_hp INTEGER NOT NULL,
    current_hp INTEGER NOT NULL,
    armor_class INTEGER NOT NULL,
    initiative_bonus INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
  );

  -- Players table (campaign participants)
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    user_id INTEGER,
    character_name TEXT NOT NULL,
    character_class TEXT,
    level INTEGER DEFAULT 1,
    max_hp INTEGER NOT NULL,
    current_hp INTEGER NOT NULL,
    armor_class INTEGER NOT NULL,
    initiative_bonus INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    speed INTEGER DEFAULT 30,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Initiative tracker table (for active combat)
  CREATE TABLE IF NOT EXISTS initiative_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL,
    participant_type TEXT NOT NULL CHECK(participant_type IN ('player', 'monster')),
    participant_id INTEGER NOT NULL,
    initiative INTEGER NOT NULL,
    turn_order INTEGER NOT NULL,
    is_current_turn BOOLEAN DEFAULT 0,
    conditions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm_user_id);
  CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounters(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_monsters_encounter ON monsters(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_players_campaign ON players(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
  CREATE INDEX IF NOT EXISTS idx_initiative_encounter ON initiative_tracker(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_initiative_turn ON initiative_tracker(encounter_id, turn_order);
`;

module.exports = { createTablesSQL };
