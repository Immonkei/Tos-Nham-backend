// models/UserAddress.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserAddress = sequelize.define('UserAddress', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  label: {
    type: DataTypes.STRING(50), // Home, Work
    allowNull: true,
  },

  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },

  lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },

  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }

}, {
  tableName: 'user_addresses',
  timestamps: true,
  underscored: true
});

module.exports = UserAddress;