const createTablesSQL = `
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'player' CHECK(role IN ('admin', 'player')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Campaigns table
  CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dm_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Encounters table
  CREATE TABLE IF NOT EXISTS encounters (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50) CHECK(difficulty IN ('easy', 'medium', 'hard', 'deadly')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed')),
    current_round INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  );

  -- Monsters table (for encounter participants)
  CREATE TABLE IF NOT EXISTS monsters (
    id SERIAL PRIMARY KEY,
    encounter_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    dnd_api_id VARCHAR(255),
    max_hp INTEGER NOT NULL,
    current_hp INTEGER NOT NULL,
    armor_class INTEGER NOT NULL,
    initiative_bonus INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
  );

  -- Monster actions table (combat abilities for monsters)
  CREATE TABLE IF NOT EXISTS monster_actions (
    id SERIAL PRIMARY KEY,
    monster_id INTEGER NOT NULL,
    action_category VARCHAR(50) NOT NULL CHECK(action_category IN ('action', 'legendary', 'special', 'reaction')),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
  );

  -- Players table (campaign participants)
  CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    user_id INTEGER,
    character_name VARCHAR(255) NOT NULL,
    character_class VARCHAR(100),
    level INTEGER DEFAULT 1,
    max_hp INTEGER NOT NULL,
    current_hp INTEGER NOT NULL,
    armor_class INTEGER NOT NULL,
    initiative_bonus INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    speed INTEGER DEFAULT 30,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Initiative tracker table (for active combat)
  CREATE TABLE IF NOT EXISTS initiative_tracker (
    id SERIAL PRIMARY KEY,
    encounter_id INTEGER NOT NULL,
    participant_type VARCHAR(50) NOT NULL CHECK(participant_type IN ('player', 'monster')),
    participant_id INTEGER NOT NULL,
    initiative INTEGER NOT NULL,
    turn_order INTEGER NOT NULL,
    is_current_turn BOOLEAN DEFAULT false,
    conditions TEXT,
    temp_hp INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm_user_id);
  CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounters(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_monsters_encounter ON monsters(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_monster_actions_monster ON monster_actions(monster_id);
  CREATE INDEX IF NOT EXISTS idx_monster_actions_category ON monster_actions(monster_id, action_category);
  CREATE INDEX IF NOT EXISTS idx_players_campaign ON players(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
  CREATE INDEX IF NOT EXISTS idx_initiative_encounter ON initiative_tracker(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_initiative_turn ON initiative_tracker(encounter_id, turn_order);
`;

module.exports = { createTablesSQL };
