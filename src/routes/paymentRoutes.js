const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createPayment,
  getPayments,
  getPaymentById,
  uploadReceipt,
  verifyPayment,
} = require('../controllers/paymentController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const { uploadReceipt: uploadReceiptMiddleware } = require('../utils/upload');

const paymentValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number.'),
  body('payment_method')
    .isIn(['cash', 'card', 'transfer', 'qr_payment'])
    .withMessage('Invalid payment_method.'),
];

/**
 * @route   POST /api/payments
 * @desc    Create a payment record
 * @access  Private (all roles)
 */
router.post(
  '/',
  authMiddleware,
  uploadReceiptMiddleware,
  paymentValidation,
  validateRequest,
  createPayment
);

/**
 * @route   GET /api/payments
 * @desc    Get all payments
 * @access  Admin, Staff
 */
router.get('/', authMiddleware, roleMiddleware('admin', 'staff'), getPayments);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment by ID
 * @access  Admin, Staff
 */
router.get('/:id', authMiddleware, roleMiddleware('admin', 'staff'), getPaymentById);

/**
 * @route   PUT /api/payments/:id/upload-receipt
 * @desc    Upload receipt image
 * @access  Private (all roles)
 */
router.put(
  '/:id/upload-receipt',
  authMiddleware,
  uploadReceiptMiddleware,
  uploadReceipt
);

/**
 * @route   PUT /api/payments/:id/verify
 * @desc    Admin approve or reject payment
 * @access  Admin only
 */
router.put(
  '/:id/verify',
  authMiddleware,
  roleMiddleware('admin'),
  [
    body('action')
      .isIn(['approve', 'reject'])
      .withMessage('action must be "approve" or "reject".'),
  ],
  validateRequest,
  verifyPayment
);

module.exports = router;
