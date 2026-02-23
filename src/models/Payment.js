const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Linked to order (nullable for reservation deposits)',
  },
  reservation_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Linked to reservation deposit payment',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'transfer', 'qr_payment'),
    allowNull: false,
  },
  receipt_image_path: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending Verification', 'Verified', 'Rejected'),
    defaultValue: 'Pending Verification',
  },
  verified_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Admin user ID who verified/rejected',
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  transaction_ref: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'payments',
  timestamps: true,
});

module.exports = Payment;
