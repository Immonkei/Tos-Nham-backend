const { Cart, MenuItem } = require('../models');

/* ===============================
   ADD ITEM TO CART
================================ */
const addToCart = async (req, res) => {
  try {
    const { menu_item_id, quantity } = req.body;

    const menuItem = await MenuItem.findByPk(menu_item_id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    const existingItem = await Cart.findOne({
      where: {
        user_id: req.user.id,
        menu_item_id
      }
    });

    if (existingItem) {
      await existingItem.update({
        quantity: existingItem.quantity + quantity
      });
    } else {
      await Cart.create({
        user_id: req.user.id,
        menu_item_id,
        quantity
      });
    }

    return res.json({
      success: true,
      message: 'Item added to cart'
    });

  } catch (error) {
    console.error('AddToCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/* ===============================
   GET USER CART
================================ */
const getCart = async (req, res) => {
  try {
    const cartItems = await Cart.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          association: 'menuItem',
          attributes: ['id', 'name', 'price', 'image', 'branch_id'],
          include: [
            {
              association: 'branch',
              attributes: ['id', 'branch_name']
            }
          ]
        }
      ]
    });

    return res.json({
      success: true,
      data: { cartItems }
    });

  } catch (error) {
    console.error('GetCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/* ===============================
   REMOVE ITEM
================================ */
const removeFromCart = async (req, res) => {
  try {
    await Cart.destroy({
      where: {
        user_id: req.user.id,
        menu_item_id: req.params.menu_item_id
      }
    });

    return res.json({
      success: true,
      message: 'Item removed from cart'
    });

  } catch (error) {
    console.error('RemoveCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  removeFromCart
};