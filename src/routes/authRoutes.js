const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

// ─── Validation rules ─────────────────────────────────────────────────────────
// npm run dev
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.'),
  body('role')
    .optional()
    .isIn(['customer', 'staff', 'admin'])
    .withMessage('Role must be customer, staff, or admin.'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number.'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const changePasswordValidation = [
  body('current_password').notEmpty().withMessage('Current password is required.'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, validateRequest, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login and receive JWT token
 * @access  Public
 */
router.post('/login', loginValidation, validateRequest, login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware, getMe);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authMiddleware, changePasswordValidation, validateRequest, changePassword);

module.exports = router;
