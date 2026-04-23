const mongoose = require('mongoose');

const shoppingItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: String,
      required: true,
      trim: true
    },
    checked: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const shoppingCategorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ['Vegetables', 'Meat & Fish', 'Dairy', 'Grains & Breads', 'Spices']
    },
    items: {
      type: [shoppingItemSchema],
      default: []
    }
  },
  { _id: false }
);

const shoppingListSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    weeklyItems: {
      type: [shoppingCategorySchema],
      default: []
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShoppingList', shoppingListSchema);
