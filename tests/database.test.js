const database = require('../server/utils/database');

describe('Database Utility', () => {
  beforeAll(async () => {
    // Ensure database is connected
    if (!database.db) {
      await database.connect();
    }
  });

  beforeEach(async () => {
    // Clean up any existing tables before each test
    // This ensures tests are isolated
    await database.exec(`
      DROP TABLE IF EXISTS test_table;
      DROP TABLE IF EXISTS test_users;
      DROP TABLE IF EXISTS test_products;
      DROP TABLE IF EXISTS test_items;
      DROP TABLE IF EXISTS accounts;
      DROP TABLE IF EXISTS child;
      DROP TABLE IF EXISTS parent;
    `);
  });

  describe('connect', () => {
    test('should have database connected', async () => {
      expect(database.db).toBeDefined();
    });

    test('should enable foreign keys on connection', async () => {
      // Verify foreign keys are enabled
      const result = await database.get('PRAGMA foreign_keys');
      expect(result.foreign_keys).toBe(1);
    });

    test('should be SQLite type', () => {
      expect(database.dbType).toBe('sqlite');
    });
  });

  describe('exec', () => {
    test('should execute SQL statements successfully', async () => {
      const sql = `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
        INSERT INTO test_table (name) VALUES ('test1');
        INSERT INTO test_table (name) VALUES ('test2');
      `;

      await expect(database.exec(sql)).resolves.not.toThrow();

      // Verify data was inserted
      const rows = await database.all('SELECT * FROM test_table');
      expect(rows).toHaveLength(2);
    });

    test('should reject invalid SQL', async () => {
      const invalidSql = 'INVALID SQL STATEMENT';

      await expect(database.exec(invalidSql)).rejects.toThrow();
    });
  });

  describe('run', () => {
    beforeEach(async () => {
      await database.exec(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          email TEXT NOT NULL
        )
      `);
    });

    test('should insert data and return lastID', async () => {
      const result = await database.run(
        'INSERT INTO test_users (username, email) VALUES (?, ?)',
        ['testuser', 'test@example.com']
      );

      expect(result.lastID).toBeDefined();
      expect(result.lastID).toBeGreaterThan(0);
      expect(result.changes).toBe(1);
    });

    test('should update data and return changes count', async () => {
      // Insert test data
      await database.run(
        'INSERT INTO test_users (username, email) VALUES (?, ?)',
        ['user1', 'user1@example.com']
      );
      await database.run(
        'INSERT INTO test_users (username, email) VALUES (?, ?)',
        ['user2', 'user2@example.com']
      );

      // Update all users
      const result = await database.run(
        "UPDATE test_users SET email = 'updated@example.com'"
      );

      expect(result.changes).toBe(2);
    });

    test('should delete data and return changes count', async () => {
      // Insert test data
      await database.run(
        'INSERT INTO test_users (username, email) VALUES (?, ?)',
        ['user1', 'user1@example.com']
      );
      await database.run(
        'INSERT INTO test_users (username, email) VALUES (?, ?)',
        ['user2', 'user2@example.com']
      );

      // Delete one user
      const result = await database.run(
        'DELETE FROM test_users WHERE username = ?',
        ['user1']
      );

      expect(result.changes).toBe(1);

      // Verify only one user remains
      const remaining = await database.all('SELECT * FROM test_users');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].username).toBe('user2');
    });

    test('should handle parameterized queries safely', async () => {
      const maliciousInput = "'; DROP TABLE test_users; --";

      await database.run(
        'INSERT INTO test_users (username, email) VALUES (?, ?)',
        [maliciousInput, 'test@example.com']
      );

      // Table should still exist and contain the malicious string as data
      const users = await database.all('SELECT * FROM test_users');
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe(maliciousInput);
    });

    test('should reject query with SQL syntax error', async () => {
      await expect(
        database.run('INSERT INTO nonexistent_table (col) VALUES (?)', ['value'])
      ).rejects.toThrow();
    });

    test('should work with empty params array', async () => {
      const result = await database.run(
        "INSERT INTO test_users (username, email) VALUES ('test', 'test@example.com')",
        []
      );

      expect(result.lastID).toBeDefined();
    });

    test('should work without params argument', async () => {
      const result = await database.run(
        "INSERT INTO test_users (username, email) VALUES ('test', 'test@example.com')"
      );

      expect(result.lastID).toBeDefined();
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await database.exec(`
        CREATE TABLE test_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL
        )
      `);
      await database.run('INSERT INTO test_products (name, price) VALUES (?, ?)', ['Product A', 10.99]);
      await database.run('INSERT INTO test_products (name, price) VALUES (?, ?)', ['Product B', 20.50]);
      await database.run('INSERT INTO test_products (name, price) VALUES (?, ?)', ['Product C', 15.00]);
    });

    test('should retrieve single row', async () => {
      const product = await database.get(
        'SELECT * FROM test_products WHERE name = ?',
        ['Product A']
      );

      expect(product).toBeDefined();
      expect(product.name).toBe('Product A');
      expect(product.price).toBe(10.99);
    });

    test('should return undefined when no row matches', async () => {
      const product = await database.get(
        'SELECT * FROM test_products WHERE name = ?',
        ['Nonexistent']
      );

      expect(product).toBeUndefined();
    });

    test('should return first row when multiple rows match', async () => {
      // Insert duplicate names
      await database.run('INSERT INTO test_products (name, price) VALUES (?, ?)', ['Duplicate', 5.00]);
      await database.run('INSERT INTO test_products (name, price) VALUES (?, ?)', ['Duplicate', 10.00]);

      const product = await database.get(
        'SELECT * FROM test_products WHERE name = ?',
        ['Duplicate']
      );

      expect(product).toBeDefined();
      expect(product.name).toBe('Duplicate');
      expect(product.price).toBe(5.00); // First inserted
    });

    test('should work with complex queries', async () => {
      const product = await database.get(
        'SELECT * FROM test_products WHERE price > ? ORDER BY price ASC LIMIT 1',
        [15.00]
      );

      expect(product).toBeDefined();
      expect(product.name).toBe('Product B');
      expect(product.price).toBe(20.50);
    });

    test('should work without params', async () => {
      const product = await database.get(
        'SELECT * FROM test_products ORDER BY id LIMIT 1'
      );

      expect(product).toBeDefined();
      expect(product.name).toBe('Product A');
    });
  });

  describe('all', () => {
    beforeEach(async () => {
      await database.exec(`
        CREATE TABLE test_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT,
          value INTEGER
        )
      `);
      await database.run('INSERT INTO test_items (category, value) VALUES (?, ?)', ['A', 10]);
      await database.run('INSERT INTO test_items (category, value) VALUES (?, ?)', ['B', 20]);
      await database.run('INSERT INTO test_items (category, value) VALUES (?, ?)', ['A', 30]);
      await database.run('INSERT INTO test_items (category, value) VALUES (?, ?)', ['C', 40]);
    });

    test('should retrieve all matching rows', async () => {
      const items = await database.all(
        'SELECT * FROM test_items WHERE category = ?',
        ['A']
      );

      expect(items).toHaveLength(2);
      expect(items[0].category).toBe('A');
      expect(items[0].value).toBe(10);
      expect(items[1].category).toBe('A');
      expect(items[1].value).toBe(30);
    });

    test('should return empty array when no rows match', async () => {
      const items = await database.all(
        'SELECT * FROM test_items WHERE category = ?',
        ['Z']
      );

      expect(items).toEqual([]);
      expect(items).toHaveLength(0);
    });

    test('should retrieve all rows without filter', async () => {
      const items = await database.all('SELECT * FROM test_items');

      expect(items).toHaveLength(4);
    });

    test('should respect ORDER BY clause', async () => {
      const items = await database.all(
        'SELECT * FROM test_items ORDER BY value DESC'
      );

      expect(items).toHaveLength(4);
      expect(items[0].value).toBe(40);
      expect(items[1].value).toBe(30);
      expect(items[2].value).toBe(20);
      expect(items[3].value).toBe(10);
    });

    test('should work with aggregate functions', async () => {
      const result = await database.all(
        'SELECT category, COUNT(*) as count, SUM(value) as total FROM test_items GROUP BY category'
      );

      expect(result).toHaveLength(3);

      const categoryA = result.find(r => r.category === 'A');
      expect(categoryA.count).toBe(2);
      expect(categoryA.total).toBe(40);
    });

    test('should work without params', async () => {
      const items = await database.all('SELECT * FROM test_items LIMIT 2');

      expect(items).toHaveLength(2);
    });
  });

  describe('Foreign key enforcement', () => {
    beforeEach(async () => {
      await database.exec(`
        CREATE TABLE parent (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT
        );
        CREATE TABLE child (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER,
          name TEXT,
          FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE CASCADE
        );
      `);
    });

    test('should enforce foreign key constraints', async () => {
      // Try to insert child with non-existent parent
      await expect(
        database.run('INSERT INTO child (parent_id, name) VALUES (?, ?)', [999, 'orphan'])
      ).rejects.toThrow();
    });

    test('should allow valid foreign key relationships', async () => {
      // Insert parent
      const parentResult = await database.run(
        'INSERT INTO parent (name) VALUES (?)',
        ['Parent 1']
      );

      // Insert child with valid parent_id
      await expect(
        database.run('INSERT INTO child (parent_id, name) VALUES (?, ?)', [
          parentResult.lastID,
          'Child 1'
        ])
      ).resolves.not.toThrow();

      const children = await database.all('SELECT * FROM child');
      expect(children).toHaveLength(1);
    });

    test('should cascade delete when parent is deleted', async () => {
      // Insert parent and child
      const parentResult = await database.run(
        'INSERT INTO parent (name) VALUES (?)',
        ['Parent 1']
      );
      await database.run(
        'INSERT INTO child (parent_id, name) VALUES (?, ?)',
        [parentResult.lastID, 'Child 1']
      );

      // Delete parent
      await database.run('DELETE FROM parent WHERE id = ?', [parentResult.lastID]);

      // Child should be automatically deleted
      const children = await database.all('SELECT * FROM child');
      expect(children).toHaveLength(0);
    });
  });

  describe('Transaction-like behavior', () => {
    beforeEach(async () => {
      await database.exec(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          balance REAL
        )
      `);
    });

    test('should handle multiple sequential operations', async () => {
      await database.run('INSERT INTO accounts (name, balance) VALUES (?, ?)', ['Alice', 100]);
      await database.run('INSERT INTO accounts (name, balance) VALUES (?, ?)', ['Bob', 50]);

      // Transfer money (simplified, not a real transaction)
      await database.run('UPDATE accounts SET balance = balance - ? WHERE name = ?', [25, 'Alice']);
      await database.run('UPDATE accounts SET balance = balance + ? WHERE name = ?', [25, 'Bob']);

      const alice = await database.get('SELECT balance FROM accounts WHERE name = ?', ['Alice']);
      const bob = await database.get('SELECT balance FROM accounts WHERE name = ?', ['Bob']);

      expect(alice.balance).toBe(75);
      expect(bob.balance).toBe(75);
    });
  });
});
