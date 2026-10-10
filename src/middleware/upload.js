const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // better for video
    // The largest legitimate request is 11 files (10 hero or gallery images
    // plus a cover or video) with a dozen text fields.
    files: 11,
    fields: 50,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image") ||
      file.mimetype.startsWith("video")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images & videos allowed"), false);
    }
  },
});

// Anything that fails while parsing an upload (wrong file type, malformed or
// truncated multipart body, missing boundary) is the client's fault: mark it
// 400 for the app error handler, which maps MulterError limits itself.
const clientErrors = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (err && !err.status && !(err instanceof multer.MulterError)) {
      err.status = 400;
    }
    next(err);
  });

module.exports = {
  single: (name) => clientErrors(upload.single(name)),
  fields: (fields) => clientErrors(upload.fields(fields)),
};