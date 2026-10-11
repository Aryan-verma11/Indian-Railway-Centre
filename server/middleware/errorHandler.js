import { HttpError } from '../utils/httpError.js';

export function notFound(req, res) {
  res.status(404).json({ message: 'Not found.' });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ message: 'Invalid request.' });
  }
  console.error(`${req.method} ${req.originalUrl} failed: ${err.code || err.message}`);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
