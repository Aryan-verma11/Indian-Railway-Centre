import jwt from 'jsonwebtoken';

export function signToken(user) {
  return jwt.sign({ tv: user.token_version }, process.env.JWT_SECRET, {
    subject: String(user.id),
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}
