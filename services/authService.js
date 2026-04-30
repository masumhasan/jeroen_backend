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
  
  const recCal = recommendations.recommendedCalories || 2000;
  const recP = recommendations.recommendedProtein || 150;
  const recC = recommendations.recommendedCarbs || 250;
  const recF = recommendations.recommendedFat || 70;

  // Merge recommendations into userData with sensible defaults
  const finalUserData = {
    ...userData,
    role: 'user',
    recommendedCalories: recCal,
    recommendedProtein: recP,
    recommendedCarbs: recC,
    recommendedFat: recF,
    aiBaselineCalories: recCal,
    aiBaselineProteinG: recP,
    aiBaselineCarbsG: recC,
    aiBaselineFatG: recF,
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
  delete updateData.role;
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
      if (recommendations.recommendedCalories != null) {
        updateData.aiBaselineCalories = recommendations.recommendedCalories;
        updateData.aiBaselineProteinG = recommendations.recommendedProtein;
        updateData.aiBaselineCarbsG = recommendations.recommendedCarbs;
        updateData.aiBaselineFatG = recommendations.recommendedFat;
      }
    } catch (err) {
      console.error('Failed to regenerate recommendations during update:', err);
    }
  }

  const touchesNutritionTargets = [
    'recommendedCalories',
    'recommendedProtein',
    'recommendedCarbs',
    'recommendedFat',
  ].some((f) => updateData[f] !== undefined);

  if (touchesNutritionTargets) {
    const nextCal = updateData.recommendedCalories ?? existingUser.recommendedCalories;
    const nextP = updateData.recommendedProtein ?? existingUser.recommendedProtein;
    const nextC = updateData.recommendedCarbs ?? existingUser.recommendedCarbs;
    const nextF = updateData.recommendedFat ?? existingUser.recommendedFat;
    const macroCal =
      (Number(nextP) || 0) * 4 + (Number(nextC) || 0) * 4 + (Number(nextF) || 0) * 9;
    if (!Number.isFinite(Number(nextCal)) || Number(nextCal) < 1) {
      const err = new Error('Target calories must be at least 1');
      err.statusCode = 400;
      throw err;
    }
    if (
      (Number(nextP) || 0) < 0 ||
      (Number(nextC) || 0) < 0 ||
      (Number(nextF) || 0) < 0
    ) {
      const err = new Error('Macro targets must be non-negative');
      err.statusCode = 400;
      throw err;
    }
    if (macroCal > Number(nextCal) + 0.5) {
      const err = new Error(
        'Macros exceed daily calories (4 kcal/g protein & carbs, 9 kcal/g fat). Reduce grams or increase calories.'
      );
      err.statusCode = 400;
      throw err;
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

const ALLOWED_ROLES = ['user', 'moderator', 'admin', 'superadmin'];

/**
 * Ensures env-configured superadmin exists (creates if missing; keeps existing record).
 */
const ensureSuperAdminUser = async () => {
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  if (!email || !password) {
    console.warn('SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping superadmin bootstrap.');
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'superadmin') {
      existing.role = 'superadmin';
      await existing.save({ validateBeforeSave: true });
      console.log('✓ Superadmin role ensured for:', email);
    }
    return;
  }

  const defaultPhone = '+31600000001';
  let phoneNumber = (process.env.SUPERADMIN_PHONE || defaultPhone).trim();
  const phoneTaken = await User.findOne({ phoneNumber });
  if (phoneTaken) {
    phoneNumber = `+31639${Date.now().toString().slice(-7)}`;
  }

  await User.create({
    firstName: 'Support',
    lastName: 'Admin',
    email,
    phoneNumber,
    password,
    role: 'superadmin',
    recommendedCalories: 2000,
    recommendedProtein: 150,
    recommendedCarbs: 250,
    recommendedFat: 70,
  });
  console.log('✓ Superadmin user created:', email);
};

/**
 * Dashboard-only: admin may set user|moderator|admin; superadmin may also set superadmin.
 */
const updateUserRole = async (actor, targetUserId, newRole) => {
  if (!ALLOWED_ROLES.includes(newRole)) {
    const error = new Error('Invalid role');
    error.statusCode = 400;
    throw error;
  }

  const actorRole = (actor.role || 'user').toLowerCase();
  if (!['admin', 'superadmin'].includes(actorRole)) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  if (newRole === 'superadmin' && actorRole !== 'superadmin') {
    const error = new Error('Only a superadmin can assign the superadmin role');
    error.statusCode = 403;
    throw error;
  }

  const target = await User.findById(targetUserId);
  if (!target) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  target.role = newRole;
  await target.save({ validateBeforeSave: true });
  return target;
};

module.exports = {
  registerUser,
  loginUser,
  updateUser,
  updateWeight,
  getUserWithPlan,
  ensureSuperAdminUser,
  updateUserRole,
};
