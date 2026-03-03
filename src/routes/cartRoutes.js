const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  addToCart,
  getCart,
  removeFromCart
} = require('../controllers/cartController');

const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

router.post(
  '/',
  authMiddleware,
  [
    body('menu_item_id').isInt(),
    body('quantity').isInt({ min: 1 })
  ],
  validateRequest,
  addToCart
);

router.get('/', authMiddleware, getCart);

router.delete('/:menu_item_id', authMiddleware, removeFromCart);

module.exports = router;