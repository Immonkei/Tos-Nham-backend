const { Op } = require("sequelize");
const axios = require("axios");
const {
  Reservation,
  User,
  Branch,
  Table,  
} = require("../models");
const {
  generateSecureToken,
  generateQRCodeDataURL,
} = require("../utils/qrHelper");
const { generateKHQR } = require("../services/bakongService");

/**
 * ===============================
 * Helper: Calculate Deposit Logic
 * ===============================
 */
const calculateReservationAmounts = ({
  items_total = 0,
  reservation_date,
}) => {
  const today = new Date().toISOString().split("T")[0];

  let deposit_amount = 0;
  let total_amount = 0;

  // If user selected food
  if (items_total > 0) {
    total_amount = items_total;

    // If total food >= $20 → pay 50%
    if (items_total >= 20) {
      deposit_amount = parseFloat((items_total * 0.5).toFixed(2));
    } else {
      deposit_amount = 0;
    }
  } else {
    // No food selected → table booking only
    total_amount = 0;

    // If booking for another day → charge $5
    if (reservation_date !== today) {
      deposit_amount = 5;
    } else {
      deposit_amount = 0;
    }
  }

  return { total_amount, deposit_amount };
};

/**
 * =====================================
 * POST /api/reservations
 * Create reservation + deposit QR
 * =====================================
 */
