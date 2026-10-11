import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const NEW_COLUMNS = [
  ['token_version', 'INT UNSIGNED NOT NULL DEFAULT 0'],
  ['is_active', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['last_login_at', 'DATETIME NULL DEFAULT NULL'],
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });
  try {
    const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
    await connection.query(schema);

    const [existing] = await connection.execute(
      "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'",
    );
    const present = new Set(existing.map((column) => column.name));
    for (const [name, definition] of NEW_COLUMNS) {
      if (present.has(name)) continue;
      await connection.query(`ALTER TABLE users ADD COLUMN \`${name}\` ${definition}`);
      console.log(`Added users.${name}`);
    }
    console.log('Migration complete.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error(`Migration failed: ${err.message}`); process.exitCode = 1; });
