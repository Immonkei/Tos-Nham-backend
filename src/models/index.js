const sequelize = require('../config/database');
const DataTypes = require('sequelize').DataTypes;

const User = require('./User');
const Branch = require('./Branch');
const Category = require('./Category');
const MenuItem = require('./MenuItem');
const Reservation = require('./Reservation');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Payment = require('./Payment');
const Table = require('./Table');
const Rating = require('./Rating')(sequelize, DataTypes);
const UserAddress = require('./UserAddress');
const Cart = require('./Cart');
/* =========================
   ASSOCIATIONS
========================= */

// User ↔ Branch
User.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(User, { foreignKey: 'branch_id', as: 'staff' });

// Category ↔ Branch
Category.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(Category, { foreignKey: 'branch_id', as: 'categories' });

// MenuItem ↔ Branch
MenuItem.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(MenuItem, { foreignKey: 'branch_id', as: 'menuItems' });

// MenuItem ↔ Category
MenuItem.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(MenuItem, { foreignKey: 'category_id', as: 'menuItems' });

// Reservation ↔ User
Reservation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Reservation, { foreignKey: 'user_id', as: 'reservations' });

// Reservation ↔ Branch
Reservation.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(Reservation, { foreignKey: 'branch_id', as: 'reservations' });

// Order ↔ User
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });

// Order ↔ Branch
Order.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(Order, { foreignKey: 'branch_id', as: 'orders' });

// OrderItem ↔ Order
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'orderItems' });

// OrderItem ↔ MenuItem
OrderItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menuItem' });
MenuItem.hasMany(OrderItem, { foreignKey: 'menu_item_id', as: 'orderItems' });

// Payment ↔ Order
Payment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Order.hasOne(Payment, { foreignKey: 'order_id', as: 'payment' });

// Payment ↔ Reservation
Payment.belongsTo(Reservation, { foreignKey: 'reservation_id', as: 'reservation' });
Reservation.hasOne(Payment, { foreignKey: 'reservation_id', as: 'payment' });

// Payment ↔ User
Payment.belongsTo(User, { foreignKey: 'verified_by', as: 'verifiedBy' });

// Reservation ↔ Table
Reservation.belongsTo(Table, { foreignKey: "table_id" });
Table.hasMany(Reservation, { foreignKey: "table_id" });
// Cart ↔ User
User.hasMany(Cart, { foreignKey: 'user_id', as: 'cartItems' });
Cart.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Cart ↔ MenuItem
MenuItem.hasMany(Cart, { foreignKey: 'menu_item_id', as: 'cartItems' });
Cart.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menuItem' });
User.hasMany(UserAddress, {
  foreignKey: 'user_id',
  as: 'addresses'
});

UserAddress.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});
/* =========================
   RATING ASSOCIATIONS
========================= */

Rating.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Rating, { foreignKey: 'user_id', as: 'ratings' });

Rating.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menuItem' });
MenuItem.hasMany(Rating, { foreignKey: 'menu_item_id', as: 'ratings' });

module.exports = {
  sequelize,
  User,
  Branch,
  Category,
  MenuItem,
  Reservation,
  Order,
  OrderItem,
  Payment,
  Table,
  Rating,
  UserAddress,
  Cart,
};