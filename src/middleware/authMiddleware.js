const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * authMiddleware
 * Verifies the JWT token from the Authorization header.
 * Attaches the decoded user object to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data to ensure account is still active
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token invalid.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

/**
 * roleMiddleware
 * Checks if the authenticated user has one of the allowed roles.
 * Must be used after authMiddleware.
 *
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'staff', 'customer')
 */
const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

/**
 * branchAccessMiddleware
 * Ensures staff can only access data from their own branch.
 * Admin can access all branches.
 * Reads branch_id from req.params, req.query, or req.body.
 */
const branchAccessMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  // Admin has unrestricted access
  if (req.user.role === 'admin') {
    return next();
  }

  const requestedBranchId =
    parseInt(req.params.branch_id) ||
    parseInt(req.query.branch_id) ||
    parseInt(req.body.branch_id);

  if (req.user.role === 'staff') {
    if (requestedBranchId && req.user.branch_id !== requestedBranchId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your assigned branch.',
      });
    }
    // Inject staff's branch_id if not provided
    if (!requestedBranchId) {
      req.body.branch_id = req.user.branch_id;
    }
  }

  next();
};

module.exports = { authMiddleware, roleMiddleware, branchAccessMiddleware };
