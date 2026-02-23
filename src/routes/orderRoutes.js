const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrdersByBranch,
} = require('../controllers/orderController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

const orderValidation = [
  body('branch_id').isInt({ min: 1 }).withMessage('Valid branch_id is required.'),
  body('order_type')
    .isIn(['dine-in', 'delivery', 'takeaway'])
    .withMessage('order_type must be dine-in, delivery, or takeaway.'),
  body('payment_method')
    .isIn(['cash', 'card', 'transfer', 'qr_payment'])
    .withMessage('Invalid payment_method.'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
  body('items.*.menu_item_id').isInt({ min: 1 }).withMessage('Each item must have a valid menu_item_id.'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item quantity must be at least 1.'),
];

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private (all roles)
 */
router.post('/', authMiddleware, orderValidation, validateRequest, createOrder);

/**
 * @route   GET /api/orders
 * @desc    Get orders (role-filtered, paginated)
 * @access  Private
 */
router.get('/', authMiddleware, getOrders);

/**
 * @route   GET /api/orders/branch/:branch_id
 * @desc    Get orders by branch
 * @access  Admin, Staff
 */
router.get(
  '/branch/:branch_id',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  getOrdersByBranch
);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get('/:id', authMiddleware, getOrderById);

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status
 * @access  Admin, Staff
 */
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  [body('order_status').notEmpty().withMessage('order_status is required.')],
  validateRequest,
  updateOrderStatus
);

module.exports = router;
