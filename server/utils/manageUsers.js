import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import pool, { withTransaction } from '../config/db.js';
import { promptHidden } from './promptHidden.js';
import {
  createUserRecord, CLI_ACTOR, deleteUserByRoll, resetPasswordByRoll, setRoleByRoll,
} from './userOps.js';
import { logAudit } from './audit.js';
import { validateDetails, validatePassword, validateRollNumber } from './validators.js';

const USAGE = `Usage: npm run users -- <command>
  list                           List all users (roll number, name, role, status)
  reset-password <roll> [pass]   Set a new password and sign the user out everywhere
  set-role <roll> <user|admin>   Change a user's role
  create-admin <roll> <name> [pass]  Create an administrator
  delete <roll>                  Delete a user
Passwords: omit [pass] to be prompted (hidden input; leave empty to generate a random one), or set the
IRC_PASSWORD environment variable. A password given as an argument works but is visible in shell history.
The last active administrator can never be deleted or demoted.
Add users with: npm run import-users -- <file.json>`;

const generatePassword = () => randomBytes(9).toString('base64url');

function normalizeRoll(input) {
  const roll = validateRollNumber(input);
  if (roll.error) throw new Error(`${roll.error}\n${USAGE}`);
  return roll.value;
}

// Returns { password, generated }.
async function resolvePassword(argument) {
  let password = argument;
  if (password !== undefined) {
    console.error('Warning: a password passed as a command-line argument can be read from shell history and the process list.');
  } else if (process.env.IRC_PASSWORD) {
    password = process.env.IRC_PASSWORD;
  } else if (process.stdin.isTTY) {
    const first = await promptHidden('New password (leave empty to generate a random one): ');
    if (first) {
      const second = await promptHidden('Repeat password: ');
      if (first !== second) throw new Error('Passwords do not match.');
      password = first;
    }
  }
  if (password === undefined || password === '') return { password: generatePassword(), generated: true };
  const error = validatePassword(password);
  if (error) throw new Error(error);
  return { password, generated: false };
}

async function run([command, rollArg, extra, fourth]) {
  switch (command) {
    case 'list': {
      const [rows] = await pool.execute(
        "SELECT roll_number, name, role, IF(is_active = 1, 'active', 'disabled') AS status FROM users ORDER BY roll_number",
      );
      console.table(rows);
      break;
    }
    case 'reset-password': {
      const roll = normalizeRoll(rollArg);
      const { password, generated } = await resolvePassword(extra);
      const hash = await bcrypt.hash(password, 12);
      await withTransaction((connection) => resetPasswordByRoll(connection, roll, hash));
      console.log(generated ? `Password for ${roll} is now: ${password}` : `Password for ${roll} was changed.`);
      break;
    }
    case 'set-role': {
      const roll = normalizeRoll(rollArg);
      const { changed } = await withTransaction((connection) => setRoleByRoll(connection, roll, extra));
      console.log(changed ? `${roll} is now ${extra}.` : `${roll} already has the role ${extra}; nothing changed.`);
      break;
    }
    case 'create-admin': {
      const roll = normalizeRoll(rollArg);
      const { values, errors } = validateDetails({ name: extra });
      if (errors.name) throw new Error(`Name: ${errors.name}\n${USAGE}`);
      const { password, generated } = await resolvePassword(fourth);
      const hash = await bcrypt.hash(password, 12);
      await withTransaction(async (connection) => {
        const id = await createUserRecord(connection, {
          rollNumber: roll, passwordHash: hash, role: 'admin', details: { name: values.name },
        });
        await logAudit(connection, CLI_ACTOR, 'user_created', { id, roll_number: roll }, 'role: admin (via CLI)');
      });
      console.log(generated ? `Administrator ${roll} created. Password: ${password}` : `Administrator ${roll} created.`);
      break;
    }
    case 'delete': {
      const roll = normalizeRoll(rollArg);
      await withTransaction((connection) => deleteUserByRoll(connection, roll));
      console.log(`Deleted ${roll}.`);
      break;
    }
    default:
      throw new Error(USAGE);
  }
}

run(process.argv.slice(2))
  .catch((err) => {
    // Errors from the database driver carry a code; show the code and message only (never SQL or values).
    console.error(err.code ? `Failed: ${err.code}: ${err.message}` : err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
