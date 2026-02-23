const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a cryptographically secure unique token.
 * @param {number} length - Byte length (default 32 → 64 hex chars)
 * @returns {string} Hex token string
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a QR code as a base64 data URL.
 * @param {object} payload - Data to encode in the QR
 * @returns {Promise<string>} Base64 data URL of the QR image
 */
const generateQRCodeDataURL = async (payload) => {
  const data = JSON.stringify(payload);
  const qrDataURL = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    width: 300,
  });
  return qrDataURL;
};

/**
 * Generate a QR code as an SVG string.
 * @param {object} payload - Data to encode in the QR
 * @returns {Promise<string>} SVG string
 */
const generateQRCodeSVG = async (payload) => {
  const data = JSON.stringify(payload);
  const svg = await QRCode.toString(data, {
    type: 'svg',
    errorCorrectionLevel: 'H',
  });
  return svg;
};

module.exports = { generateSecureToken, generateQRCodeDataURL, generateQRCodeSVG };
