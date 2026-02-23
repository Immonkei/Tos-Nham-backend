const { Op, fn, col, literal } = require('sequelize');
const { Order, OrderItem, MenuItem, Branch, User, sequelize } = require('../models');

/**
 * POST /api/orders
 * Create a new order with order items.
 * Access: All authenticated users
 */
const createOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      branch_id,
      order_type,
      payment_method,
      items, // Array of { menu_item_id, quantity, special_instructions }
      delivery_address,
      delivery_phone,
      delivery_name,
      notes,
    } = req.body;

    // Validate branch
    const branch = await Branch.findOne({ where: { id: branch_id, deleted_at: null } });
    if (!branch) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    // Validate and calculate items
    if (!items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Order must contain at least one item.' });
    }

    let total_amount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const menuItem = await MenuItem.findOne({
        where: { id: item.menu_item_id, branch_id, deleted_at: null, status: 'available' },
      });

      if (!menuItem) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: `Menu item ID ${item.menu_item_id} not found or unavailable.`,
        });
      }

      const subtotal = parseFloat((menuItem.price * item.quantity).toFixed(2));
      total_amount += subtotal;

      orderItemsData.push({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price: menuItem.price,
        subtotal,
        special_instructions: item.special_instructions || null,
      });
    }

    total_amount = parseFloat(total_amount.toFixed(2));

    // Validate delivery info
    if (order_type === 'delivery') {
      if (!delivery_address || !delivery_phone || !delivery_name) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Delivery orders require delivery_address, delivery_phone, and delivery_name.',
        });
      }
    }

    // Create order
    const order = await Order.create(
      {
        user_id: req.user.id,
        branch_id,
        order_type,
        total_amount,
        payment_method,
        payment_status: 'Pending',
        order_status: 'Pending',
        delivery_address,
        delivery_phone,
        delivery_name,
        notes,
      },
      { transaction: t }
    );

    // Create order items
    const orderItems = await OrderItem.bulkCreate(
      orderItemsData.map((item) => ({ ...item, order_id: order.id })),
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: {
        order: {
          ...order.toJSON(),
          orderItems,
        },
      },
    });
  } catch (error) {
    await t.rollback();
    console.error('CreateOrder error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/orders
 * Get orders. Customers see their own; staff/admin filter by branch.
 */
const getOrders = async (req, res) => {
  try {
    const { branch_id, order_status, payment_status, order_type, page = 1, limit = 20 } = req.query;
    const where = {};

    if (req.user.role === 'customer') {
      where.user_id = req.user.id;
    } else if (req.user.role === 'staff') {
      where.branch_id = req.user.branch_id;
    } else if (branch_id) {
      where.branch_id = branch_id;
    }

    if (order_status) where.order_status = order_status;
    if (payment_status) where.payment_status = payment_status;
    if (order_type) where.order_type = order_type;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
        {
          association: 'orderItems',
          include: [{ association: 'menuItem', attributes: ['id', 'name', 'price'] }],
        },
        { association: 'payment', attributes: ['id', 'status', 'receipt_image_path'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('GetOrders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/orders/:id
 * Get a single order by ID.
 */
const getOrderById = async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (req.user.role === 'customer') where.user_id = req.user.id;

    const order = await Order.findOne({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name', 'address', 'phone'] },
        {
          association: 'orderItems',
          include: [{ association: 'menuItem', attributes: ['id', 'name', 'price', 'image'] }],
        },
        { association: 'payment' },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    return res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    console.error('GetOrderById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/orders/:id/status
 * Update order status. Staff / Admin.
 * Flow: Pending → Confirmed → Preparing → Ready → Completed (or Cancelled)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { order_status } = req.body;
    const allowedStatuses = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

    if (!allowedStatuses.includes(order_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`,
      });
    }

    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Staff can only update orders from their branch
    if (req.user.role === 'staff' && order.branch_id !== req.user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This order belongs to a different branch.',
      });
    }

    await order.update({ order_status });

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${order_status}.`,
      data: { order },
    });
  } catch (error) {
    console.error('UpdateOrderStatus error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/orders/branch/:branch_id
 * Get all orders for a specific branch. Staff / Admin.
 */
const getOrdersByBranch = async (req, res) => {
  try {
    const { branch_id } = req.params;
    const { order_status, date } = req.query;

    // Staff can only see their own branch
    if (req.user.role === 'staff' && parseInt(branch_id) !== req.user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view orders for your assigned branch.',
      });
    }

    const where = { branch_id };
    if (order_status) where.order_status = order_status;
    if (date) {
      where.created_at = {
        [Op.between]: [
          new Date(`${date}T00:00:00`),
          new Date(`${date}T23:59:59`),
        ],
      };
    }

    const orders = await Order.findAll({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'phone'] },
        {
          association: 'orderItems',
          include: [{ association: 'menuItem', attributes: ['id', 'name'] }],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: { orders, total: orders.length },
    });
  } catch (error) {
    console.error('GetOrdersByBranch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrdersByBranch,
};
