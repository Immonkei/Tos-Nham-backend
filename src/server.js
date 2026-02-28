require('dotenv').config();   // MUST BE FIRST LINE

const express = require('express');
const pool = require('./config/Supabase');

const app = express();
app.use(express.json());

const { sequelize } = require('./models');

app.get('/test-db', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ success: true, message: 'Sequelize connected to Supabase successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});