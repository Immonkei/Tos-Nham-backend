const { Op } = require('sequelize');
const { Reservation, User, Branch, Payment } = require('../models');
const { generateSecureToken, generateQRCodeDataURL } = require('../utils/qrHelper');

/**
 * POST /api/reservations
 * Create a new reservation with 50% deposit calculation.
 * Access: Customer, Staff, Admin
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

    // Validate branch
    const branch = await Branch.findOne({ where: { id: branch_id, deleted_at: null } });
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
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
      message: 'Reservation created. Please complete the 50% deposit payment.',
      data: {
        reservation,
        deposit_required: deposit_amount,
      },
    });
  } catch (error) {
    console.error('CreateReservation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reservations
 * Get reservations. Customers see their own; staff/admin filter by branch.
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
        { association: 'payment', attributes: ['id', 'status', 'amount', 'payment_method'] },
      ],
      order: [['reservation_date', 'DESC'], ['reservation_time', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: { reservations, total: reservations.length },
    });
  } catch (error) {
    console.error('GetReservations error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reservations/:id
 * Get a single reservation by ID.
 */
const getReservationById = async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (req.user.role === 'customer') where.user_id = req.user.id;

    const reservation = await Reservation.findOne({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name', 'address'] },
        { association: 'payment' },
      ],
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    return res.status(200).json({ success: true, data: { reservation } });
  } catch (error) {
    console.error('GetReservationById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/reservations/:id/confirm-payment
 * Confirm deposit payment → change status to Confirmed and generate QR token.
 * Access: Admin, Staff
 */
const confirmDepositPayment = async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    if (reservation.status !== 'Pending Payment') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm payment. Current status: ${reservation.status}`,
      });
    }

    // Generate secure QR token
    const qr_token = generateSecureToken();

    // Generate QR code image (base64)
    const qrPayload = {
      reservation_id: reservation.id,
      branch_id: reservation.branch_id,
      token: qr_token,
    };
    const qrDataURL = await generateQRCodeDataURL(qrPayload);

    await reservation.update({
      status: 'Confirmed',
      qr_token,
      qr_used: false,
      qr_generated_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Deposit payment confirmed. QR token generated.',
      data: {
        reservation_id: reservation.id,
        status: 'Confirmed',
        qr_token,
        qr_code: qrDataURL,
      },
    });
  } catch (error) {
    console.error('ConfirmDepositPayment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reservations/:id/qr
 * Regenerate / retrieve QR code for a confirmed reservation.
 * Access: Customer (own), Staff, Admin
 */
const getReservationQR = async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (req.user.role === 'customer') where.user_id = req.user.id;

    const reservation = await Reservation.findOne({ where });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    if (!reservation.qr_token) {
      return res.status(400).json({
        success: false,
        message: 'QR code not available. Deposit payment may not be confirmed yet.',
      });
    }

    if (reservation.qr_used) {
      return res.status(400).json({
        success: false,
        message: 'QR code has already been used.',
      });
    }

    const qrPayload = {
      reservation_id: reservation.id,
      branch_id: reservation.branch_id,
      token: reservation.qr_token,
    };
    const qrDataURL = await generateQRCodeDataURL(qrPayload);

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
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/reservations/:id/status
 * Update reservation status. Staff / Admin.
 * Allowed transitions: Confirmed → Arrived → Completed, any → Cancelled
 */
const updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Confirmed', 'Arrived', 'Completed', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`,
      });
    }

    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    await reservation.update({ status });

    return res.status(200).json({
      success: true,
      message: `Reservation status updated to ${status}.`,
      data: { reservation },
    });
  } catch (error) {
    console.error('UpdateReservationStatus error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
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
