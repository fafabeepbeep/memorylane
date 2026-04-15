// middleware/upload.js – Multer in-memory storage for Firebase upload

const multer = require('multer');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

const storage = multer.memoryStorage(); // buffer → Firebase directly

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

module.exports = upload;