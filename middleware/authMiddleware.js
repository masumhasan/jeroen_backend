const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    const error = new Error('You are not logged in. Please log in to get access.');
    error.statusCode = 401;
    throw error;
  }

  // Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    const error = new Error('The user belonging to this token no longer exists.');
    error.statusCode = 401;
    throw error;
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
};

module.exports = { protect };
