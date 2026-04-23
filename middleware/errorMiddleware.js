const errorHandler = (err, req, res, next) => {
  console.error('ERROR 💥:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message: message,
    DEBUG_SOURCE: 'MY_ERROR_HANDLER'
  });
};

module.exports = errorHandler;
