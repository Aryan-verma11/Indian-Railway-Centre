import rateLimit from 'express-rate-limit';

const options = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
};

const positiveInt = (value, fallback) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback);
const loginMessage = { message: 'Too many failed login attempts. Please wait 15 minutes and try again.' };

// Login brute-force protection uses two independent counters (failed attempts only):
//  - per IP address: generous, so many people behind one institutional NAT are not locked out together;
//  - per roll number: strict, so one account cannot be guessed at from many addresses. The key is the
//    submitted roll number whether or not it exists, so the limiter reveals nothing about valid accounts.
// Trade-off: someone who knows a roll number can block that account's logins for up to 15 minutes.
const rollKey = (req) => {
  const roll = typeof req.body?.roll_number === 'string' ? req.body.roll_number.trim().toUpperCase().slice(0, 30) : '';
  return roll ? `roll:${roll}` : `ip:${req.ip}`;
};

export const loginIpLimiter = rateLimit({
  ...options, message: loginMessage, limit: positiveInt(process.env.LOGIN_IP_LIMIT, 100), skipSuccessfulRequests: true,
});
export const loginAccountLimiter = rateLimit({
  ...options,
  message: loginMessage,
  limit: positiveInt(process.env.LOGIN_ACCOUNT_LIMIT, 10),
  skipSuccessfulRequests: true,
  keyGenerator: rollKey,
});
export const passwordLimiter = rateLimit({ ...options, limit: 10 });
export const adminResetLimiter = rateLimit({ ...options, limit: 30 });
export const apiLimiter = rateLimit({ ...options, limit: 600 });
