import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import pool, { withTransaction } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { auditContext, logAudit } from '../utils/audit.js';
import { assertNotLastActiveAdmin, lockUser } from '../utils/adminGuard.js';
import {
  DETAIL_FIELDS, validateDetails, validatePassword, validateRole, validateRollNumber,
} from '../utils/validators.js';

const COLUMNS = 'id, roll_number, role, is_active, name, father_name, gender, date_of_birth, phone, email, '
  + 'course, branch, `year`, address, last_login_at, created_at, updated_at';
const FILTER_FIELDS = ['role', 'branch', 'course', 'year'];
const SUMMARY = 'Please correct the highlighted fields.';

const toAdminUser = (row) => ({ ...row, is_active: Boolean(row.is_active) });

function parseId(value) {
  if (!/^\d{1,10}$/.test(value)) throw new HttpError(400, 'Invalid user ID.');
  return Number(value);
}

function rethrowDuplicate(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    throw new HttpError(409, 'Roll number already exists.', { roll_number: 'Roll number already exists.' });
  }
  throw err;
}

async function fetchUser(executor, id) {
  const [rows] = await executor.execute(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id]);
  return rows[0] ? toAdminUser(rows[0]) : null;
}

export async function getStats(req, res) {
  const [[counts]] = await pool.execute(
    "SELECT COUNT(*) AS total, COALESCE(SUM(is_active = 1), 0) AS active, COALESCE(SUM(role = 'admin'), 0) AS admins FROM users",
  );
  const [recent] = await pool.execute(
    'SELECT id, roll_number, name, role, created_at FROM users ORDER BY created_at DESC, id DESC LIMIT 5',
  );
  res.json({ total: Number(counts.total), active: Number(counts.active), admins: Number(counts.admins), recent });
}

export async function listUsers(req, res) {
  const query = req.query;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const conditions = [];
  const params = [];

  if (typeof query.q === 'string' && query.q.trim()) {
    const like = `%${query.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push('(roll_number LIKE ? OR name LIKE ?)');
    params.push(like, like);
  }
  for (const field of FILTER_FIELDS) {
    if (typeof query[field] === 'string' && query[field]) {
      conditions.push(`\`${field}\` = ?`);
      params.push(query[field]);
    }
  }
  if (query.status === 'active' || query.status === 'disabled') {
    conditions.push('is_active = ?');
    params.push(query.status === 'active' ? 1 : 0);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM users ${where}`, params);
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS} FROM users ${where} ORDER BY roll_number LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params,
  );
  const options = {};
  for (const field of ['branch', 'course', 'year']) {
    const [values] = await pool.execute(
      `SELECT DISTINCT \`${field}\` AS value FROM users WHERE \`${field}\` IS NOT NULL ORDER BY 1`,
    );
    options[{ branch: 'branches', course: 'courses', year: 'years' }[field]] = values.map((row) => row.value);
  }
  res.json({ users: rows.map(toAdminUser), total, page, pages: Math.max(1, Math.ceil(total / limit)), options });
}

export async function getUser(req, res) {
  const user = await fetchUser(pool, parseId(req.params.id));
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user });
}

