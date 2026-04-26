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

const parseWeightNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 0) return null;
  return Number(numeric.toFixed(1));
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

  const signupWeight = parseWeightNumber(finalUserData.weight);
  if (signupWeight !== null) {
    finalUserData.weight = signupWeight;
    finalUserData.startWeight = signupWeight;
    finalUserData.currentWeight = signupWeight;
    finalUserData.weightHistory = [{ weight: signupWeight, recordedAt: new Date() }];
  }

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
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if we need to recalculate recommendations
  const healthFields = ['age', 'height', 'weight', 'gender', 'activityLevel', 'goal'];
  const isHealthUpdated = healthFields.some(field => updateData[field] !== undefined);
  
  // If the user is manually editing recommendations, we don't want to overwrite them with AI
  const manualMacroUpdate = ['recommendedCalories', 'recommendedProtein', 'recommendedCarbs', 'recommendedFat'].some(f => updateData[f] !== undefined);

  if (isHealthUpdated && !manualMacroUpdate) {
    try {
      const mergedData = {
        firstName: existingUser.firstName,
        age: existingUser.age,
        gender: existingUser.gender,
        height: existingUser.height,
        weight: existingUser.weight,
        activityLevel: existingUser.activityLevel,
        goal: existingUser.goal,
        ...updateData
      };
      const recommendations = await nutritionService.generateRecommendations(mergedData);
      Object.assign(updateData, recommendations);
    } catch (err) {
      console.error('Failed to regenerate recommendations during update:', err);
    }
  }

  const updatedData = { ...updateData };
  const patchWeight = parseWeightNumber(updatedData.weight);
  if (patchWeight !== null) {
    updatedData.weight = patchWeight;
    updatedData.currentWeight = patchWeight;
  }

  const user = await User.findByIdAndUpdate(userId, updatedData, {
    new: true,
    runValidators: true,
  });

  // Ensure first-ever weight becomes start weight (for legacy users)
  if (patchWeight !== null && (user.startWeight === undefined || user.startWeight === null)) {
    const legacyStartWeight = parseWeightNumber(
      existingUser.currentWeight ?? existingUser.weight ?? existingUser.weightHistory?.[0]?.weight
    );
    user.startWeight = legacyStartWeight ?? patchWeight;
    if (!Array.isArray(user.weightHistory) || user.weightHistory.length === 0) {
      user.weightHistory = [{ weight: user.startWeight, recordedAt: new Date() }];
    }
    await user.save();
  }

  return user;
};

const updateWeight = async (userId, weight) => {
  const parsedWeight = parseWeightNumber(weight);
  if (parsedWeight === null) {
    const error = new Error('Please provide a valid weight');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const hasStartWeight = user.startWeight !== undefined && user.startWeight !== null;
  if (!hasStartWeight) {
    const derivedStartWeight = parseWeightNumber(
      user.currentWeight ?? user.weight ?? user.weightHistory?.[0]?.weight
    );
    user.startWeight = derivedStartWeight ?? parsedWeight;
    if (!Array.isArray(user.weightHistory) || user.weightHistory.length === 0) {
      user.weightHistory = [{ weight: user.startWeight, recordedAt: new Date() }];
    }
  }

  const history = Array.isArray(user.weightHistory) ? user.weightHistory : [];
  const latestEntry = history[history.length - 1];
  const isDuplicate = latestEntry && Number(latestEntry.weight) === parsedWeight;

  if (!isDuplicate) {
    history.push({ weight: parsedWeight, recordedAt: new Date() });
  }

  user.weightHistory = history;
  user.currentWeight = parsedWeight;
  user.weight = parsedWeight; // backward compatibility for existing screens
  await user.save();

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
  updateWeight,
  getUserWithPlan,
};
