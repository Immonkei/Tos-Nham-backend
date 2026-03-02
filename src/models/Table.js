const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Table = sequelize.define(
  "Table",
  {
    branch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    table_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    seat_capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "available",
    },
  },
  {
    tableName: "tables",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Table;