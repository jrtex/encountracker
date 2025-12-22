const database = require('../server/utils/database');

describe('Monster Actions Migration', () => {
  beforeAll(async () => {
    await database.connect();
  });

  test('should create monster_actions table with correct schema', async () => {
    // Check table exists
    const tables = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='monster_actions'"
    );
    expect(tables.length).toBe(1);

    // Check columns
    const columns = await database.all('PRAGMA table_info(monster_actions)');
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('monster_id');
    expect(columnNames).toContain('action_category');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('description');
    expect(columnNames).toContain('created_at');
  });

  test('should create indexes on monster_id', async () => {
    const indexes = await database.all(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='monster_actions'"
    );
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_monster_actions_monster');
    expect(indexNames).toContain('idx_monster_actions_category');
  });

  test('should enforce foreign key constraint to monsters table', async () => {
    const fks = await database.all('PRAGMA foreign_key_list(monster_actions)');
    const monsterFk = fks.find(fk => fk.table === 'monsters');
    expect(monsterFk).toBeDefined();
    expect(monsterFk.on_delete).toBe('CASCADE');
  });

  test('should enforce CHECK constraint on action_category', async () => {
    // Get table creation SQL
    const tableInfo = await database.get(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='monster_actions'"
    );

    // Check that the CHECK constraint exists
    expect(tableInfo.sql).toContain('CHECK');
    expect(tableInfo.sql).toContain("action_category IN ('action', 'legendary', 'special', 'reaction')");
  });
});
