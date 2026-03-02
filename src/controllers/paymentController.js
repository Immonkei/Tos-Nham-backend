const axios = require("axios");
const { Payment, Order, Reservation, User } = require("../models");

/**
 * ---------------------------------------------------
 * POST /api/payments
 * Manual payment (cash / transfer / receipt upload)
 * ---------------------------------------------------
 */
const createPayment = async (req, res) => {
  try {
    const { order_id, reservation_id, amount, payment_method, transaction_ref } = req.body;

    if (!order_id && !reservation_id) {
      return res.status(400).json({
        success: false,
        message: "Either order_id or reservation_id is required.",
      });
    }

    // Validate order
    if (order_id) {
      const order = await Order.findByPk(order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      const existing = await Payment.findOne({ where: { order_id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Payment already exists for this order.",
        });
      }
    }

    // Validate reservation
    if (reservation_id) {
      const reservation = await Reservation.findByPk(reservation_id);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: "Reservation not found.",
        });
      }

      const existing = await Payment.findOne({ where: { reservation_id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Payment already exists for this reservation.",
        });
      }
    }

    const receipt_image_path = req.file
      ? `/uploads/receipts/${req.file.filename}`
      : null;

    const payment = await Payment.create({
      order_id: order_id || null,
      reservation_id: reservation_id || null,
      amount,
      payment_method,
      receipt_image_path,
      status: "Pending Verification",
      transaction_ref,
    });

    return res.status(201).json({
      success: true,
      message: "Payment record created. Awaiting admin verification.",
      data: { payment },
    });

  } catch (error) {
    console.error("CreatePayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


/**
 * ---------------------------------------------------
 * GET /api/payments
 * Admin / Staff view payments
 * ---------------------------------------------------
 */
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [
        { association: "order" },
        { association: "reservation" },
        { association: "verifiedBy", attributes: ["id", "name", "email"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      data: { payments },
    });

  } catch (error) {
    console.error("GetPayments error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


/**
 * ---------------------------------------------------
 * GET /api/payments/:id
 * ---------------------------------------------------
 */
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        { association: "order" },
        { association: "reservation" },
        { association: "verifiedBy", attributes: ["id", "name", "email"] },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    return res.json({
      success: true,
      data: { payment },
    });

  } catch (error) {
    console.error("GetPaymentById error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


/**
 * ---------------------------------------------------
 * PUT /api/payments/:id/verify
 * Manual admin verification
 * ---------------------------------------------------
 */
const verifyPayment = async (req, res) => {
  try {
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be "approve" or "reject".',
      });
    }

    const payment = await Payment.findByPk(req.params.id, {
      include: [{ association: "order" }],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    if (payment.status !== "Pending Verification") {
      return res.status(400).json({
        success: false,
        message: "Payment already processed.",
      });
    }

    if (action === "approve") {
      await payment.update({
        status: "Verified",
        verified_by: req.user.id,
        verified_at: new Date(),
      });

      if (payment.order) {
        await payment.order.update({
          payment_status: "Paid",
          order_status: "Completed",
        });
      }

      return res.json({
        success: true,
        message: "Payment verified successfully.",
      });
    }

    await payment.update({
      status: "Rejected",
      verified_by: req.user.id,
      verified_at: new Date(),
    });

    return res.json({
      success: true,
      message: "Payment rejected.",
    });

  } catch (error) {
    console.error("VerifyPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


/**
 * ---------------------------------------------------
 * 🔥 AUTO CHECK BAKONG PAYMENT
 * GET /api/payments/bakong/check/:orderId
 * ---------------------------------------------------
 */
const checkBakongPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);

    if (!order || !order.bakong_md5) {
      return res.status(404).json({
        success: false,
        message: "Order not found or no Bakong payment.",
      });
    }

    const response = await axios.get(
      `http://localhost:8001/check/${order.bakong_md5}`
    );

    const result = response.data;

    console.log("Bakong check result:", result);

    const isPaid =
      result?.data?.is_paid === true ||
      result?.is_paid === true ||
      result?.isPaid === true ||
      result?.responseCode === 0;

    if (isPaid) {
      if (order.payment_status !== "Paid") {
        await order.update({
          payment_status: "Paid",
          order_status: "Completed",
        });
      }

      return res.json({
        success: true,
        paid: true,
        message: "Payment successful.",
      });
    }

    return res.json({
      success: true,
      paid: false,
      message: "Waiting for payment.",
    });

  } catch (error) {
    console.error("Auto Bakong check error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};


module.exports = {
  createPayment,
  getPayments,
  getPaymentById,
  verifyPayment,
  checkBakongPayment,
};