const express = require('express');
const { UserRecipe } = require('../models/UserRecipe');
const upload = require('../config/multer');
const { sanitizeIngredientList } = require('../utils/ingredientSanitizer');
const { protect } = require('../middleware/authMiddleware');
const { requireDashboardAccess } = require('../middleware/dashboardAuthMiddleware');

const router = express.Router();

// GET all user recipes (dashboard - admin view with filters)
router.get('/', async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: escaped, $options: 'i' };
    }
    if (category && category !== 'All') {
      query.category = { $in: [category] };
    }
    if (status && status !== 'All') {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [recipes, totalResults] = await Promise.all([
      UserRecipe.find(query)
        .populate('submittedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UserRecipe.countDocuments(query),
    ]);

    res.json({
      recipes,
      totalPages: Math.ceil(totalResults / Number(limit)),
      currentPage: Number(page),
      totalResults,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET approved user recipes (for the app - anyone can see approved ones)
router.get('/approved', async (req, res) => {
  try {
    const { search, category, page = 1, limit = 10 } = req.query;
    const query = { status: 'approved' };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: escaped, $options: 'i' };
    }
    if (category && category !== 'All') {
      query.category = { $in: [category] };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [recipes, totalResults] = await Promise.all([
      UserRecipe.find(query)
        .populate('submittedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UserRecipe.countDocuments(query),
    ]);

    res.json({ recipes, totalPages: Math.ceil(totalResults / Number(limit)), currentPage: Number(page), totalResults });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET user's own submitted recipes
router.get('/my', protect, async (req, res) => {
  try {
    const filter = { submittedBy: req.user._id };
    const unreadFilter = {
      ...filter,
      status: 'declined',
      rejectionFeedback: { $nin: [null, ''] },
      rejectionFeedbackReadAt: null,
      rejectionFeedbackDismissedAt: null,
    };

    const [recipes, unreadFeedbackCount] = await Promise.all([
      UserRecipe.find(filter)
        .sort({ createdAt: -1 })
        .lean(),
      UserRecipe.countDocuments(unreadFilter),
    ]);

    res.json({ recipes, unreadFeedbackCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH mark all recipe rejection feedback as read for the current user
router.patch('/my/feedback/read', protect, async (req, res) => {
  try {
    const filter = {
      submittedBy: req.user._id,
      status: 'declined',
      rejectionFeedback: { $nin: [null, ''] },
      rejectionFeedbackReadAt: null,
      rejectionFeedbackDismissedAt: null,
    };

    const result = await UserRecipe.updateMany(filter, {
      $set: { rejectionFeedbackReadAt: new Date() },
    });

    res.json({
      message: 'Feedback marked as read',
      updatedCount: result.modifiedCount || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH dismiss specific recipe rejection feedback
router.patch('/my/feedback/:id/dismiss', protect, async (req, res) => {
  try {
    const recipe = await UserRecipe.findOneAndUpdate(
      { _id: req.params.id, submittedBy: req.user._id },
      { $set: { rejectionFeedbackDismissedAt: new Date() } },
      { new: true }
    );

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found or not yours' });
    }

    res.json({ message: 'Feedback dismissed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single user recipe
router.get('/:id', async (req, res) => {
  try {
    const recipe = await UserRecipe.findById(req.params.id)
      .populate('submittedBy', 'firstName lastName email')
      .lean();
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a user recipe (authenticated users)
router.post('/', protect, upload.single('recipe_image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    data.ingredients = sanitizeIngredientList(data.ingredients, 2);
    if (data.ingredients.length === 0) {
      return res.status(400).json({ message: 'At least one valid ingredient is required' });
    }
    if (req.file) {
      data.recipeImage = req.file.location;
    }
    data.submittedBy = req.user._id;
    data.status = 'pending';
    data.rejectionFeedback = null;
    data.rejectionFeedbackReadAt = null;

    const recipe = await UserRecipe.create(data);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update own user recipe (resets status to pending if previously approved/declined)
router.put('/:id', protect, upload.single('recipe_image'), async (req, res) => {
  try {
    const existing = await UserRecipe.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Recipe not found' });
    if (String(existing.submittedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only edit your own recipes' });
    }

    const data = JSON.parse(req.body.data);
    if (Array.isArray(data.ingredients)) {
      data.ingredients = sanitizeIngredientList(data.ingredients, 2);
      if (data.ingredients.length === 0) {
        return res.status(400).json({ message: 'At least one valid ingredient is required' });
      }
    }
    if (req.file) {
      data.recipeImage = req.file.location;
    }
    delete data.submittedBy;
    data.status = 'pending';
    data.rejectionFeedback = null;
    data.rejectionFeedbackReadAt = null;

    const recipe = await UserRecipe.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    res.json(recipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE own user recipe
router.delete('/:id', protect, async (req, res) => {
  try {
    const existing = await UserRecipe.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Recipe not found' });

    const isOwner = String(existing.submittedBy) === String(req.user._id);
    const isAdmin = ['admin', 'superadmin', 'moderator'].includes(
      (req.user.role || '').toLowerCase()
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this recipe' });
    }

    await UserRecipe.findByIdAndDelete(req.params.id);
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH approve a user recipe (admin only)
router.patch('/:id/approve', protect, requireDashboardAccess, async (req, res) => {
  try {
    const recipe = await UserRecipe.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', rejectionFeedback: null, rejectionFeedbackReadAt: null },
      { new: true }
    ).populate('submittedBy', 'firstName lastName email');
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH decline a user recipe (admin only)
router.patch('/:id/decline', protect, requireDashboardAccess, async (req, res) => {
  try {
    const rejectionFeedback = String(
      req.body?.rejectionFeedback ?? req.body?.feedback ?? ''
    ).trim();

    if (!rejectionFeedback) {
      return res.status(400).json({ message: 'Reject feedback is required' });
    }

    const recipe = await UserRecipe.findByIdAndUpdate(
      req.params.id,
      {
        status: 'declined',
        rejectionFeedback,
        rejectionFeedbackReadAt: null,
      },
      { new: true }
    ).populate('submittedBy', 'firstName lastName email');
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
