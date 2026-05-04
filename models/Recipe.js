const mongoose = require('mongoose');

const DEFAULT_IMAGE = 'https://raw.githubusercontent.com/masumhasan/jeroen_app/main/lunch.jpg';

const nutritionSchema = new mongoose.Schema({
  kcal: { type: Number, default: null },
  khd: { type: Number, default: null },
  vetten: { type: Number, default: null },
  eiwitten: { type: Number, default: null },
  vezels: { type: Number, default: null },
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: [true, 'Recipe number is required'],
  },
  name: {
    type: String,
    required: [true, 'Recipe name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
  },
  category: {
    type: [String],
    required: [true, 'Category is required'],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'At least one category is required',
    },
    set: (v) => {
      if (typeof v === 'string') return [v];
      return v;
    },
    enum: ['Ontbijt', 'Lunch', 'Diner', 'Snack', 'Dranken', 'Uncategorised'],
  },
  recipeDetails: {
    type: [String],
    default: [],
  },
  ingredients: {
    type: [String],
    required: [true, 'Ingredients are required'],
    validate: {
      validator: (v) => v.length > 0,
      message: 'At least one ingredient is required',
    },
  },
  cookingTip: {
    type: String,
    trim: true,
    default: null,
  },
  personsServing: {
    type: Number,
    default: null,
    min: [0, 'Servings cannot be negative'],
  },
  nutrition: {
    type: nutritionSchema,
    default: () => ({}),
  },
  book: {
    type: Number,
    required: [true, 'Book number is required'],
    min: 1,
  },
  recipeImage: {
    type: String,
    default: DEFAULT_IMAGE,
  },
}, {
  timestamps: true,
});

recipeSchema.index({ name: 'text' });
recipeSchema.index({ category: 1 });
recipeSchema.index({ book: 1 });
recipeSchema.index({ book: 1, number: 1 }, { unique: true });

const Recipe = mongoose.model('Recipe', recipeSchema);

module.exports = { Recipe, DEFAULT_IMAGE };
