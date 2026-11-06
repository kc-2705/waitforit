const { ZodError } = require('zod');
const mongoose = require('mongoose');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFound(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

// One place that turns any thrown error into a clear JSON response.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue.path.join('.');
    return res.status(400).json({ message: field ? `${field}: ${issue.message}` : issue.message });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ message: 'Invalid id.' });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: Object.values(err.errors)[0]?.message || 'Invalid data.' });
  }
  if (err?.code === 11000) return res.status(409).json({ message: 'That already exists.' });
  if (err?.name === 'MulterError') {
    return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large (5 MB maximum).' : 'Upload failed. Please try again.' });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'That is too large to send. Please shorten it and try again.' });

  console.error(err);
  return res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
}

module.exports = { HttpError, notFound, errorHandler };
