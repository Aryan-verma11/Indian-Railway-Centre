import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT id, roll_number, role, is_active, token_version FROM users WHERE id = ? LIMIT 1',
      [payload.sub],
    );
    const user = rows[0];
    if (!user || !user.is_active || user.token_version !== payload.tv) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    req.auth = { userId: user.id, rollNumber: user.roll_number, role: user.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRole(role) {
  return (req, res, next) =>
    req.auth?.role === role
      ? next()
      : res.status(403).json({ message: 'You do not have permission to perform this action.' });
}
