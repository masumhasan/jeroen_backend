const authService = require('../services/authService');
const mealPlanService = require('../services/mealPlanService');
const { signupSchema, signinSchema } = require('../validators/authValidator');

const signup = async (req, res, next) => {
  console.log('--- SIGNUP START ---');
  try {
    const validatedData = signupSchema.parse(req.body);
    const result = await authService.registerUser(validatedData);

    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Signup error:', error);
    next(error);
  }
};

const signin = async (req, res, next) => {
  try {
    const validatedData = signinSchema.parse(req.body);
    const result = await authService.loginUser(validatedData.email, validatedData.password);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      data: { user: req.user },
    });
  } catch (error) {
    next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await authService.updateUser(req.user._id, req.body);

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const generateMealPlan = async (req, res, next) => {
  try {
    const plan = await mealPlanService.generateWeeklyMealPlan(req.user._id);
    const user = await authService.getUserWithPlan(req.user._id);
    res.status(200).json({
      status: 'success',
      data: { 
        plan,
        targetCalories: req.user.recommendedCalories,
        shoppingList: user.weeklyShoppingList
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMealPlan = async (req, res, next) => {
  try {
    const user = await authService.getUserWithPlan(req.user._id);
    res.status(200).json({
      status: 'success',
      data: { 
        plan: user.weeklyMealPlan,
        targetCalories: user.recommendedCalories,
        shoppingList: user.weeklyShoppingList
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  signin,
  getMe,
  updateMe,
  generateMealPlan,
  getMealPlan,
};