export async function createUser(req, res) {
  const body = req.body || {};
  const { values, errors } = validateDetails(body);
  const roll = validateRollNumber(body.roll_number);
  const role = validateRole(body.role ?? 'user');
  const passwordError = validatePassword(body.password);
  if (roll.error) errors.roll_number = roll.error;
  if (role.error) errors.role = role.error;
  if (role.value === 'user' && !values.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required for candidate login.';
  }
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length) throw new HttpError(400, SUMMARY, errors);

  const passwordHash = await bcrypt.hash(body.password, 12);
  const id = await withTransaction(async (connection) => {
    try {
      const [result] = await connection.execute(
        `INSERT INTO users (roll_number, password_hash, role, ${DETAIL_FIELDS.map((f) => `\`${f}\``).join(', ')})
         VALUES (?, ?, ?, ${DETAIL_FIELDS.map(() => '?').join(', ')})`,
        [roll.value, passwordHash, role.value, ...DETAIL_FIELDS.map((field) => values[field] ?? null)],
      );
      await logAudit(connection, auditContext(req), 'user_created',
        { id: result.insertId, roll_number: roll.value }, `role: ${role.value}`);
      return result.insertId;
    } catch (err) {
      return rethrowDuplicate(err);
    }
  });
  res.status(201).json({ user: await fetchUser(pool, id) });
}

export async function updateUser(req, res) {
  const id = parseId(req.params.id);
  const body = req.body || {};
  const { values, errors } = validateDetails(body, { partial: true });
  if ('roll_number' in body) {
    const roll = validateRollNumber(body.roll_number);
    if (roll.error) errors.roll_number = roll.error;
    else values.roll_number = roll.value;
  }
  if (Object.keys(errors).length) throw new HttpError(400, SUMMARY, errors);
  if ('date_of_birth' in values && values.date_of_birth === null) {
    const existing = await fetchUser(pool, id);
    if (existing?.role === 'user') {
      throw new HttpError(400, SUMMARY, { date_of_birth: 'Date of birth cannot be removed from a candidate account.' });
    }
  }
  const fields = Object.keys(values);
  if (!fields.length) throw new HttpError(400, 'No changes were supplied.');

  await withTransaction(async (connection) => {
    const target = await lockUser(connection, id);
    try {
      await connection.execute(
        `UPDATE users SET ${fields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
        [...fields.map((field) => values[field]), id],
      );
    } catch (err) {
      rethrowDuplicate(err);
    }
    await logAudit(connection, auditContext(req), 'user_updated', target, `fields: ${fields.join(', ')}`);
  });
  res.json({ user: await fetchUser(pool, id) });
}

export async function deleteUser(req, res) {
  const id = parseId(req.params.id);
  if (id === req.auth.userId) throw new HttpError(409, 'You cannot delete your own account.');
  await withTransaction(async (connection) => {
    const target = await lockUser(connection, id);
    await assertNotLastActiveAdmin(connection, target);
    await connection.execute('DELETE FROM users WHERE id = ?', [id]);
    await logAudit(connection, auditContext(req), 'user_deleted', target);
  });
  res.json({ message: 'User deleted.' });
}

export async function setStatus(req, res) {
  const id = parseId(req.params.id);
  const isActive = req.body?.is_active;
  if (typeof isActive !== 'boolean') throw new HttpError(400, 'is_active must be true or false.');
  if (!isActive && id === req.auth.userId) throw new HttpError(409, 'You cannot disable your own account.');

  await withTransaction(async (connection) => {
    const target = await lockUser(connection, id);
    if (!isActive) await assertNotLastActiveAdmin(connection, target);
    await connection.execute(
      'UPDATE users SET is_active = ?, token_version = token_version + ? WHERE id = ?',
      [isActive ? 1 : 0, isActive ? 0 : 1, id],
    );
    await logAudit(connection, auditContext(req), isActive ? 'user_enabled' : 'user_disabled', target);
  });
  res.json({ user: await fetchUser(pool, id) });
}

export async function setRole(req, res) {
  const id = parseId(req.params.id);
  const role = validateRole(req.body?.role);
  if (role.error) throw new HttpError(400, role.error);

  await withTransaction(async (connection) => {
    const target = await lockUser(connection, id);
    if (target.role === role.value) return;
    if (role.value === 'user') await assertNotLastActiveAdmin(connection, target);
    await connection.execute('UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?', [role.value, id]);
    await logAudit(connection, auditContext(req), 'role_changed', target, `${target.role} -> ${role.value}`);
  });
  res.json({ user: await fetchUser(pool, id) });
}

export async function resetPassword(req, res) {
  const id = parseId(req.params.id);
  const supplied = req.body?.password;
  let password = supplied;
  if (supplied === undefined || supplied === null || supplied === '') {
    password = randomBytes(9).toString('base64url');
  } else {
    const passwordError = validatePassword(supplied);
    if (passwordError) throw new HttpError(400, passwordError);
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await withTransaction(async (connection) => {
    const target = await lockUser(connection, id);
    if (target.role === 'user') {
      throw new HttpError(409, 'Candidate accounts use registration number and date of birth; password reset is not applicable.');
    }
    await connection.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [passwordHash, id],
    );
    await logAudit(connection, auditContext(req), 'password_reset', target);
  });
  res.json({
    message: 'Password reset. All sessions for this user were signed out.',
    temporary_password: supplied ? undefined : password,
  });
}

export async function listAuditLogs(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 25;
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM audit_logs');
  const [logs] = await pool.execute(
    `SELECT id, actor_roll_number, action, target_roll_number, details, ip_address, created_at
     FROM audit_logs ORDER BY id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
  );
  res.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}
