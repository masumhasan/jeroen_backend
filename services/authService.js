const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');
const ShoppingList = require('../models/ShoppingList');
const nutritionService = require('./nutritionService');

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

  // Generate recommendations
  let recommendations = {};
  try {
    recommendations = await nutritionService.generateRecommendations(userData);
  } catch (err) {
    console.error('Failed to generate recommendations:', err);
  }
  
  // Merge recommendations into userData with sensible defaults
  const finalUserData = { 
    ...userData, 
    recommendedCalories: recommendations.recommendedCalories || 2000,
    recommendedProtein: recommendations.recommendedProtein || 150,
    recommendedCarbs: recommendations.recommendedCarbs || 250,
    recommendedFat: recommendations.recommendedFat || 70
  };

  const user = await User.create(finalUserData);
  const token = generateToken(user._id);

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

  // Check if we need to recalculate recommendations
  const healthFields = ['age', 'height', 'weight', 'gender', 'activityLevel', 'goal'];
  const isHealthUpdated = healthFields.some(field => updateData[field] !== undefined);
  
  // If the user is manually editing recommendations, we don't want to overwrite them with AI
  const manualMacroUpdate = ['recommendedCalories', 'recommendedProtein', 'recommendedCarbs', 'recommendedFat'].some(f => updateData[f] !== undefined);

  if (isHealthUpdated && !manualMacroUpdate) {
    const currentUser = await User.findById(userId);
    if (currentUser) {
      try {
        const mergedData = {
          firstName: currentUser.firstName,
          age: currentUser.age,
          gender: currentUser.gender,
          height: currentUser.height,
          weight: currentUser.weight,
          activityLevel: currentUser.activityLevel,
          goal: currentUser.goal,
          ...updateData
        };
        const recommendations = await nutritionService.generateRecommendations(mergedData);
        Object.assign(updateData, recommendations);
      } catch (err) {
        console.error('Failed to regenerate recommendations during update:', err);
      }
    }
  }

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

const getUserWithPlan = async (userId) => {
  const user = await User.findById(userId);
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const mealPlanDoc = await MealPlan.findOne({ user: userId }).populate({
    path: 'weekPlan.meals.recipe',
    model: 'Recipe'
  });
  const shoppingListDoc = await ShoppingList.findOne({ user: userId });

  const userWithPlan = user.toObject();
  userWithPlan.weeklyMealPlan = mealPlanDoc?.weekPlan || user.weeklyMealPlan || [];
  userWithPlan.weeklyShoppingList = shoppingListDoc?.weeklyItems || user.weeklyShoppingList || [];

  return userWithPlan;
};

module.exports = {
  registerUser,
  loginUser,
  updateUser,
  getUserWithPlan,
};
