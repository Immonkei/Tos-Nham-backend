const { Reservation } = require('../models');
const { generateQRCodeDataURL, generateQRCodeSVG } = require('../utils/qrHelper');

/**
 * POST /api/qr/validate
 * Validate a QR token when staff scans it.
 * - Checks token existence
 * - Checks reservation status
 * - Marks reservation as "Arrived" and token as used
 * Access: Staff, Admin
 */
const validateQRToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required.',
      });
    }

    // Find reservation by token
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
        message: 'Invalid QR token. No reservation found.',
      });
    }

    // Check if token has already been used
    if (reservation.qr_used) {
      return res.status(400).json({
        success: false,
        message: 'QR token has already been used. Reservation was previously checked in.',
        data: {
          reservation_id: reservation.id,
          status: reservation.status,
        },
      });
    }

    // Check reservation status
    if (reservation.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Reservation has been cancelled.',
        data: { reservation_id: reservation.id, status: reservation.status },
      });
    }

    if (reservation.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Reservation has already been completed.',
        data: { reservation_id: reservation.id, status: reservation.status },
      });
    }

    if (reservation.status === 'Pending Payment') {
      return res.status(400).json({
        success: false,
        message: 'Reservation deposit has not been paid yet.',
        data: { reservation_id: reservation.id, status: reservation.status },
      });
    }

    // Staff branch check
    if (req.user.role === 'staff' && req.user.branch_id !== reservation.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'This reservation belongs to a different branch.',
      });
    }

    // Mark as Arrived and expire the token
    await reservation.update({
      status: 'Arrived',
      qr_used: true,
    });

    return res.status(200).json({
      success: true,
      message: 'QR validated successfully. Guest has arrived.',
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
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/qr/reservation/:id
 * Generate/retrieve QR code for a reservation.
 * Returns both base64 data URL and SVG.
 * Access: Staff, Admin
 */
const getQRForReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [
        { association: 'user', attributes: ['id', 'name'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
      ],
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    if (!reservation.qr_token) {
      return res.status(400).json({
        success: false,
        message: 'No QR token available. Deposit payment must be confirmed first.',
      });
    }

    const qrPayload = {
      reservation_id: reservation.id,
      branch_id: reservation.branch_id,
      token: reservation.qr_token,
    };

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
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { validateQRToken, getQRForReservation };
