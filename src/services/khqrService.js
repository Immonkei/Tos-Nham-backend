const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Proper CRC16-CCITT (EMV Standard)
 * Polynomial: 0x1021
 * Init: 0xFFFF
 */
const crc16ccitt = (input) => {
  let crc = 0xFFFF;

  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * EMV Field Formatter
 */
const formatField = (id, value) => {
  const stringValue = String(value);
  return `${id}${stringValue.length.toString().padStart(2, '0')}${stringValue}`;
};

/**
 * Generate Secure Transaction ID
 */
const generateTransactionId = () => {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 25);
};

/**
 * Generate Proper Dynamic KHQR String
 */
const generateKHQRString = ({ amount, transactionId }) => {
  let payload = '';

  // 00 - Payload Format Indicator
  payload += formatField('00', '01');

  // 01 - Dynamic QR
  payload += formatField('01', '12');

  // 29 - Merchant Account Information (Bakong)
  const bakongId = 'ly_hour3@bkrt';

  const merchantAccount =
    formatField('00', 'kh.gov.nbc.bakong') +
    formatField('01', bakongId);

  payload += formatField('29', merchantAccount);

  // 52 - Merchant Category Code (Restaurant = 5812)
  payload += formatField('52', '5812');

  // 53 - Currency (840 = USD)
  payload += formatField('53', '840');

  // 54 - Amount
  payload += formatField('54', Number(amount).toFixed(2));

  // 58 - Country Code
  payload += formatField('58', 'KH');

  // 59 - Merchant Name
  payload += formatField('59', 'Tos Nham');

  // 60 - Merchant City
  payload += formatField('60', 'Phnom Penh');

  // 62 - Additional Data (Transaction Reference)
  const additionalData = formatField('01', transactionId);
  payload += formatField('62', additionalData);

  // 63 - CRC placeholder
  payload += '6304';

  const crc = crc16ccitt(payload);
  payload += crc;

  return payload;
};

/**
 * Main Service
 */
const generateKHQR = async (amount) => {
  const transactionId = generateTransactionId();

  const khqrString = generateKHQRString({
    amount,
    transactionId,
  });

  const qrImage = await QRCode.toDataURL(khqrString);

  return {
    transactionId,
    khqrString,
    qrImage,
  };
};

module.exports = {
  generateKHQR,
};