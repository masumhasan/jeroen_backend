const mongoose = require('mongoose');

const DEFAULT_IMAGE = 'https://raw.githubusercontent.com/masumhasan/jeroen_app/main/lunch.jpg';

const nutritionSchema = new mongoose.Schema({
  kcal: { type: Number, default: null },
  khd: { type: Number, default: null },
  vetten: { type: Number, default: null },
  eiwitten: { type: Number, default: null },
  vezels: { type: Number, default: null },
}, { _id: false });

const userRecipeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Recipe name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: {
      values: ['Ontbijt', 'Lunch', 'Diner', 'Snack', 'Dranken', 'Uncategorised'],
      message: '{VALUE} is not a valid category',
    },
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
  recipeImage: {
    type: String,
    default: DEFAULT_IMAGE,
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

userRecipeSchema.index({ name: 'text' });
userRecipeSchema.index({ category: 1 });
userRecipeSchema.index({ status: 1 });
userRecipeSchema.index({ submittedBy: 1 });

const UserRecipe = mongoose.model('UserRecipe', userRecipeSchema);

module.exports = { UserRecipe, DEFAULT_IMAGE };
