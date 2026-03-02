const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const {
  createReservation,
  getReservations,
  getReservationById,
  checkReservationBakongPayment,
  getReservationQR,
  updateReservationStatus,
  deleteReservation,
} = require("../controllers/reservationController");

const {
  authMiddleware,
  roleMiddleware,
} = require("../middleware/authMiddleware");

const { validateRequest } = require("../middleware/validationMiddleware");

/**
 * ===============================
 * Reservation Validation
 * ===============================
 */
const reservationValidation = [
  body("branch_id")
    .isInt({ min: 1 })
    .withMessage("Valid branch_id is required."),

  body("table_id")
    .isInt({ min: 1 })
    .withMessage("Valid table_id is required."),

  body("reservation_date")
    .isDate()
    .withMessage("Valid reservation_date (YYYY-MM-DD) is required."),

  body("reservation_time")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Valid reservation_time (HH:MM) is required."),

  body("number_of_people")
    .isInt({ min: 1 })
    .withMessage("number_of_people must be at least 1."),

  body("items_total")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("items_total must be >= 0."),
];

/**
 * =====================================
 * POST /api/reservations
 * Create reservation + deposit QR
 * =====================================
 */
router.post(
  "/",
  authMiddleware,
  reservationValidation,
  validateRequest,
  createReservation
);

/**
 * =====================================
 * GET /api/reservations/bakong/check/:id
 * Auto check Bakong deposit payment
 * MUST be before '/:id'
 * =====================================
 */
router.get(
  "/bakong/check/:id",
  authMiddleware,
  checkReservationBakongPayment
);

/**
 * =====================================
 * GET /api/reservations
 * Get reservations (role-filtered)
 * =====================================
 */
router.get("/", authMiddleware, getReservations);

/**
 * =====================================
 * GET /api/reservations/:id/qr
 * Get entry QR (after deposit confirmed)
 * =====================================
 */
router.get("/:id/qr", authMiddleware, getReservationQR);

/**
 * =====================================
 * GET /api/reservations/:id
 * Get reservation by ID
 * =====================================
 */
router.get("/:id", authMiddleware, getReservationById);

/**
 * @route   DELETE /api/reservations/:id
 * @desc    Delete reservation
 * @access  Admin, Staff
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  deleteReservation
);
/**
 * =====================================
 * PUT /api/reservations/:id/status
 * Staff/Admin update reservation status
 * =====================================
 */
router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  [
    body("status")
      .notEmpty()
      .withMessage("Status is required."),
  ],
  validateRequest,
  updateReservationStatus
);

module.exports = router;