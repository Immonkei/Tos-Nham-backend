const { Op } = require('sequelize');
const { Reservation, User, Branch, Payment, sequelize } = require('../models');
const { generateSecureToken, generateQRCodeDataURL } = require('../utils/qrHelper');

/**
 * POST /api/reservations
 */
const createReservation = async (req, res) => {
  try {
    const {
      branch_id,
      reservation_date,
      reservation_time,
      number_of_people,
      total_amount,
      special_requests,
    } = req.body;

    const branch = await Branch.findOne({
      where: { id: branch_id, deleted_at: null },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found.',
      });
    }

    const deposit_amount = parseFloat((total_amount * 0.5).toFixed(2));

    const reservation = await Reservation.create({
      user_id: req.user.id,
      branch_id,
      reservation_date,
      reservation_time,
      number_of_people,
      total_amount,
      deposit_amount,
      status: 'Pending Payment',
      special_requests,
    });

    return res.status(201).json({
      success: true,
      message: 'Reservation created. Please complete the 50% deposit.',
      data: {
        reservation,
        deposit_required: deposit_amount,
      },
    });

  } catch (error) {
    console.error('CreateReservation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * GET /api/reservations
 */
const getReservations = async (req, res) => {
  try {
    const { branch_id, status, date } = req.query;
    const where = {};

    if (req.user.role === 'customer') {
      where.user_id = req.user.id;
    } else if (req.user.role === 'staff') {
      where.branch_id = req.user.branch_id;
    } else if (branch_id) {
      where.branch_id = branch_id;
    }

    if (status) where.status = status;
    if (date) where.reservation_date = date;

    const reservations = await Reservation.findAll({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
        { association: 'payment', attributes: ['id', 'status', 'amount'] },
      ],
      order: [['reservation_date', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: { reservations, total: reservations.length },
    });

  } catch (error) {
    console.error('GetReservations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * GET /api/reservations/:id
 */
const getReservationById = async (req, res) => {
  try {
    const where = { id: req.params.id };

    if (req.user.role === 'customer') {
      where.user_id = req.user.id;
    }

    const reservation = await Reservation.findOne({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name', 'address'] },
        { association: 'payment' },
      ],
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { reservation },
    });

  } catch (error) {
    console.error('GetReservationById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * POST /api/reservations/:id/confirm-payment
 */
const confirmDepositPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const reservation = await Reservation.findByPk(req.params.id, { transaction: t });

    if (!reservation) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      });
    }

    if (req.user.role === 'staff' && req.user.branch_id !== reservation.branch_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied for this branch.',
      });
    }

    if (reservation.status !== 'Pending Payment') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot confirm payment. Current status: ${reservation.status}`,
      });
    }

    const payment = await Payment.findOne({
      where: {
        reservation_id: reservation.id,
        status: 'Verified',
      },
      transaction: t,
    });

    if (!payment) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Deposit payment not verified yet.',
      });
    }

    const qr_token = generateSecureToken();
    const qrDataURL = await generateQRCodeDataURL(qr_token);

    await reservation.update(
      {
        status: 'Confirmed',
        qr_token,
        qr_used: false,
        qr_generated_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: 'Deposit verified. Reservation confirmed.',
      data: {
        reservation_id: reservation.id,
        status: 'Confirmed',
        qr_token,
        qr_code: qrDataURL,
      },
    });

  } catch (error) {
    await t.rollback();
    console.error('ConfirmDepositPayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};
const updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ['Confirmed', 'Arrived', 'Completed', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.',
      });
    }

    const reservation = await Reservation.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      });
    }

    if (req.user.role === 'staff' && req.user.branch_id !== reservation.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this branch.',
      });
    }

    await reservation.update({ status });

    return res.status(200).json({
      success: true,
      message: `Reservation updated to ${status}.`,
      data: { reservation },
    });

  } catch (error) {
    console.error('UpdateReservationStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};
/**
 * GET /api/reservations/:id/qr
 */
const getReservationQR = async (req, res) => {
  try {
    const where = { id: req.params.id };

    if (req.user.role === 'customer') {
      where.user_id = req.user.id;
    }

    const reservation = await Reservation.findOne({ where });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      });
    }

    if (!reservation.qr_token) {
      return res.status(400).json({
        success: false,
        message: 'QR not available. Deposit not confirmed.',
      });
    }

    if (reservation.qr_used) {
      return res.status(400).json({
        success: false,
        message: 'QR already used.',
      });
    }

    const qrDataURL = await generateQRCodeDataURL(reservation.qr_token);

    return res.status(200).json({
      success: true,
      data: {
        reservation_id: reservation.id,
        qr_token: reservation.qr_token,
        qr_code: qrDataURL,
        status: reservation.status,
      },
    });

  } catch (error) {
    console.error('GetReservationQR error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

module.exports = {
  createReservation,
  getReservations,
  getReservationById,
  confirmDepositPayment,
  getReservationQR,
  updateReservationStatus,
};