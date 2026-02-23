const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('Reservation', {
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
  reservation_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  reservation_time: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  number_of_people: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '50% of total_amount',
  },
  status: {
    type: DataTypes.ENUM(
      'Pending Payment',
      'Confirmed',
      'Arrived',
      'Completed',
      'Cancelled'
    ),
    defaultValue: 'Pending Payment',
  },
  qr_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  },
  qr_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  qr_generated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  special_requests: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'reservations',
  timestamps: true,
});

module.exports = Reservation;
