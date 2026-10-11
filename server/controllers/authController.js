import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { signToken } from '../utils/token.js';
import { HttpError } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { validatePassword, validateRollNumber } from '../utils/validators.js';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const SELF_COLUMNS = ['roll_number', 'role', 'name', 'father_name', 'gender', 'date_of_birth',
  'phone', 'email', 'course', 'branch', 'year', 'address'];

const toSelfView = (row) => Object.fromEntries(SELF_COLUMNS.map((column) => [column, row[column]]));

function normalizeDob(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > new Date().toISOString().slice(0, 10)) return null;
  return value;
}

export async function login(req, res) {
  const { roll_number: rollInput, date_of_birth: dobInput } = req.body || {};
  const roll = validateRollNumber(rollInput);
  const dob = normalizeDob(dobInput);
  if (roll.error || !dob) throw new HttpError(400, 'Enter a valid registration number and date of birth.');
  const [rows] = await pool.execute("SELECT * FROM users WHERE roll_number = ? AND role = 'user' LIMIT 1", [roll.value]);
  const user = rows[0];
  if (!user || !user.date_of_birth || String(user.date_of_birth).slice(0, 10) !== dob) {
    throw new HttpError(401, 'Invalid registration number or date of birth.');
  }
  if (!user.is_active) throw new HttpError(401, 'Invalid registration number or date of birth.');
  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  return res.json({ token: signToken(user), user: toSelfView(user) });
}

export async function adminLogin(req, res) {
  const { roll_number: rollInput, password } = req.body || {};
  const roll = validateRollNumber(rollInput);
  if (roll.error || typeof password !== 'string' || !password || password.length > 72) throw new HttpError(400, 'Enter valid administrator credentials.');
  const [rows] = await pool.execute("SELECT * FROM users WHERE roll_number = ? AND role = 'admin' LIMIT 1", [roll.value]);
  const user = rows[0];
  const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  const context = { actor: { id: user?.id, roll_number: user?.roll_number }, ip: req.ip };
  if (!user || !passwordMatches || !user.is_active) {
    if (user) await logAudit(pool, context, 'admin_login_failed', user);
    throw new HttpError(401, 'Invalid administrator credentials.');
  }
  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await logAudit(pool, context, 'admin_login', user);
  return res.json({ token: signToken(user), user: toSelfView(user) });
}

export async function getCurrentUser(req, res) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.auth.userId]);
  return res.json({ user: toSelfView(rows[0]) });
}

export function logout(req, res) {
  res.json({ message: 'Logged out.' });
}

export async function logoutAll(req, res) {
  await pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.auth.userId]);
  res.json({ message: 'Signed out of all devices.' });
}

export async function changePassword(req, res) {
  if (req.auth?.role !== 'admin') {
    throw new HttpError(403, 'Password changes are only available for administrator accounts.');
  }
  const { current_password: currentPassword, new_password: newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 72) {
    throw new HttpError(400, 'Enter your current password.');
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new HttpError(400, passwordError);
  if (newPassword === currentPassword) {
    throw new HttpError(400, 'New password must be different from the current password.');
  }

  const [rows] = await pool.execute('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [req.auth.userId]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }

  await pool.execute(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
    [await bcrypt.hash(newPassword, 12), req.auth.userId],
  );
  const [updated] = await pool.execute('SELECT id, token_version FROM users WHERE id = ?', [req.auth.userId]);
  await logAudit(pool, { actor: { id: req.auth.userId, roll_number: req.auth.rollNumber }, ip: req.ip },
    'password_changed', { id: req.auth.userId, roll_number: req.auth.rollNumber });
  return res.json({ message: 'Password changed.', token: signToken(updated[0]) });
}
