const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getSalesReport,
  getOrderStats,
  getReservationStats,
  getBranchPerformance,
} = require('../controllers/dashboardController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get today's summary (orders, reservations, sales)
 * @access  Admin, Staff
 * @query   branch_id (optional), date (YYYY-MM-DD, optional)
 */
router.get('/summary', authMiddleware, roleMiddleware('admin', 'staff'), getDashboardSummary);

/**
 * @route   GET /api/dashboard/sales
 * @desc    Get sales report with date range
 * @access  Admin, Staff
 * @query   branch_id, start_date, end_date, group_by (day|month)
 */
router.get('/sales', authMiddleware, roleMiddleware('admin', 'staff'), getSalesReport);

/**
 * @route   GET /api/dashboard/orders/stats
 * @desc    Get order statistics
 * @access  Admin, Staff
 * @query   branch_id, start_date, end_date
 */
router.get('/orders/stats', authMiddleware, roleMiddleware('admin', 'staff'), getOrderStats);

/**
 * @route   GET /api/dashboard/reservations/stats
 * @desc    Get reservation statistics
 * @access  Admin, Staff
 * @query   branch_id, start_date, end_date
 */
router.get('/reservations/stats', authMiddleware, roleMiddleware('admin', 'staff'), getReservationStats);

/**
 * @route   GET /api/dashboard/branches
 * @desc    Get per-branch performance summary
 * @access  Admin only
 * @query   date (YYYY-MM-DD, optional)
 */
router.get('/branches', authMiddleware, roleMiddleware('admin'), getBranchPerformance);

module.exports = router;
