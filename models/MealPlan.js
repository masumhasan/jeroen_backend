const mongoose = require('mongoose');

const mealEntrySchema = new mongoose.Schema(
  {
    mealType: {
      type: String,
      required: true,
      enum: ['Breakfast', 'Snack-1', 'Lunch', 'Snack-2', 'Dinner', 'Snack-3']
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
      required: true
    }
  },
  { _id: false }
);

const dayPlanSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    meals: {
      type: [mealEntrySchema],
      default: []
    }
  },
  { _id: false }
);

const mealPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    weekPlan: {
      type: [dayPlanSchema],
      default: []
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MealPlan', mealPlanSchema);
