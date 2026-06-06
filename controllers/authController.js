const path = require('path');
const fs = require('fs');
const authService = require('../services/authService');
const mealPlanService = require('../services/mealPlanService');
const shopifyService = require('../services/shopifyService');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');
const {
  signupSchema,
  signinSchema,
  signupAvailabilitySchema,
} = require('../validators/authValidator');

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

/** Before onboarding: validate email/phone format and duplicate accounts. */
const checkSignupAvailability = async (req, res, next) => {
  try {
    const { email, phoneNumber } = signupAvailabilitySchema.parse(req.body);
    const normEmail = email.trim().toLowerCase();
    const normPhone = phoneNumber.trim();
    const result = await authService.checkSignupAvailability({
      email: normEmail,
      phoneNumber: normPhone,
    });
    if (!result.available) {
      let message = 'This email or phone number is already registered.';
      if (result.emailTaken && result.phoneTaken) {
        message = 'An account with this email and phone number already exists.';
      } else if (result.emailTaken) {
        message = 'An account with this email already exists.';
      } else if (result.phoneTaken) {
        message = 'An account with this phone number already exists.';
      }
      return res.status(409).json({
        status: 'fail',
        message,
        emailTaken: result.emailTaken,
        phoneTaken: result.phoneTaken,
      });
    }
    res.status(200).json({
      status: 'success',
      data: { available: true },
    });
  } catch (error) {
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

/** Same as signin but rejects accounts that may not use the dashboard (mobile `user` role). */
const dashboardSignin = async (req, res, next) => {
  try {
    const validatedData = signinSchema.parse(req.body);
    const result = await authService.loginUser(validatedData.email, validatedData.password);
    const role = (result.user.role || 'user').toLowerCase();
    if (!['moderator', 'admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        status: 'error',
        message: 'This account is not allowed to access the dashboard.',
      });
    }
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

const uploadAvatar = async (req, res, next) => {
  try {
    console.log('[uploadAvatar] content-type:', req.headers['content-type']);
    console.log('[uploadAvatar] req.file:', req.file);
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'No image file provided' });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // Delete previous avatar file if it was an uploaded one
    const oldAvatar = req.user.avatar;
    if (oldAvatar && oldAvatar.startsWith('/uploads/avatars/')) {
      const oldFilePath = path.join(__dirname, '..', oldAvatar);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarPath },
      { new: true }
    );

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser, avatarPath },
    });
  } catch (error) {
    next(error);
  }
};

const generateMealPlan = async (req, res, next) => {
  try {
    const nextWeek = req.body.nextWeek === true;
    const result = await mealPlanService.generateWeeklyMealPlan(req.user._id, { nextWeek });
    const user = await authService.getUserWithPlan(req.user._id);
    res.status(200).json({
      status: 'success',
      data: { 
        plan: result.plan,
        nextWeekPlan: result.nextWeekPlan,
        targetCalories: req.user.recommendedCalories,
        weekStartDay: user.weekStartDay || 'Monday',
        mealPlanStartDate: result.weekStartDate || user.mealPlanStartDate || null,
        nextWeekStartDate: result.nextWeekStartDate || null,
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
        nextWeekPlan: user.nextWeekMealPlan || [],
        targetCalories: user.recommendedCalories,
        weekStartDay: user.weekStartDay || 'Monday',
        mealPlanStartDate: user.mealPlanStartDate || null,
        nextWeekStartDate: user.nextWeekStartDate || null,
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

const claimBooks = async (req, res, next) => {
  try {
    const skus = await shopifyService.getBookSkusByEmail(req.user.email);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { purchasedBooks: skus },
      { new: true }
    );
    res.status(200).json({
      status: 'success',
      data: { purchasedBooks: user.purchasedBooks },
    });
  } catch (err) {
    next(err);
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
      .select('firstName lastName email phoneNumber createdAt accountStatus role avatar');

    const mapped = users.map((user) => ({
      id: user._id,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || '',
      mobileNumber: user.phoneNumber || '',
      profilePicture: user.avatar || '',
      Joined: user.createdAt ? user.createdAt.toISOString().slice(0, 10) : '',
      location: '',
      status: user.accountStatus === 'suspended' ? 'Inactive' : 'Active',
      role: user.role || 'user',
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
      .select('firstName lastName email phoneNumber createdAt accountStatus role avatar');

    const mapped = users.map((user) => ({
      id: user._id,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email || '',
      mobileNumber: user.phoneNumber || '',
      profilePicture: user.avatar || '',
      Joined: user.createdAt ? user.createdAt.toISOString().slice(0, 10) : '',
      location: '',
      status: user.accountStatus === 'suspended' ? 'Inactive' : 'Active',
      role: user.role || 'user',
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

const updateUserRoleForAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const role = String(req.body.role || '').toLowerCase();
    const updated = await authService.updateUserRole(req.user, userId, role);
    res.status(200).json({
      success: true,
      message: 'User role updated',
      data: {
        id: updated._id,
        role: updated.role,
        fullName: `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Dashboard staff may delete users; cannot delete self. Role rules mirror dashboard UX. */
const deleteUserForAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const actorId = String(req.user._id);
    if (String(userId) === actorId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    const target = await User.findById(userId).select('_id role firstName lastName email');
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const actorRole = String(req.user.role || 'user').toLowerCase();
    const targetRole = String(target.role || 'user').toLowerCase();

    if (actorRole === 'moderator') {
      if (targetRole !== 'user') {
        return res.status(403).json({
          success: false,
          message: 'Moderators may only delete accounts with the user role',
        });
      }
    } else if (actorRole === 'admin') {
      if (targetRole === 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete a superadmin account',
        });
      }
    } else if (actorRole !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const fullName = `${target.firstName || ''} ${target.lastName || ''}`.trim();
    await User.deleteOne({ _id: target._id });

    res.status(200).json({
      success: true,
      message: 'User deleted',
      data: { id: target._id, fullName, email: target.email },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  checkSignupAvailability,
  signin,
  dashboardSignin,
  getMe,
  updateMe,
  updateMyWeight,
  uploadAvatar,
  claimBooks,
  generateMealPlan,
  getMealPlan,
  getProgress,
  getMealSwapAlternatives,
  swapMeal,
  getUsersForAdmin,
  searchUsersForAdmin,
  updateUserRoleForAdmin,
  deleteUserForAdmin,
};
