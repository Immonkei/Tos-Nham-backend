const express = require('express');
const router = express.Router();
const abaController = require('../controllers/abaController'); // Import the entire controller instance

// Route to initiate an ABA PayWay payment
router.post('/create-payment', abaController.createPayment);

// Route for ABA PayWay callback (pushback notification)
router.post('/callback', abaController.abaCallback);

module.exports = router;
