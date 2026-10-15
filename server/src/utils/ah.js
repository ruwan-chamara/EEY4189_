// Wraps async route handlers so thrown errors reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const httpError = (status, message) => Object.assign(new Error(message), { status });
