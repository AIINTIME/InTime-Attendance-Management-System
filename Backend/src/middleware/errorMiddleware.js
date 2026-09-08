function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again."
      : err.message || "Something went wrong. Please try again.";

  if (status === 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);
  }

  res.status(status).json({
    success: false,
    message,
    code: err.code || "SERVER_ERROR",
  });
}

class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { notFound, errorHandler, ApiError };
