import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcrypt';
import pool, { withTransaction } from '../config/db.js';
import { importUsers, prepareImport } from './userOps.js';
import { assertDemoAllowed } from './demoGuard.js';

const USAGE = `Usage: npm run import-users -- <users.json>
Insert-only: users whose roll number already exists are skipped and left unchanged
(password, role, status and details are never overwritten).
Demo data: npm run seed  (development only; needs ALLOW_DEMO_DATA=true in server/.env).`;

const SAMPLE_FILE = new URL('../../database/sample-users.json', import.meta.url);

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    throw new Error(err instanceof SyntaxError ? `${path} is not valid JSON.` : `Cannot read ${path}.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const demoFlag = args.includes('--demo');
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) throw new Error(USAGE);

  const rows = await readJson(file);
  await assertDemoAllowed({ file, users: rows, demoFlag, sampleUrl: SAMPLE_FILE });

  const { valid, problems } = prepareImport(rows);
  if (problems.length) {
    problems.forEach((problem) => console.error(problem));
    throw new Error(`Import cancelled: ${problems.length} invalid row(s). Nothing was imported.`);
  }

  const { created, skipped } = await withTransaction((connection) => importUsers(
    connection, valid, (password) => bcrypt.hash(password, 12),
  ));
  created.forEach((user) => console.log(`Created  ${user.rollNumber} (${user.role})`));
  skipped.forEach((user) => console.log(`Skipped  ${user.rollNumber}: ${user.reason}`));
  console.log(`Done: ${created.length} created, ${skipped.length} skipped.`);
}

main()
  .catch((err) => {
    console.error(err.code ? `Failed: ${err.code}: ${err.message}` : err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
