const authService = require('../services/authService');
const mealPlanService = require('../services/mealPlanService');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');
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

const updateMyWeight = async (req, res, next) => {
  try {
    const user = await authService.updateWeight(req.user._id, req.body.weight);

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

/**
 * Lightweight payload for the mobile Progress screen (no recipe population).
 */
const getProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [user, mealPlan] = await Promise.all([
      User.findById(userId)
        .select(
          'createdAt weight startWeight currentWeight targetWeight weightHistory recommendedCalories'
        )
        .lean(),
      MealPlan.findOne({ user: userId }).select('weekPlan').lean()
    ]);

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    let weightHistory = Array.isArray(user.weightHistory) ? user.weightHistory : [];
    if (weightHistory.length > 60) {
      weightHistory = weightHistory.slice(-60);
    }

    let mealsPlannedCount = 0;
    if (mealPlan?.weekPlan) {
      for (const day of mealPlan.weekPlan) {
        mealsPlannedCount += Array.isArray(day.meals) ? day.meals.length : 0;
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: { ...user, weightHistory },
        mealsPlannedCount,
        targetCalories: user.recommendedCalories ?? req.user.recommendedCalories ?? 0
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMealSwapAlternatives = async (req, res, next) => {
  try {
    const { day, mealType, recipeId, search, sort, calorieFilter } = req.query;
    const result = await mealPlanService.getMealSwapAlternatives(req.user._id, {
      day,
      mealType,
      recipeId,
      search,
      sort,
      calorieFilter
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const swapMeal = async (req, res, next) => {
  try {
    const result = await mealPlanService.swapMealInPlan(req.user._id, req.body);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getUsersForAdmin = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const status = (req.query.status || 'all').toLowerCase();
    const search = (req.query.search || '').trim();

    const filter = {};
    if (status === 'active' || status === 'suspended') {
      filter.accountStatus = status;
    }
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const totalCount = await User.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('firstName lastName email phoneNumber createdAt accountStatus');

    const mapped = users.map((user) => ({
      id: user._id,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || '',
      mobileNumber: user.phoneNumber || '',
      profilePicture: '',
      Joined: user.createdAt ? user.createdAt.toISOString().slice(0, 10) : '',
      location: '',
      status: user.accountStatus === 'suspended' ? 'Inactive' : 'Active',
    }));

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        meta: {
          page: safePage,
          limit,
          totalCount,
          totalPages,
        },
        data: mapped,
      },
    });
  } catch (error) {
    next(error);
  }
};

const searchUsersForAdmin = async (req, res, next) => {
  try {
    const name = (req.query.name || '').trim();
    if (!name) {
      return res.status(200).json({
        success: true,
        message: 'No search term provided',
        data: [],
      });
    }

    const users = await User.find({
      $or: [
        { firstName: { $regex: name, $options: 'i' } },
        { lastName: { $regex: name, $options: 'i' } },
        { email: { $regex: name, $options: 'i' } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .select('firstName lastName email phoneNumber createdAt accountStatus');

    const mapped = users.map((user) => ({
      id: user._id,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || '',
      mobileNumber: user.phoneNumber || '',
      profilePicture: '',
      Joined: user.createdAt ? user.createdAt.toISOString().slice(0, 10) : '',
      location: '',
      status: user.accountStatus === 'suspended' ? 'Inactive' : 'Active',
    }));

    res.status(200).json({
      success: true,
      message: 'Users search results',
      data: mapped,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatusForAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { accountStatus: status },
      { new: true, runValidators: true }
    ).select('firstName lastName email accountStatus');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User status updated',
      data: {
        id: updated._id,
        fullName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
        email: updated.email,
        status: updated.accountStatus === 'suspended' ? 'Inactive' : 'Active',
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
  updateMyWeight,
  generateMealPlan,
  getMealPlan,
  getProgress,
  getMealSwapAlternatives,
  swapMeal,
  getUsersForAdmin,
  searchUsersForAdmin,
  updateUserStatusForAdmin,
};
