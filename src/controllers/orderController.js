const { Op } = require('sequelize');
const axios = require('axios');
const {
  Order,
  OrderItem,
  MenuItem,
  Branch,
  sequelize
} = require('../models');
const { generateKHQR } = require('../services/bakongService');

/* ============================================================
   CREATE ORDER
============================================================ */
const createOrder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      branch_id,
      order_type,
      payment_method,
      items,
      delivery_address,
      delivery_phone,
      delivery_name,
      delivery_lat,
      delivery_lng,
      notes,
    } = req.body;

    // Validate branch
    const branch = await Branch.findOne({
      where: { id: branch_id, deleted_at: null },
    });

    if (!branch) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Branch not found.',
      });
    }

    // Validate items
    if (!items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item.',
      });
    }

    let total_amount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const menuItem = await MenuItem.findOne({
        where: {
          id: item.menu_item_id,
          branch_id,
          deleted_at: null,
          status: 'available',
        },
      });

      if (!menuItem) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: `Menu item ID ${item.menu_item_id} not found.`,
        });
      }

      const subtotal = parseFloat(
        (menuItem.price * item.quantity).toFixed(2)
      );

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

    // Delivery validation
    if (order_type === 'delivery') {
      if (
        !delivery_address ||
        !delivery_phone ||
        !delivery_name ||
        !delivery_lat ||
        !delivery_lng
      ) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message:
            'Complete delivery information (address, phone, name, latitude, longitude) is required.',
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
        delivery_lat,
        delivery_lng,
        notes,
      },
      { transaction: t }
    );

    // Create order items
    const orderItems = await OrderItem.bulkCreate(
      orderItemsData.map((item) => ({
        ...item,
        order_id: order.id,
      })),
      { transaction: t }
    );

    let paymentData = null;

    // QR Payment
    if (payment_method === 'qr_payment') {
      const { qr, md5 } = await generateKHQR(order);

      order.bakong_md5 = md5;
      await order.save({ transaction: t });

      paymentData = {
        method: 'bakong',
        qr,
        md5,
      };
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: {
        order: {
          ...order.toJSON(),
          orderItems,
        },
        payment: paymentData,
      },
    });

  } catch (error) {
    await t.rollback();
    console.error('CreateOrder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};


/* ============================================================
   CHECK PAYMENT (Bakong)
============================================================ */
const checkOrderPayment = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.bakong_md5) {
      return res.status(400).json({
        success: false,
        message: 'This order does not use QR payment'
      });
    }

    // Call FastAPI
    const response = await axios.get(
      `http://localhost:8001/check/${order.bakong_md5}`
    );

    const isPaid = response.data.is_paid;

    if (isPaid) {
      await order.update({
        payment_status: 'Paid',
        order_status: 'Confirmed'
      });
    }

    return res.json({
      success: true,
      is_paid: isPaid,
      order
    });

  } catch (error) {
    console.error('CheckOrderPayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/* ============================================================
   GET ORDERS (ROLE FILTERED)
============================================================ */
const getOrders = async (req, res) => {
  try {
    const {
      branch_id,
      order_status,
      payment_status,
      order_type,
      page = 1,
      limit = 20
    } = req.query;

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

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { association: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'branch', attributes: ['id', 'branch_name'] },
        {
          association: 'orderItems',
          include: [
            { association: 'menuItem', attributes: ['id', 'name', 'price'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    return res.status(200).json({
      success: true,
      data: {
        orders: rows,
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
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


/* ============================================================
   GET ORDER BY ID
============================================================ */
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { association: 'orderItems' }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    return res.json({
      success: true,
      data: { order },
    });

  } catch (error) {
    console.error('GetOrderById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};


/* ============================================================
   UPDATE ORDER STATUS
============================================================ */
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    await order.update({
      order_status: req.body.order_status,
    });

    return res.json({
      success: true,
      message: 'Order status updated.',
      data: { order },
    });

  } catch (error) {
    console.error('UpdateOrderStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};


/* ============================================================
   GET ORDERS BY BRANCH
============================================================ */
const getOrdersByBranch = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { branch_id: req.params.branch_id },
    });

    return res.json({
      success: true,
      data: { orders },
    });

  } catch (error) {
    console.error('GetOrdersByBranch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};


/* ============================================================
   EXPORTS
============================================================ */
module.exports = {
  createOrder,
  checkOrderPayment,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrdersByBranch,
};