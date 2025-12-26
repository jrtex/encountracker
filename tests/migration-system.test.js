const database = require('../server/utils/database');
const {
  runMigrations,
  createMigrationsTable,
  getAppliedMigrations,
  discoverMigrations
} = require('../server/utils/migrationRunner');

describe('Migration System', () => {
  beforeAll(async () => {
    await database.connect();
  });

  beforeEach(async () => {
    // Clean slate for each test - drop all tables in reverse dependency order
    await database.exec(`
      DROP TABLE IF EXISTS initiative_tracker;
      DROP TABLE IF EXISTS monster_actions;
      DROP TABLE IF EXISTS monsters;
      DROP TABLE IF EXISTS players;
      DROP TABLE IF EXISTS encounters;
      DROP TABLE IF EXISTS campaigns;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS schema_migrations;
    `);
  });

  describe('Migration Table Creation', () => {
    test('should create schema_migrations table', async () => {
      await createMigrationsTable();

      const tables = await database.all(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'"
      );

      expect(tables.length).toBe(1);
    });

    test('should create index on migration_name', async () => {
      await createMigrationsTable();

      const indexes = await database.all(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_migrations_name'"
      );

      expect(indexes.length).toBe(1);
    });

    test('should have correct columns', async () => {
      await createMigrationsTable();

      const columns = await database.all(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_migrations'"
      );
      const columnNames = columns.map(col => col.column_name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('migration_name');
      expect(columnNames).toContain('applied_at');
      expect(columnNames).toContain('execution_time_ms');
      expect(columnNames).toContain('success');
      expect(columnNames).toContain('error_message');
    });
  });

  describe('Migration Discovery', () => {
    test('should discover all migration files', () => {
      const migrations = discoverMigrations();

      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations).toContain('000_bootstrap_existing_schema');
      expect(migrations).toContain('001_add_is_active');
      expect(migrations).toContain('002_add_speed');
      expect(migrations).toContain('003_add_round');
      expect(migrations).toContain('004_add_monster_actions');
    });

    test('should return migrations in sequential order', () => {
      const migrations = discoverMigrations();

      // Check that migrations are sorted
      for (let i = 1; i < migrations.length; i++) {
        expect(migrations[i] > migrations[i - 1]).toBe(true);
      }
    });

    test('should return filenames without .js extension', () => {
      const migrations = discoverMigrations();

      migrations.forEach(migration => {
        expect(migration.endsWith('.js')).toBe(false);
      });
    });
  });

  describe('Get Applied Migrations', () => {
    test('should return empty array when no migrations applied', async () => {
      await createMigrationsTable();

      const applied = await getAppliedMigrations();

      expect(applied).toEqual([]);
    });

    test('should return list of applied migrations', async () => {
      await createMigrationsTable();

      // Manually insert some applied migrations
      await database.run(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, success)
         VALUES (?, ?, ?)`,
        ['001_add_is_active', 50, 1]
      );
      await database.run(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, success)
         VALUES (?, ?, ?)`,
        ['002_add_speed', 30, 1]
      );

      const applied = await getAppliedMigrations();

      expect(applied).toHaveLength(2);
      expect(applied).toContain('001_add_is_active');
      expect(applied).toContain('002_add_speed');
    });

    test('should only return successful migrations', async () => {
      await createMigrationsTable();

      // Insert successful and failed migrations
      await database.run(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, success)
         VALUES (?, ?, ?)`,
        ['001_add_is_active', 50, 1]
      );
      await database.run(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, success, error_message)
         VALUES (?, ?, ?, ?)`,
        ['002_add_speed', 30, 0, 'Test error']
      );

      const applied = await getAppliedMigrations();

      expect(applied).toHaveLength(1);
      expect(applied).toContain('001_add_is_active');
      expect(applied).not.toContain('002_add_speed');
    });
  });

  describe('Full Migration Run', () => {
    beforeEach(async () => {
      // Create base tables (simulates initializeDatabase())
      const schema = require('../server/models/schema');
      await database.exec(schema.createTablesSQL);
    });

    test('should execute all migrations on fresh database', async () => {
      await runMigrations();

      const applied = await getAppliedMigrations();

      expect(applied).toContain('000_bootstrap_existing_schema');
      expect(applied).toContain('001_add_is_active');
      expect(applied).toContain('002_add_speed');
      expect(applied).toContain('003_add_round');
      expect(applied).toContain('004_add_monster_actions');
    });

    test('should not re-run applied migrations', async () => {
      // Run migrations twice
      await runMigrations();
      await runMigrations();

      // Each migration should only have one success record
      const records = await database.all(
        'SELECT migration_name, COUNT(*) as count FROM schema_migrations WHERE success = 1 GROUP BY migration_name'
      );

      records.forEach(record => {
        expect(record.count).toBe(1);
      });
    });

    test('should execute migrations in sequential order', async () => {
      await runMigrations();

      const applied = await database.all(
        'SELECT migration_name FROM schema_migrations WHERE success = 1 ORDER BY migration_name'
      );

      // All migrations should be present
      expect(applied).toHaveLength(5);

      // When sorted by name, they should be in sequential order
      const migrationNames = applied.map(m => m.migration_name);
      expect(migrationNames).toEqual([
        '000_bootstrap_existing_schema',
        '001_add_is_active',
        '002_add_speed',
        '003_add_round',
        '004_add_monster_actions'
      ]);
    });

    test('should record execution time for each migration', async () => {
      await runMigrations();

      const records = await database.all(
        'SELECT migration_name, execution_time_ms FROM schema_migrations WHERE success = 1'
      );

      records.forEach(record => {
        expect(typeof record.execution_time_ms).toBe('number');
        expect(record.execution_time_ms).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Bootstrap Migration', () => {
    test('should not mark any migrations as applied on fresh database', async () => {
      await createMigrationsTable();

      const bootstrap = require('../server/migrations/000_bootstrap_existing_schema');
      await bootstrap.up();

      // Bootstrap itself won't be in tracking yet (that's done by migrationRunner)
      const nonBootstrapMigrations = await database.all(
        "SELECT migration_name FROM schema_migrations WHERE migration_name != '000_bootstrap_existing_schema'"
      );

      expect(nonBootstrapMigrations).toHaveLength(0);
    });

    test('should detect and mark existing schema changes', async () => {
      // Create base tables first
      await database.exec(`
        CREATE TABLE users (id SERIAL PRIMARY KEY);
        CREATE TABLE campaigns (id SERIAL PRIMARY KEY);
        CREATE TABLE encounters (id SERIAL PRIMARY KEY);
        CREATE TABLE players (
          id SERIAL PRIMARY KEY,
          character_name TEXT,
          is_active BOOLEAN DEFAULT true,
          speed INTEGER DEFAULT 30
        );
        CREATE TABLE monster_actions (id SERIAL PRIMARY KEY);
      `);

      await createMigrationsTable();

      const bootstrap = require('../server/migrations/000_bootstrap_existing_schema');
      await bootstrap.up();

      const markedMigrations = await database.all(
        "SELECT migration_name FROM schema_migrations"
      );

      const migrationNames = markedMigrations.map(m => m.migration_name);

      expect(migrationNames).toContain('001_add_is_active');
      expect(migrationNames).toContain('002_add_speed');
      expect(migrationNames).toContain('004_add_monster_actions');
    });
  });

  describe('Idempotency', () => {
    test('migrations should be safe to run multiple times', async () => {
      // Create base tables
      await database.exec(`
        CREATE TABLE users (id SERIAL PRIMARY KEY);
        CREATE TABLE campaigns (id SERIAL PRIMARY KEY);
        CREATE TABLE encounters (id SERIAL PRIMARY KEY);
        CREATE TABLE players (id SERIAL PRIMARY KEY, character_name TEXT);
      `);

      const migration = require('../server/migrations/001_add_is_active');

      // Run migration twice
      await migration.up();
      await migration.up();

      // Should only have one is_active column
      const columns = await database.all(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'players'"
      );
      const isActiveColumns = columns.filter(col => col.column_name === 'is_active');

      expect(isActiveColumns).toHaveLength(1);
    });
  });
});
