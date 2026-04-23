const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const registerUser = async (userData) => {
  const { email, phoneNumber } = userData;

  const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
  if (userExists) {
    const error = new Error('User already exists with this email or phone number');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.create(userData);

  const token = generateToken(user._id);

  // Remove password from output
  const userResponse = user.toObject();
  delete userResponse.password;

  return { user: userResponse, token };
};

const loginUser = async (email, password) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user._id);

  const userResponse = user.toObject();
  delete userResponse.password;

  return { user: userResponse, token };
};

const updateUser = async (userId, updateData) => {
  // Prevent password updates via this endpoint
  delete updateData.password;

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

module.exports = {
  registerUser,
  loginUser,
  updateUser,
};
