const { UserAddress } = require('../models');

/* =============================
   CREATE ADDRESS
============================= */
const createAddress = async (req, res) => {
  try {
    const { label, address, lat, lng, is_default } = req.body;

    if (is_default) {
      // Remove previous default
      await UserAddress.update(
        { is_default: false },
        { where: { user_id: req.user.id } }
      );
    }

    const newAddress = await UserAddress.create({
      user_id: req.user.id,
      label,
      address,
      lat,
      lng,
      is_default: is_default || false
    });

    return res.status(201).json({
      success: true,
      data: { address: newAddress }
    });

  } catch (error) {
    console.error('CreateAddress error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/* =============================
   GET USER ADDRESSES
============================= */
const getUserAddresses = async (req, res) => {
  try {
    const addresses = await UserAddress.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });

    return res.json({
      success: true,
      data: { addresses }
    });

  } catch (error) {
    console.error('GetAddresses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


module.exports = {
  createAddress,
  getUserAddresses
};