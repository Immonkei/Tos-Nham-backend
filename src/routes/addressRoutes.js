const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { createAddress, getUserAddresses } = require('../controllers/addressController');

router.post('/', authMiddleware, createAddress);
router.get('/', authMiddleware, getUserAddresses);

module.exports = router;