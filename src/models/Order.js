const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  order_type: {
    type: DataTypes.ENUM('dine-in', 'delivery', 'takeaway'),
    allowNull: false,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'transfer', 'qr_payment'),
    allowNull: false,
  },
  payment_status: {
    type: DataTypes.ENUM('Pending', 'Paid', 'Refunded'),
    defaultValue: 'Pending',
  },
  order_status: {
    type: DataTypes.ENUM(
      'Pending',
      'Confirmed',
      'Preparing',
      'Ready',
      'Completed',
      'Cancelled'
    ),
    defaultValue: 'Pending',
  },

  // 🔥 NEW FIELD FOR BAKONG
  bakong_md5: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Delivery information
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  delivery_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  delivery_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'orders',
  timestamps: true,
});

module.exports = Order;