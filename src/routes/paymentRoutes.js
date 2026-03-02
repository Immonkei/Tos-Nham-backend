const express = require("express");
const router = express.Router();

const {
  createPayment,
  getPayments,
  checkBakongPayment
} = require("../controllers/paymentController");

const { authMiddleware, roleMiddleware } = require("../middleware/authMiddleware");

/**
 * POST /api/payments
 */
router.post(
  "/",
  authMiddleware,
  createPayment
);

/**
 * 🔥 AUTO BAKONG CHECK
 * IMPORTANT: must be BEFORE /:id routes
 */
router.get(
  "/bakong/check/:orderId",
  authMiddleware,
  checkBakongPayment
);

/**
 * GET /api/payments
 */
router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getPayments
);

module.exports = router;