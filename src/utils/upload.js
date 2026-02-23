const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a multer storage engine for a given upload directory.
 */
const createStorage = (uploadDir) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(process.cwd(), uploadDir));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
};

/**
 * File filter: only allow images.
 */
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

/**
 * Upload middleware for menu item images.
 */
const uploadMenuImage = multer({
  storage: createStorage('uploads/menu'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('image');

/**
 * Upload middleware for payment receipts.
 */
const uploadReceipt = multer({
  storage: createStorage('uploads/receipts'),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('receipt');

/**
 * Wrap multer middleware to handle errors gracefully.
 */
const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

module.exports = {
  uploadMenuImage: handleUpload(uploadMenuImage),
  uploadReceipt: handleUpload(uploadReceipt),
};
