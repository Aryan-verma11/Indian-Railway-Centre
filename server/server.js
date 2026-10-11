import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import pool from './config/db.js';
import { parseTrustProxy } from './utils/config.js';

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET', 'CLIENT_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(process.env.CLIENT_URL)) {
  console.error('CLIENT_URL must not point to localhost in production.');
  process.exit(1);
}

let trustProxy;
try {
  trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && trustProxy === false) {
  console.warn('TRUST_PROXY is not set. If this server runs behind a reverse proxy (Render, Railway, nginx, ...), '
    + 'every client will share the proxy IP for rate limiting. Set TRUST_PROXY=1 for a single proxy.');
}

const app = express();
const allowedOrigins = process.env.CLIENT_URL.split(',').map((url) => url.trim());

app.set('trust proxy', trustProxy);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Liveness: the process is running (does not touch the database).
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
// Readiness: the database answers. Returns no connection details.
app.get('/api/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch (err) {
    console.error(`Readiness check failed: ${err.code || 'unknown error'}`);
    res.status(503).json({ status: 'unavailable', database: 'down' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

async function databaseReachable() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK.');
    return true;
  } catch (err) {
    console.error(`Database connection failed: ${err.code || 'unknown error'}`);
    return false;
  }
}

if (!(await databaseReachable())) {
  if (process.env.NODE_ENV === 'production') process.exit(1);
  console.warn('Continuing in development mode: requests that need the database will fail until it is reachable.');
}

const port = process.env.PORT || 5000;
const server = app.listen(port, () => console.log(`Server listening on port ${port}`));

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down.`);
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
