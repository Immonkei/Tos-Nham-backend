const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateQRToken, getQRForReservation } = require('../controllers/qrController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

/**
 * @route   POST /api/qr/validate
 * @desc    Validate a QR token (staff scans at check-in)
 * @access  Admin, Staff
 */
router.post(
  '/validate',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  [body('token').notEmpty().withMessage('QR token is required.')],
  validateRequest,
  validateQRToken
);

/**
 * @route   GET /api/qr/reservation/:id
 * @desc    Get QR code for a specific reservation
 * @access  Admin, Staff
 */
router.get(
  '/reservation/:id',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  getQRForReservation
);

module.exports = router;
