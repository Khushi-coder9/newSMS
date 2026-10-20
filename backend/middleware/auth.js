const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token missing.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role, email }

    // Optionally attach full user info if needed
    const userDoc = await User.findById(decoded.userId).select('name email role age designation');
    if (userDoc) {
      req.userDoc = userDoc;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};
