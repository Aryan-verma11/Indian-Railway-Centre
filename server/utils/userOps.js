// Database operations shared by the command-line tools. They take an open connection and must be run
// inside a transaction (see withTransaction in config/db.js). No third-party imports, so they can be
// unit-tested without a MySQL server.
import { HttpError } from './httpError.js';
import { logAudit } from './audit.js';
import { assertNotLastActiveAdmin, lockUserByRoll } from './adminGuard.js';
import {
  DETAIL_FIELDS, ROLES, validateDetails, validatePassword, validateRole, validateRollNumber,
} from './validators.js';

export const CLI_ACTOR = { actor: { roll_number: 'CLI' }, ip: null };

export async function deleteUserByRoll(connection, rollNumber) {
  const target = await lockUserByRoll(connection, rollNumber);
  await assertNotLastActiveAdmin(connection, target);
  await connection.execute('DELETE FROM users WHERE id = ?', [target.id]);
  await logAudit(connection, CLI_ACTOR, 'user_deleted', target, 'via CLI');
  return target;
}

export async function setRoleByRoll(connection, rollNumber, newRole) {
  const role = validateRole(newRole);
  if (role.error) throw new HttpError(400, role.error);
  const target = await lockUserByRoll(connection, rollNumber);
  if (target.role === role.value) return { target, changed: false };
  if (role.value === 'user') await assertNotLastActiveAdmin(connection, target);
  await connection.execute(
    'UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?', [role.value, target.id],
  );
  await logAudit(connection, CLI_ACTOR, 'role_changed', target, `${target.role} -> ${role.value} (via CLI)`);
  return { target, changed: true };
}

export async function resetPasswordByRoll(connection, rollNumber, passwordHash) {
  const target = await lockUserByRoll(connection, rollNumber);
  if (target.role === 'user') {
    throw new HttpError(409, 'Candidate accounts use registration number and date of birth; password reset is not applicable.');
  }
  await connection.execute(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [passwordHash, target.id],
  );
  await logAudit(connection, CLI_ACTOR, 'password_reset', target, 'via CLI');
  return target;
}

export async function createUserRecord(connection, { rollNumber, passwordHash, role, details }) {
  const [existing] = await connection.execute('SELECT id FROM users WHERE roll_number = ?', [rollNumber]);
  if (existing.length) throw new HttpError(409, `Roll number ${rollNumber} already exists.`);
  const fields = DETAIL_FIELDS.filter((field) => details[field] !== undefined);
  const [result] = await connection.execute(
    `INSERT INTO users (roll_number, password_hash, role${fields.map((f) => `, \`${f}\``).join('')})
     VALUES (?, ?, ?${fields.map(() => ', ?').join('')})`,
    [rollNumber, passwordHash, role, ...fields.map((field) => details[field])],
  );
  return result.insertId;
}

// ---- Import --------------------------------------------------------------------------------------------

// Validates every row. Nothing is written when any row is invalid.
export function prepareImport(rows) {
  if (!Array.isArray(rows)) throw new HttpError(400, 'The import file must contain a JSON array of users.');
  const valid = [];
  const problems = [];
  rows.forEach((row, index) => {
    const label = `Row ${index + 1}${row && typeof row.roll_number === 'string' ? ` (${row.roll_number})` : ''}`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      problems.push(`${label}: not an object.`);
      return;
    }
    const errors = [];
    const roll = validateRollNumber(row.roll_number);
    if (roll.error) errors.push(roll.error);
    const passwordError = validatePassword(row.password);
    if (passwordError) errors.push(passwordError);
    if (row.role !== undefined && !ROLES.includes(row.role)) errors.push('Role must be user or admin.');
    const role = row.role === 'admin' ? 'admin' : 'user';
    const { values, errors: detailErrors } = validateDetails(row);
    if (role === 'user' && !values.date_of_birth) {
      detailErrors.date_of_birth = 'Date of birth is required for candidate login.';
    }
    for (const [field, message] of Object.entries(detailErrors)) errors.push(`${field}: ${message}`);
    if (errors.length) {
      problems.push(`${label}: ${errors.join(' ')}`);
      return;
    }
    valid.push({
      rollNumber: roll.value, password: row.password, role, details: values,
    });
  });
  return { valid, problems };
}

// Insert-only import: a roll number that already exists (in the database or earlier in the same file) is
// skipped and reported. Existing users keep their password, role, token_version, is_active and details, so an
// import can never reset a password or demote the last administrator.
export async function importUsers(connection, prepared, hashPassword) {
  const created = [];
  const skipped = [];
  const seen = new Set();
  for (const user of prepared) {
    if (seen.has(user.rollNumber)) {
      skipped.push({ rollNumber: user.rollNumber, reason: 'duplicate roll number in the import file' });
      continue;
    }
    seen.add(user.rollNumber);
    const [existing] = await connection.execute('SELECT id FROM users WHERE roll_number = ?', [user.rollNumber]);
    if (existing.length) {
      skipped.push({ rollNumber: user.rollNumber, reason: 'already exists; left unchanged' });
      continue;
    }
    const id = await createUserRecord(connection, {
      rollNumber: user.rollNumber,
      passwordHash: await hashPassword(user.password),
      role: user.role,
      details: user.details,
    });
    await logAudit(connection, CLI_ACTOR, 'user_imported', { id, roll_number: user.rollNumber }, `role: ${user.role} (via CLI)`);
    created.push({ rollNumber: user.rollNumber, role: user.role });
  }
  return { created, skipped };
}
