const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
} = require('../controllers/branchController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

const branchValidation = [
  body('branch_name').trim().notEmpty().withMessage('Branch name is required.'),
  body('address').trim().notEmpty().withMessage('Address is required.'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number.'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive.'),
];

/**
 * @route   GET /api/branches
 * @desc    Get all branches
 * @access  Public
 */
router.get('/', getBranches);

/**
 * @route   GET /api/branches/:id
 * @desc    Get branch by ID
 * @access  Public
 */
router.get('/:id', getBranchById);

/**
 * @route   POST /api/branches
 * @desc    Create a new branch
 * @access  Admin only
 */
router.post('/', authMiddleware, roleMiddleware('admin'), branchValidation, validateRequest, createBranch);

/**
 * @route   PUT /api/branches/:id
 * @desc    Update branch
 * @access  Admin only
 */
router.put('/:id', authMiddleware, roleMiddleware('admin'), branchValidation, validateRequest, updateBranch);

/**
 * @route   DELETE /api/branches/:id
 * @desc    Soft delete branch
 * @access  Admin only
 */
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteBranch);

module.exports = router;
