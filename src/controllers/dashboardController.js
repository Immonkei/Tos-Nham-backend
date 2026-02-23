const { Op, fn, col, literal } = require('sequelize');
const { Order, Reservation, Payment, User, Branch, MenuItem, sequelize } = require('../models');

/**
 * Helper: Get today's date range (start and end of day).
 */
const getTodayRange = () => {
  const today = new Date();
  const start = new Date(today.setHours(0, 0, 0, 0));
  const end = new Date(today.setHours(23, 59, 59, 999));
  return { start, end };
};

/**
 * GET /api/dashboard/summary
 * Get overall dashboard summary.
 * Query params: branch_id (optional for admin), date (YYYY-MM-DD, defaults to today)
 * Access: Admin, Staff
 */
const getDashboardSummary = async (req, res) => {
  try {
    const { branch_id, date } = req.query;

    // Determine effective branch filter
    let effectiveBranchId = null;
    if (req.user.role === 'staff') {
      effectiveBranchId = req.user.branch_id;
    } else if (branch_id) {
      effectiveBranchId = parseInt(branch_id);
    }

    // Determine date range
    let dateStart, dateEnd;
    if (date) {
      dateStart = new Date(`${date}T00:00:00`);
      dateEnd = new Date(`${date}T23:59:59`);
    } else {
      const range = getTodayRange();
      dateStart = range.start;
      dateEnd = range.end;
    }

    const orderWhere = {
      created_at: { [Op.between]: [dateStart, dateEnd] },
    };
    const reservationWhere = {
      reservation_date: date || new Date().toISOString().split('T')[0],
    };

    if (effectiveBranchId) {
      orderWhere.branch_id = effectiveBranchId;
      reservationWhere.branch_id = effectiveBranchId;
    }

    // ── Orders stats ─────────────────────────────────────────────────────────
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      preparingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
    ] = await Promise.all([
      Order.count({ where: orderWhere }),
      Order.count({ where: { ...orderWhere, order_status: 'Pending' } }),
      Order.count({ where: { ...orderWhere, order_status: 'Confirmed' } }),
      Order.count({ where: { ...orderWhere, order_status: 'Preparing' } }),
      Order.count({ where: { ...orderWhere, order_status: 'Ready' } }),
      Order.count({ where: { ...orderWhere, order_status: 'Completed' } }),
      Order.count({ where: { ...orderWhere, order_status: 'Cancelled' } }),
    ]);

    // ── Total sales from verified payments ───────────────────────────────────
    const salesResult = await Payment.findOne({
      attributes: [[fn('SUM', col('amount')), 'total_sales']],
      where: {
        status: 'Verified',
        created_at: { [Op.between]: [dateStart, dateEnd] },
      },
      raw: true,
    });
    const total_sales = parseFloat(salesResult?.total_sales || 0).toFixed(2);

    // ── Reservation stats ────────────────────────────────────────────────────
    const [
      totalReservations,
      pendingReservations,
      confirmedReservations,
      arrivedReservations,
      completedReservations,
      cancelledReservations,
    ] = await Promise.all([
      Reservation.count({ where: reservationWhere }),
      Reservation.count({ where: { ...reservationWhere, status: 'Pending Payment' } }),
      Reservation.count({ where: { ...reservationWhere, status: 'Confirmed' } }),
      Reservation.count({ where: { ...reservationWhere, status: 'Arrived' } }),
      Reservation.count({ where: { ...reservationWhere, status: 'Completed' } }),
      Reservation.count({ where: { ...reservationWhere, status: 'Cancelled' } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        date: date || new Date().toISOString().split('T')[0],
        branch_id: effectiveBranchId || 'all',
        orders: {
          total: totalOrders,
          by_status: {
            pending: pendingOrders,
            confirmed: confirmedOrders,
            preparing: preparingOrders,
            ready: readyOrders,
            completed: completedOrders,
            cancelled: cancelledOrders,
          },
        },
        reservations: {
          total: totalReservations,
          by_status: {
            pending_payment: pendingReservations,
            confirmed: confirmedReservations,
            arrived: arrivedReservations,
            completed: completedReservations,
            cancelled: cancelledReservations,
          },
        },
        financials: {
          total_sales: parseFloat(total_sales),
          currency: 'THB',
        },
      },
    });
  } catch (error) {
    console.error('GetDashboardSummary error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/dashboard/sales
 * Get sales report with date range filtering.
 * Query params: branch_id, start_date, end_date, group_by (day|month)
 * Access: Admin, Staff
 */
const getSalesReport = async (req, res) => {
  try {
    const { branch_id, start_date, end_date, group_by = 'day' } = req.query;

    let effectiveBranchId = null;
    if (req.user.role === 'staff') {
      effectiveBranchId = req.user.branch_id;
    } else if (branch_id) {
      effectiveBranchId = parseInt(branch_id);
    }

    const startDate = start_date
      ? new Date(`${start_date}T00:00:00`)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = end_date
      ? new Date(`${end_date}T23:59:59`)
      : new Date();

    const paymentWhere = {
      status: 'Verified',
      created_at: { [Op.between]: [startDate, endDate] },
    };

    // Get daily/monthly sales breakdown
    const dateFormat = group_by === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const salesData = await Payment.findAll({
      attributes: [
        [fn('DATE_FORMAT', col('Payment.created_at'), dateFormat), 'period'],
        [fn('SUM', col('amount')), 'total_sales'],
        [fn('COUNT', col('Payment.id')), 'transaction_count'],
      ],
      where: paymentWhere,
      include: effectiveBranchId
        ? [
            {
              association: 'order',
              attributes: [],
              where: { branch_id: effectiveBranchId },
              required: false,
            },
          ]
        : [],
      group: [fn('DATE_FORMAT', col('Payment.created_at'), dateFormat)],
      order: [[fn('DATE_FORMAT', col('Payment.created_at'), dateFormat), 'ASC']],
      raw: true,
    });

    // Total summary
    const totalResult = await Payment.findOne({
      attributes: [
        [fn('SUM', col('amount')), 'total'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: paymentWhere,
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        period: { start: start_date, end: end_date },
        branch_id: effectiveBranchId || 'all',
        group_by,
        summary: {
          total_sales: parseFloat(totalResult?.total || 0),
          transaction_count: parseInt(totalResult?.count || 0),
        },
        breakdown: salesData.map((row) => ({
          period: row.period,
          total_sales: parseFloat(row.total_sales),
          transaction_count: parseInt(row.transaction_count),
        })),
      },
    });
  } catch (error) {
    console.error('GetSalesReport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/dashboard/orders/stats
 * Get order statistics with optional date range.
 * Access: Admin, Staff
 */
const getOrderStats = async (req, res) => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    let effectiveBranchId = null;
    if (req.user.role === 'staff') {
      effectiveBranchId = req.user.branch_id;
    } else if (branch_id) {
      effectiveBranchId = parseInt(branch_id);
    }

    const where = {};
    if (effectiveBranchId) where.branch_id = effectiveBranchId;
    if (start_date && end_date) {
      where.created_at = {
        [Op.between]: [
          new Date(`${start_date}T00:00:00`),
          new Date(`${end_date}T23:59:59`),
        ],
      };
    }

    const [byStatus, byType, recentOrders] = await Promise.all([
      // Count by status
      Order.findAll({
        attributes: ['order_status', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['order_status'],
        raw: true,
      }),
      // Count by type
      Order.findAll({
        attributes: ['order_type', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['order_type'],
        raw: true,
      }),
      // Recent 10 orders
      Order.findAll({
        where,
        include: [
          { association: 'user', attributes: ['id', 'name'] },
          { association: 'branch', attributes: ['id', 'branch_name'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 10,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        branch_id: effectiveBranchId || 'all',
        by_status: byStatus,
        by_type: byType,
        recent_orders: recentOrders,
      },
    });
  } catch (error) {
    console.error('GetOrderStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/dashboard/reservations/stats
 * Get reservation statistics.
 * Access: Admin, Staff
 */
const getReservationStats = async (req, res) => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    let effectiveBranchId = null;
    if (req.user.role === 'staff') {
      effectiveBranchId = req.user.branch_id;
    } else if (branch_id) {
      effectiveBranchId = parseInt(branch_id);
    }

    const where = {};
    if (effectiveBranchId) where.branch_id = effectiveBranchId;
    if (start_date && end_date) {
      where.reservation_date = {
        [Op.between]: [start_date, end_date],
      };
    }

    const [byStatus, upcomingReservations, totalDeposits] = await Promise.all([
      Reservation.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['status'],
        raw: true,
      }),
      Reservation.findAll({
        where: {
          ...where,
          status: 'Confirmed',
          reservation_date: { [Op.gte]: new Date().toISOString().split('T')[0] },
        },
        include: [
          { association: 'user', attributes: ['id', 'name', 'phone'] },
          { association: 'branch', attributes: ['id', 'branch_name'] },
        ],
        order: [['reservation_date', 'ASC'], ['reservation_time', 'ASC']],
        limit: 10,
      }),
      Reservation.findOne({
        attributes: [[fn('SUM', col('deposit_amount')), 'total_deposits']],
        where: { ...where, status: { [Op.in]: ['Confirmed', 'Arrived', 'Completed'] } },
        raw: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        branch_id: effectiveBranchId || 'all',
        by_status: byStatus,
        total_deposits_collected: parseFloat(totalDeposits?.total_deposits || 0),
        upcoming_reservations: upcomingReservations,
      },
    });
  } catch (error) {
    console.error('GetReservationStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/dashboard/branches
 * Get per-branch performance summary. Admin only.
 */
const getBranchPerformance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const branches = await Branch.findAll({
      where: { deleted_at: null, status: 'active' },
      attributes: ['id', 'branch_name'],
    });

    const performance = await Promise.all(
      branches.map(async (branch) => {
        const [orderCount, reservationCount, salesResult] = await Promise.all([
          Order.count({
            where: {
              branch_id: branch.id,
              created_at: {
                [Op.between]: [
                  new Date(`${targetDate}T00:00:00`),
                  new Date(`${targetDate}T23:59:59`),
                ],
              },
            },
          }),
          Reservation.count({
            where: {
              branch_id: branch.id,
              reservation_date: targetDate,
            },
          }),
          Payment.findOne({
            attributes: [[fn('SUM', col('amount')), 'total']],
            where: {
              status: 'Verified',
              created_at: {
                [Op.between]: [
                  new Date(`${targetDate}T00:00:00`),
                  new Date(`${targetDate}T23:59:59`),
                ],
              },
            },
            include: [
              {
                association: 'order',
                attributes: [],
                where: { branch_id: branch.id },
                required: true,
              },
            ],
            raw: true,
          }),
        ]);

        return {
          branch_id: branch.id,
          branch_name: branch.branch_name,
          orders_today: orderCount,
          reservations_today: reservationCount,
          sales_today: parseFloat(salesResult?.total || 0),
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        branches: performance,
      },
    });
  } catch (error) {
    console.error('GetBranchPerformance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getDashboardSummary,
  getSalesReport,
  getOrderStats,
  getReservationStats,
  getBranchPerformance,
};
