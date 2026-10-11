// Test helper: an in-memory SQLite database exposed through the small subset of the mysql2 connection API
// (execute) that the CLI helpers use. This runs the real SQL statements of utils/userOps.js and
// utils/adminGuard.js, but on SQLite, not MySQL (" FOR UPDATE" is dropped; SQLite serialises writes).
let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch { /* node:sqlite needs Node 22.5+; tests skip themselves */ }

export const sqliteAvailable = DatabaseSync !== null;

const SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_number TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  token_version INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL, father_name TEXT, gender TEXT, date_of_birth TEXT, phone TEXT, email TEXT,
  course TEXT, branch TEXT, \`year\` TEXT, address TEXT, last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, actor_roll_number TEXT, action TEXT NOT NULL,
  target_user_id INTEGER, target_roll_number TEXT, details TEXT, ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const connection = {
    async execute(sql, params = []) {
      const statement = db.prepare(sql.replace(/\s+FOR UPDATE\s*$/i, ''));
      if (/^\s*select/i.test(sql)) return [statement.all(...params)];
      const result = statement.run(...params);
      return [{ affectedRows: result.changes, insertId: Number(result.lastInsertRowid) }];
    },
  };
  // Same contract as withTransaction in config/db.js: commit on success, roll back on any error.
  const tx = async (work) => {
    db.exec('BEGIN');
    try {
      const result = await work(connection);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const addUser = (roll, { role = 'user', active = 1, hash = `hash-of-${roll}`, name = `Name ${roll}`, tv = 0 } = {}) =>
    db.prepare('INSERT INTO users (roll_number, password_hash, role, is_active, token_version, name) VALUES (?,?,?,?,?,?)')
      .run(roll, hash, role, active, tv, name);
  return { db, connection, tx, one, all, addUser };
}
