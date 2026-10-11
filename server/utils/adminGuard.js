import { HttpError } from './httpError.js';

export const LAST_ADMIN_MESSAGE =
  'This is the only active administrator. Create or enable another administrator first.';

// Both helpers must be called inside a transaction: the SELECT ... FOR UPDATE row locks are what make
// the last-admin check safe against two concurrent operations.
export async function lockUser(connection, id) {
  const [rows] = await connection.execute(
    'SELECT id, roll_number, role, is_active FROM users WHERE id = ? FOR UPDATE', [id],
  );
  if (!rows[0]) throw new HttpError(404, 'User not found.');
  return rows[0];
}

export async function lockUserByRoll(connection, rollNumber) {
  const [rows] = await connection.execute(
    'SELECT id, roll_number, role, is_active FROM users WHERE roll_number = ? FOR UPDATE', [rollNumber],
  );
  if (!rows[0]) throw new HttpError(404, `No user found with roll number ${rollNumber}.`);
  return rows[0];
}

// Throws unless at least one OTHER active administrator exists. Does nothing when the target is not an
// active administrator (deleting a normal user or a disabled admin can never remove the last active admin).
export async function assertNotLastActiveAdmin(connection, target) {
  if (target.role !== 'admin' || !target.is_active) return;
  const [others] = await connection.execute(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ? FOR UPDATE", [target.id],
  );
  if (!others.length) throw new HttpError(409, LAST_ADMIN_MESSAGE);
}
