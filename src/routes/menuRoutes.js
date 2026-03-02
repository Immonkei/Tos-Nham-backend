const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuController');
const { authMiddleware, roleMiddleware, branchAccessMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const { uploadMenuImage } = require('../utils/upload');
const { rateMenuItem } = require('../controllers/menuController');
// ─── Category Routes ──────────────────────────────────────────────────────────

/**
 * @route   GET /api/menu/categories
 * @desc    Get categories (filter by ?branch_id=)
 * @access  Public
 */
router.get('/categories', getCategories);

/**
 * @route   POST /api/menu/categories
 * @desc    Create category
 * @access  Admin, Staff
 */
router.post(
  '/categories',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  branchAccessMiddleware,
  [
    body('name').trim().notEmpty().withMessage('Category name is required.'),
    body('branch_id').isInt({ min: 1 }).withMessage('Valid branch_id is required.'),
  ],
  validateRequest,
  createCategory
);

/**
 * @route   PUT /api/menu/categories/:id
 * @desc    Update category
 * @access  Admin, Staff
 */
router.put(
  '/categories/:id',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  [body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty.')],
  validateRequest,
  updateCategory
);

/**
 * @route   DELETE /api/menu/categories/:id
 * @desc    Deactivate category
 * @access  Admin only
 */
router.delete('/categories/:id', authMiddleware, roleMiddleware('admin'), deleteCategory);

// ─── Menu Item Routes ─────────────────────────────────────────────────────────

/**
 * @route   GET /api/menu/items
 * @desc    Get menu items (filter by ?branch_id=&category_id=&status=)
 * @access  Public
 */
router.get('/items', getMenuItems);

/**
 * @route   GET /api/menu/items/:id
 * @desc    Get menu item by ID
 * @access  Public
 */
router.get('/items/:id', getMenuItemById);

/**
 * @route   POST /api/menu/items
 * @desc    Create menu item
 * @access  Admin, Staff
 */
router.post(
  '/items',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  branchAccessMiddleware,
  uploadMenuImage,
  [
    body('name').trim().notEmpty().withMessage('Item name is required.'),
    body('category_id').isInt({ min: 1 }).withMessage('Valid category_id is required.'),
    body('branch_id').isInt({ min: 1 }).withMessage('Valid branch_id is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
    body('status').optional().isIn(['available', 'unavailable']).withMessage('Invalid status.'),
  ],
  validateRequest,
  createMenuItem
);

/**
 * @route   PUT /api/menu/items/:id
 * @desc    Update menu item
 * @access  Admin, Staff
 */
router.put(
  '/items/:id',
  authMiddleware,
  roleMiddleware('admin', 'staff'),
  uploadMenuImage,
  [
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
    body('status').optional().isIn(['available', 'unavailable']).withMessage('Invalid status.'),
  ],
  validateRequest,
  updateMenuItem
);

/**
 * @route   DELETE /api/menu/items/:id
 * @desc    Soft delete menu item
 * @access  Admin, Staff
 */
router.delete('/items/:id', authMiddleware, roleMiddleware('admin', 'staff'), deleteMenuItem);

router.post(
  '/items/:id/rate',
  authMiddleware,
  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5.')
  ],
  validateRequest,
  rateMenuItem
);

module.exports = router;
