const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrdersByBranch,
  checkOrderPayment   // ✅ ADD THIS
} = require('../controllers/orderController');

const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

const orderValidation = [
  body('branch_id')
    .isInt({ min: 1 })
    .withMessage('Valid branch_id is required.'),

  body('order_type')
    .isIn(['dine-in', 'delivery', 'takeaway'])
    .withMessage('order_type must be dine-in, delivery, or takeaway.'),

  body('payment_method')
    .isIn(['cash', 'card', 'transfer', 'qr_payment'])
    .withMessage('Invalid payment_method.'),

  body('items')
    .isArray({ min: 1 })
    .withMessage('items must be a non-empty array.'),

  body('items.*.menu_item_id')
    .isInt({ min: 1 })
    .withMessage('Each item must have a valid menu_item_id.'),

  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item quantity must be at least 1.')
];


/* ============================================================
   CREATE ORDER
============================================================ */
router.post(
  '/',
  authMiddleware,
  orderValidation,
  validateRequest,
  createOrder
);


/* ============================================================
   GET ALL ORDERS
============================================================ */
router.get(
  '/',
  authMiddleware,
  getOrders
);


/* ============================================================
   GET ORDERS BY BRANCH
============================================================ */
router.get(
  '/branch/:branch_id',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  getOrdersByBranch
);


/* ============================================================
   CHECK QR PAYMENT STATUS  🔥 NEW
============================================================ */
router.get(
  '/:id/check-payment',
  authMiddleware,
  checkOrderPayment
);


/* ============================================================
   GET ORDER BY ID
============================================================ */
router.get(
  '/:id',
  authMiddleware,
  getOrderById
);


/* ============================================================
   UPDATE ORDER STATUS
============================================================ */
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  [
    body('order_status')
      .notEmpty()
      .withMessage('order_status is required.')
  ],
  validateRequest,
  updateOrderStatus
);

module.exports = router;