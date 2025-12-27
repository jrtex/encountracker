const database = require('../server/utils/database');
const { createTablesSQL } = require('../server/models/schema');

describe('Monster Actions Migration', () => {
  beforeAll(async () => {
    await database.connect();

    // Drop existing tables to ensure clean schema
    await database.exec(`
      DROP TABLE IF EXISTS initiative_tracker CASCADE;
      DROP TABLE IF EXISTS monster_actions CASCADE;
      DROP TABLE IF EXISTS monsters CASCADE;
      DROP TABLE IF EXISTS players CASCADE;
      DROP TABLE IF EXISTS encounters CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create all tables using the schema (which includes monster_actions)
    await database.exec(createTablesSQL);
  });

  test('should create monster_actions table with correct schema', async () => {
    // Check table exists (PostgreSQL)
    const tables = await database.all(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monster_actions'"
    );
    expect(tables.length).toBe(1);

    // Check columns (PostgreSQL)
    const columns = await database.all(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monster_actions'"
    );
    const columnNames = columns.map(c => c.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('monster_id');
    expect(columnNames).toContain('action_category');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('description');
    expect(columnNames).toContain('created_at');
  });

  test('should create indexes on monster_id', async () => {
    // Check indexes (PostgreSQL)
    const indexes = await database.all(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'monster_actions'"
    );
    const indexNames = indexes.map(i => i.indexname);
    expect(indexNames).toContain('idx_monster_actions_monster');
    expect(indexNames).toContain('idx_monster_actions_category');
  });

  test('should enforce foreign key constraint to monsters table', async () => {
    // Check foreign keys (PostgreSQL)
    const fks = await database.all(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'monster_actions'
    `);

    const monsterFk = fks.find(fk => fk.foreign_table_name === 'monsters');
    expect(monsterFk).toBeDefined();
    expect(monsterFk.delete_rule).toBe('CASCADE');
  });

  test('should enforce CHECK constraint on action_category', async () => {
    // Check for CHECK constraint (PostgreSQL)
    const constraints = await database.all(`
      SELECT
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'monster_actions'
        AND con.contype = 'c'
    `);

    // Find the CHECK constraint for action_category
    const categoryConstraint = constraints.find(c =>
      c.constraint_definition.includes('action_category')
    );

    expect(categoryConstraint).toBeDefined();
    expect(categoryConstraint.constraint_definition).toContain('action');
    expect(categoryConstraint.constraint_definition).toContain('legendary');
    expect(categoryConstraint.constraint_definition).toContain('special');
    expect(categoryConstraint.constraint_definition).toContain('reaction');
  });
});
