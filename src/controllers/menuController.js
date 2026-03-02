const { Op } = require('sequelize');
const { MenuItem, Category, Branch, Rating, sequelize } = require('../models');

/* ============================================================
   CATEGORY MANAGEMENT
============================================================ */

/**
 * POST /api/menu/categories
 */
const createCategory = async (req, res) => {
  try {
    const { name, branch_id, description, sort_order } = req.body;

    const branch = await Branch.findOne({
      where: { id: branch_id, deleted_at: null }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found.'
      });
    }

    const category = await Category.create({
      name,
      branch_id,
      description,
      sort_order
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: { category }
    });

  } catch (error) {
    console.error('CreateCategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * GET /api/menu/categories
 */
const getCategories = async (req, res) => {
  try {
    const { branch_id } = req.query;
    const where = { is_active: true };

    if (branch_id) where.branch_id = branch_id;

    const categories = await Category.findAll({
      where,
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    console.error('GetCategories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * PUT /api/menu/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    const { name, description, sort_order, is_active } = req.body;

    await category.update({
      name,
      description,
      sort_order,
      is_active
    });

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: { category }
    });

  } catch (error) {
    console.error('UpdateCategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * DELETE /api/menu/categories/:id
 */
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    await category.update({ is_active: false });

    return res.status(200).json({
      success: true,
      message: 'Category deactivated successfully.'
    });

  } catch (error) {
    console.error('DeleteCategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/* ============================================================
   MENU ITEM MANAGEMENT
============================================================ */

/**
 * POST /api/menu/items
 */
const createMenuItem = async (req, res) => {
  try {
    const { name, description, category_id, branch_id, price, status } = req.body;

    const branch = await Branch.findOne({
      where: { id: branch_id, deleted_at: null }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found.'
      });
    }

    const category = await Category.findOne({
      where: { id: category_id, branch_id }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or does not belong to this branch.'
      });
    }

    const image = req.file
      ? `/uploads/menu/${req.file.filename}`
      : null;

    const menuItem = await MenuItem.create({
      name,
      description,
      category_id,
      branch_id,
      price,
      image,
      status: status || 'available'
    });

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully.',
      data: { menuItem }
    });

  } catch (error) {
    console.error('CreateMenuItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * GET /api/menu/items
 */
const getMenuItems = async (req, res) => {
  try {
    const { branch_id, category_id, status } = req.query;
    const where = { deleted_at: null };

    if (branch_id) where.branch_id = branch_id;
    if (category_id) where.category_id = category_id;
    if (status) where.status = status;

    const menuItems = await MenuItem.findAll({
      where,
      include: [
        { association: 'category', attributes: ['id', 'name'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
        {
          association: 'ratings',
          attributes: []
        }
      ],
      attributes: {
        include: [
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn('AVG', sequelize.col('ratings.rating')),
              0
            ),
            'average_rating'
          ],
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn('COUNT', sequelize.col('ratings.id')),
              0
            ),
            'total_ratings'
          ]
        ]
      },
      group: [
        'MenuItem.id',
        'category.id',
        'branch.id'
      ],
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: { menuItems }
    });

  } catch (error) {
    console.error('GetMenuItems error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * GET /api/menu/items/:id
 */
const getMenuItemById = async (req, res) => {
  try {
    const menuItem = await MenuItem.findOne({
      where: { id: req.params.id, deleted_at: null },
      include: [
        { association: 'category', attributes: ['id', 'name'] },
        { association: 'branch', attributes: ['id', 'branch_name'] }
      ]
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { menuItem }
    });

  } catch (error) {
    console.error('GetMenuItemById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * PUT /api/menu/items/:id
 */
const updateMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findOne({
      where: { id: req.params.id, deleted_at: null }
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found.'
      });
    }

    const { name, description, category_id, price, status } = req.body;

    const image = req.file
      ? `/uploads/menu/${req.file.filename}`
      : menuItem.image;

    await menuItem.update({
      name,
      description,
      category_id,
      price,
      image,
      status
    });

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully.',
      data: { menuItem }
    });

  } catch (error) {
    console.error('UpdateMenuItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/**
 * DELETE /api/menu/items/:id
 */
const deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findOne({
      where: { id: req.params.id, deleted_at: null }
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found.'
      });
    }

    await menuItem.update({
      deleted_at: new Date(),
      status: 'unavailable'
    });

    return res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully.'
    });

  } catch (error) {
    console.error('DeleteMenuItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/* ============================================================
   RATING SYSTEM
============================================================ */

const rateMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found.'
      });
    }

    await Rating.upsert({
      user_id: req.user.id,
      menu_item_id: menuItem.id,
      rating: req.body.rating,
      review: req.body.review || null
    });

    return res.status(200).json({
      success: true,
      message: 'Rating submitted successfully.'
    });

  } catch (error) {
    console.error('RateMenuItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  rateMenuItem
};