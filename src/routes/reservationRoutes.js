const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createReservation,
  getReservations,
  getReservationById,
  confirmDepositPayment,
  getReservationQR,
  updateReservationStatus,
} = require('../controllers/reservationController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

const reservationValidation = [
  body('branch_id').isInt({ min: 1 }).withMessage('Valid branch_id is required.'),
  body('reservation_date').isDate().withMessage('Valid reservation_date (YYYY-MM-DD) is required.'),
  body('reservation_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid reservation_time (HH:MM) is required.'),
  body('number_of_people').isInt({ min: 1 }).withMessage('number_of_people must be at least 1.'),
  body('total_amount').isFloat({ min: 0 }).withMessage('total_amount must be a positive number.'),
];

/**
 * @route   POST /api/reservations
 * @desc    Create a reservation
 * @access  Private (all roles)
 */
router.post('/', authMiddleware, reservationValidation, validateRequest, createReservation);

/**
 * @route   GET /api/reservations
 * @desc    Get reservations (role-filtered)
 * @access  Private
 */
router.get('/', authMiddleware, getReservations);

/**
 * @route   GET /api/reservations/:id
 * @desc    Get reservation by ID
 * @access  Private
 */
router.get('/:id', authMiddleware, getReservationById);

/**
 * @route   GET /api/reservations/:id/qr
 * @desc    Get QR code for a reservation
 * @access  Private
 */
router.get('/:id/qr', authMiddleware, getReservationQR);

/**
 * @route   POST /api/reservations/:id/confirm-payment
 * @desc    Confirm deposit payment and generate QR
 * @access  Admin, Staff
 */
router.post(
  '/:id/confirm-payment',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  confirmDepositPayment
);

/**
 * @route   PUT /api/reservations/:id/status
 * @desc    Update reservation status
 * @access  Admin, Staff
 */
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  [body('status').notEmpty().withMessage('Status is required.')],
  validateRequest,
  updateReservationStatus
);

module.exports = router;
