const express = require('express');
const { Recipe } = require('../models/Recipe');
const upload = require('../config/multer');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { search, category, book, page = 1, limit = 10 } = req.query;
    const query = {};

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: escaped, $options: 'i' };
    }
    if (category && category !== 'All') {
      query.category = category;
    }
    if (book) {
      query.book = Number(book);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = { book: 1, number: 1 };

    const [recipes, totalResults] = await Promise.all([
      Recipe.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Recipe.countDocuments(query),
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

router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).lean();
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', upload.single('recipe_image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    if (req.file) {
      data.recipeImage = `/uploads/${req.file.filename}`;
    }
    const recipe = await Recipe.create(data);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', upload.single('recipe_image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    if (req.file) {
      data.recipeImage = `/uploads/${req.file.filename}`;
    }
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
