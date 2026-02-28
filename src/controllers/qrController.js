const crypto = require('crypto');
const { Reservation } = require('../models');
const { generateQRCodeDataURL, generateQRCodeSVG } = require('../utils/qrHelper');

const QR_EXPIRATION_MINUTES = 120;

/* =========================================================
   Generate Secure Token
========================================================= */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/* =========================================================
   Validate QR Token (Staff/Admin Scan)
   POST /api/qr/validate
========================================================= */
const validateQRToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required.',
      });
    }

    const reservation = await Reservation.findOne({
      where: { qr_token: token },
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
      ],
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR token.',
      });
    }

    /* =========================================
       Branch Restriction
    ========================================= */
    if (
      req.user.role === 'staff' &&
      req.user.branch_id !== reservation.branch_id
    ) {
      return res.status(403).json({
        success: false,
        message: 'This reservation belongs to a different branch.',
      });
    }

    /* =========================================
       Status Validation
    ========================================= */
    if (reservation.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Reservation has been cancelled.',
      });
    }

    if (reservation.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Reservation already completed.',
      });
    }

    if (reservation.status === 'Arrived') {
      return res.status(400).json({
        success: false,
        message: 'Guest already checked in.',
      });
    }

    if (reservation.status === 'Pending Payment') {
      return res.status(400).json({
        success: false,
        message: 'Deposit has not been paid yet.',
      });
    }

    if (reservation.status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot check in reservation with status: ${reservation.status}`,
      });
    }

    /* =========================================
       QR Already Used
    ========================================= */
    if (reservation.qr_used) {
      return res.status(400).json({
        success: false,
        message: 'QR already used.',
      });
    }

    /* =========================================
       Expiration Check
    ========================================= */
    if (reservation.qr_generated_at) {
      const now = new Date();
      const generatedAt = new Date(reservation.qr_generated_at);

      const diffMinutes = (now - generatedAt) / (1000 * 60);

      if (diffMinutes > QR_EXPIRATION_MINUTES) {
        return res.status(400).json({
          success: false,
          message: 'QR token expired.',
        });
      }
    }

    /* =========================================
       Date Validation (Timezone Safe)
    ========================================= */
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservationDate = new Date(reservation.reservation_date);
    reservationDate.setHours(0, 0, 0, 0);

    if (reservationDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Reservation date does not match today.',
      });
    }

    /* =========================================
       Mark Arrived
    ========================================= */
    await reservation.update({
      status: 'Arrived',
      qr_used: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Guest checked in successfully.',
      data: {
        reservation_id: reservation.id,
        status: 'Arrived',
        guest: reservation.user,
        branch: reservation.branch,
        reservation_date: reservation.reservation_date,
        reservation_time: reservation.reservation_time,
        number_of_people: reservation.number_of_people,
      },
    });

  } catch (error) {
    console.error('ValidateQRToken error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

/* =========================================================
   Get QR For Reservation
   GET /api/qr/reservation/:id
========================================================= */
const getQRForReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [
        { association: 'user', attributes: ['id', 'name'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
      ],
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      });
    }

    if (!reservation.qr_token) {
      return res.status(400).json({
        success: false,
        message: 'QR token not generated. Deposit must be confirmed.',
      });
    }

    const qrPayload = reservation.qr_token;

    const [qrDataURL, qrSVG] = await Promise.all([
      generateQRCodeDataURL(qrPayload),
      generateQRCodeSVG(qrPayload),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        reservation_id: reservation.id,
        qr_token: reservation.qr_token,
        qr_used: reservation.qr_used,
        qr_generated_at: reservation.qr_generated_at,
        qr_code_base64: qrDataURL,
        qr_code_svg: qrSVG,
        reservation_info: {
          guest_name: reservation.user?.name,
          branch: reservation.branch?.branch_name,
          date: reservation.reservation_date,
          time: reservation.reservation_time,
          people: reservation.number_of_people,
          status: reservation.status,
        },
      },
    });

  } catch (error) {
    console.error('GetQRForReservation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

module.exports = {
  validateQRToken,
  getQRForReservation,
  generateSecureToken,
};