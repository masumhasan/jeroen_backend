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
    const recipes = await UserRecipe.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ recipes });
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
      data.recipeImage = `/uploads/${req.file.filename}`;
    }
    data.submittedBy = req.user._id;
    data.status = 'pending';

    const recipe = await UserRecipe.create(data);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update own user recipe (only if still pending)
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
      data.recipeImage = `/uploads/${req.file.filename}`;
    }
    delete data.submittedBy;
    delete data.status;

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
      { status: 'approved' },
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
    const recipe = await UserRecipe.findByIdAndUpdate(
      req.params.id,
      { status: 'declined' },
      { new: true }
    ).populate('submittedBy', 'firstName lastName email');
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
