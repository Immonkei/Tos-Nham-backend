const { Op } = require('sequelize');
const { Branch, User } = require('../models');

/**
 * POST /api/branches
 * Create a new branch. Admin only.
 */
const createBranch = async (req, res) => {
  try {
    const { branch_name, address, phone, status } = req.body;

    const branch = await Branch.create({ branch_name, address, phone, status });

    return res.status(201).json({
      success: true,
      message: 'Branch created successfully.',
      data: { branch },
    });
  } catch (error) {
    console.error('CreateBranch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/branches
 * Get all active branches. Public.
 */
const getBranches = async (req, res) => {
  try {
    const branches = await Branch.findAll({
      where: { deleted_at: null },
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: { branches, total: branches.length },
    });
  } catch (error) {
    console.error('GetBranches error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/branches/:id
 * Get a single branch by ID. Public.
 */
const getBranchById = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      where: { id: req.params.id, deleted_at: null },
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    return res.status(200).json({ success: true, data: { branch } });
  } catch (error) {
    console.error('GetBranchById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/branches/:id
 * Update branch information. Admin only.
 */
const updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      where: { id: req.params.id, deleted_at: null },
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    const { branch_name, address, phone, status } = req.body;
    await branch.update({ branch_name, address, phone, status });

    return res.status(200).json({
      success: true,
      message: 'Branch updated successfully.',
      data: { branch },
    });
  } catch (error) {
    console.error('UpdateBranch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/branches/:id
 * Soft delete a branch. Admin only.
 */
const deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findOne({
      where: { id: req.params.id, deleted_at: null },
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    await branch.update({ deleted_at: new Date(), status: 'inactive' });

    return res.status(200).json({
      success: true,
      message: 'Branch deleted successfully.',
    });
  } catch (error) {
    console.error('DeleteBranch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { createBranch, getBranches, getBranchById, updateBranch, deleteBranch };
