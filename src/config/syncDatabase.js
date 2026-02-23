require('dotenv').config();
const { sequelize } = require('../models');

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // force: false → only create tables if they don't exist
    // alter: true  → update columns if schema changed (use carefully in production)
    await sequelize.sync({ alter: true });
    console.log('✅ All models synchronized with the database.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
}

syncDatabase();