const createReservation = async (req, res) => {
  try {
    const {
      branch_id,
      table_id, 
      reservation_date,
      reservation_time,
      number_of_people,
      items_total = 0,
      special_requests,
    } = req.body;

    const branch = await Branch.findOne({
      where: { id: branch_id, deleted_at: null },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }
// 🔥 Validate Table
const table = await Table.findOne({
  where: {
    id: table_id,
    branch_id,
  },
});

if (!table) {
  return res.status(404).json({
    success: false,
    message: "Table not found in this branch.",
  });
}

if (table.seat_capacity < number_of_people) {
  return res.status(400).json({
    success: false,
    message: "Selected table does not have enough seats.",
  });
}
// 🔥 Prevent double booking (same table, same date, same time)
const existingReservation = await Reservation.findOne({
  where: {
    table_id,
    reservation_date,
    reservation_time,
    status: {
      [Op.notIn]: ["Cancelled", "Completed"],
    },
  },
});

if (existingReservation) {
  return res.status(400).json({
    success: false,
    message:
      "This table is already booked for the selected date and time.",
  });
}
    const { total_amount, deposit_amount } =
      calculateReservationAmounts({
        items_total: Number(items_total),
        reservation_date,
      });

    const reservation = await Reservation.create({
      user_id: req.user.id,
      branch_id,
      table_id,  
      reservation_date,
      reservation_time,
      number_of_people,
      items_total,
      total_amount,
      deposit_amount,
      status: deposit_amount > 0 ? "Pending Payment" : "Confirmed",
      special_requests,
    });

    // If no deposit required → confirm immediately
    if (deposit_amount === 0) {
      const qr_token = generateSecureToken();

      await reservation.update({
        qr_token,
        qr_used: false,
        qr_generated_at: new Date(),
      });

      return res.status(201).json({
        success: true,
        message: "Reservation confirmed. No deposit required.",
        data: {
          reservation,
          payment_required: false,
        },
      });
    }

    // Generate Bakong QR for deposit
    const { qr, md5 } = await generateKHQR({
      id: reservation.id,
      total_amount: deposit_amount,
    });

    await reservation.update({
      bakong_md5: md5,
    });

    return res.status(201).json({
      success: true,
      message: "Reservation created. Please pay deposit.",
      data: {
        reservation,
        payment_required: true,
        payment: {
          method: "bakong",
          qr,
          md5,
          deposit_amount,
        },
      },
    });
  } catch (error) {
    console.error("CreateReservation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * =====================================
 * GET /api/reservations
 * =====================================
 */
const getReservations = async (req, res) => {
  try {
    const { branch_id, status, date } = req.query;
    const where = {};

    if (req.user.role === "customer") {
      where.user_id = req.user.id;
    } else if (req.user.role === "staff") {
      where.branch_id = req.user.branch_id;
    } else if (branch_id) {
      where.branch_id = branch_id;
    }

    if (status) where.status = status;
    if (date) where.reservation_date = date;

    const reservations = await Reservation.findAll({
      where,
      include: [
        { association: "user", attributes: ["id", "name", "email", "phone"] },
        { association: "branch", attributes: ["id", "branch_name"] },
      ],
      order: [["reservation_date", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: { reservations, total: reservations.length },
    });
  } catch (error) {
    console.error("GetReservations error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * =====================================
 * GET /api/reservations/:id
 * =====================================
 */
const getReservationById = async (req, res) => {
  try {
    const where = { id: req.params.id };

    if (req.user.role === "customer") {
      where.user_id = req.user.id;
    }

    const reservation = await Reservation.findOne({
      where,
      include: [
        { association: "user", attributes: ["id", "name", "email", "phone"] },
        { association: "branch", attributes: ["id", "branch_name", "address"] },
      ],
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { reservation },
    });
  } catch (error) {
    console.error("GetReservationById error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * =====================================
 * GET /api/reservations/bakong/check/:id
 * Auto verify deposit
 * =====================================
 */
const checkReservationBakongPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findByPk(id);

    if (!reservation || !reservation.bakong_md5) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found or no Bakong payment.",
      });
    }

    const response = await axios.get(
      `http://localhost:8001/check/${reservation.bakong_md5}`
    );

    const result = response.data;

    const isPaid =
      result === "PAID" ||
      result?.data?.is_paid === true ||
      result?.is_paid === true;

    if (isPaid) {
      if (reservation.status !== "Confirmed") {
        const qr_token = generateSecureToken();

        await reservation.update({
          status: "Confirmed",
          qr_token,
          qr_used: false,
          qr_generated_at: new Date(),
        });
      }

      return res.json({
        success: true,
        paid: true,
        message: "Deposit payment successful.",
      });
    }

    return res.json({
      success: true,
      paid: false,
      message: "Waiting for deposit payment.",
    });
  } catch (error) {
    console.error("Reservation Bakong check error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * =====================================
 * GET /api/reservations/:id/qr
 * Get entry QR after payment
 * =====================================
 */
const getReservationQR = async (req, res) => {
  try {
    const where = { id: req.params.id };

    if (req.user.role === "customer") {
      where.user_id = req.user.id;
    }

    const reservation = await Reservation.findOne({ where });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    if (!reservation.qr_token) {
      return res.status(400).json({
        success: false,
        message: "QR not available. Deposit not confirmed.",
      });
    }

    if (reservation.qr_used) {
      return res.status(400).json({
        success: false,
        message: "QR already used.",
      });
    }

    const qrDataURL = await generateQRCodeDataURL(
      reservation.qr_token
    );

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
    console.error("GetReservationQR error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * =====================================
 * Staff/Admin update reservation status
 * =====================================
 */
const updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "Confirmed",
      "Arrived",
      "Completed",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const reservation = await Reservation.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    if (
      req.user.role === "staff" &&
      req.user.branch_id !== reservation.branch_id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this branch.",
      });
    }

    await reservation.update({ status });

    return res.status(200).json({
      success: true,
      message: `Reservation updated to ${status}.`,
      data: { reservation },
    });
  } catch (error) {
    console.error("UpdateReservationStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
/**
 * =====================================
 * DELETE /api/reservations/:id
 * Admin/Staff delete reservation
 * =====================================
 */
const deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    // Staff can only delete their branch reservations
    if (
      req.user.role === "staff" &&
      req.user.branch_id !== reservation.branch_id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this branch.",
      });
    }

    await reservation.destroy();

    return res.status(200).json({
      success: true,
      message: "Reservation deleted successfully.",
    });

  } catch (error) {
    console.error("DeleteReservation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
module.exports = {
  createReservation,
  getReservations,
  getReservationById,
  checkReservationBakongPayment,
  getReservationQR,
  updateReservationStatus,
  deleteReservation,
};