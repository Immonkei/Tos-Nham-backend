const { Payment, Order, Reservation, User } = require('../models');

/**
 * POST /api/payments
 * Create a payment record (for order or reservation deposit).
 * Access: All authenticated users
 */
const createPayment = async (req, res) => {
  try {
    const { order_id, reservation_id, amount, payment_method, transaction_ref } = req.body;

    if (!order_id && !reservation_id) {
      return res.status(400).json({
        success: false,
        message: 'Either order_id or reservation_id is required.',
      });
    }

    // Validate order if provided
    if (order_id) {
      const order = await Order.findByPk(order_id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      // Check for duplicate payment
      const existing = await Payment.findOne({ where: { order_id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A payment record already exists for this order.',
        });
      }
    }

    // Validate reservation if provided
    if (reservation_id) {
      const reservation = await Reservation.findByPk(reservation_id);
      if (!reservation) {
        return res.status(404).json({ success: false, message: 'Reservation not found.' });
      }
      const existing = await Payment.findOne({ where: { reservation_id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A payment record already exists for this reservation.',
        });
      }
    }

    const receipt_image_path = req.file ? `/uploads/receipts/${req.file.filename}` : null;

    const payment = await Payment.create({
      order_id: order_id || null,
      reservation_id: reservation_id || null,
      amount,
      payment_method,
      receipt_image_path,
      status: 'Pending Verification',
      transaction_ref,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment record created. Awaiting admin verification.',
      data: { payment },
    });
  } catch (error) {
    console.error('CreatePayment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/payments
 * Get all payments. Admin sees all; staff sees branch payments.
 */
const getPayments = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const payments = await Payment.findAll({
      where,
      include: [
        {
          association: 'order',
          attributes: ['id', 'order_status', 'total_amount', 'branch_id'],
        },
        {
          association: 'reservation',
          attributes: ['id', 'status', 'total_amount', 'deposit_amount', 'branch_id'],
        },
        {
          association: 'verifiedBy',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: { payments, total: payments.length },
    });
  } catch (error) {
    console.error('GetPayments error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/payments/:id
 * Get a single payment by ID.
 */
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        { association: 'order' },
        { association: 'reservation' },
        { association: 'verifiedBy', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    return res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    console.error('GetPaymentById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/payments/:id/upload-receipt
 * Upload or update receipt image for a payment.
 * Access: Customer (own), Staff, Admin
 */
const uploadReceipt = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No receipt image uploaded.',
      });
    }

    // Prevent re-upload after verification
    if (payment.status === 'Verified') {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified.',
      });
    }

    const receipt_image_path = `/uploads/receipts/${req.file.filename}`;

    await payment.update({
      receipt_image_path,
      status: 'Pending Verification',
    });

    return res.status(200).json({
      success: true,
      message: 'Receipt uploaded successfully. Awaiting admin verification.',
      data: { receipt_image_path },
    });

  } catch (error) {
    console.error('UploadReceipt error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/**
 * PUT /api/payments/:id/verify
 * Admin approves or rejects a payment.
 * Access: Admin only
 */
const verifyPayment = async (req, res) => {
  try {
    const { action, rejection_reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be "approve" or "reject".',
      });
    }

    const payment = await Payment.findByPk(req.params.id, {
      include: [{ association: 'order' }, { association: 'reservation' }],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.',
      });
    }

    // Prevent double processing
    if (payment.status !== 'Pending Verification') {
      return res.status(400).json({
        success: false,
        message: `Payment already processed.`,
      });
    }

    if (action === 'reject' && !rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'rejection_reason is required when rejecting.',
      });
    }

    if (action === 'approve') {

      // 🔒 SECURITY: Validate amount matches order
      if (payment.order) {
        if (Number(payment.amount) !== Number(payment.order.total_amount)) {
          return res.status(400).json({
            success: false,
            message: 'Payment amount does not match order total.',
          });
        }

        await payment.update({
          status: 'Verified',
          verified_by: req.user.id,
          verified_at: new Date(),
        });

        await payment.order.update({
          payment_status: 'Paid',
          order_status: 'Completed',
        });
      }

      // Reservation logic (if needed)
      if (payment.reservation) {
        await payment.update({
          status: 'Verified',
          verified_by: req.user.id,
          verified_at: new Date(),
        });

        if (payment.reservation.status === 'Pending Payment') {
          await payment.reservation.update({
            status: 'Confirmed',
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and order completed.',
      });
    }

    // Reject flow
    await payment.update({
      status: 'Rejected',
      verified_by: req.user.id,
      verified_at: new Date(),
      rejection_reason,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment rejected successfully.',
    });

  } catch (error) {
    console.error('VerifyPayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

module.exports = {
  createPayment,
  getPayments,
  getPaymentById,
  uploadReceipt,
  verifyPayment,
};
