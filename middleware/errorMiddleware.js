const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
  console.error('ERROR 💥:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.errors.map(e => e.message).join(', ');
  }

  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message: message,
    DEBUG_SOURCE: 'MY_ERROR_HANDLER'
  });
};

module.exports = errorHandler;
