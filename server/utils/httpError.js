export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const asyncHandler = (handler) => (req, res, next) => handler(req, res, next).catch(next);
