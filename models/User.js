const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    // Personal Info
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    age: {
      type: Number,
    },
    height: {
      type: Number, // in cm
    },
    weight: {
      type: Number, // in kg
    },
    startWeight: {
      type: Number, // first recorded weight in kg
      min: [0, 'Start weight cannot be negative'],
    },
    currentWeight: {
      type: Number, // latest recorded weight in kg
      min: [0, 'Current weight cannot be negative'],
    },
    weightHistory: [
      {
        weight: {
          type: Number,
          required: true,
          min: [0, 'Weight cannot be negative'],
        },
        recordedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Activity Level
    activityLevel: {
      type: String,
      enum: ['Sedentary', 'Moderate', 'Active', 'Very Active'],
    },
    // Goal
    goal: {
      type: String,
      enum: ['Weight Loss', 'Weight Gain', 'Muscle Gain', 'Maintenance'],
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    /** App signups default to `user`. Dashboard staff: moderator, admin, superadmin. */
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin', 'superadmin'],
      default: 'user',
      index: true,
    },
    // Dietary Preferences
    dietaryRestrictions: {
      type: [String],
      default: [],
    },
    unwantedIngredients: {
      type: [String],
      default: [],
    },
    allergies: {
      type: [String],
      default: [],
    },
    followedTopics: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Topic',
      default: [],
    },
    targetWeight: {
      type: Number, // in kg
    },
    /** Which day the user's weekly meal plan starts on (default Monday). */
    weekStartDay: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: 'Monday',
    },
    // Meal Plan Preferences
    mealPlanPreferences: {
      type: [String],
      enum: ['Breakfast', 'Snack-1', 'Lunch', 'Snack-2', 'Dinner', 'Snack-3'],
      default: [],
    },
    // Recommendations (AI Generated)
    recommendedCalories: {
      type: Number,
      default: 2000
    },
    recommendedProtein: {
      type: Number, // in grams
      default: 150
    },
    recommendedCarbs: {
      type: Number, // in grams
      default: 250
    },
    recommendedFat: {
      type: Number, // in grams
      default: 70
    },
    /** Snapshot from last AI recommendation (signup / profile-driven regen); "Recommended" on target screen. */
    aiBaselineCalories: { type: Number },
    aiBaselineProteinG: { type: Number },
    aiBaselineCarbsG: { type: Number },
    aiBaselineFatG: { type: Number },
    /** The calendar date the current weekly meal plan starts from. */
    mealPlanStartDate: {
      type: Date,
    },
    // Weekly Meal Plan
    weeklyMealPlan: [
      {
        day: String,
        meals: [
          {
            mealType: String,
            recipe: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Recipe',
            },
          },
        ],
      },
    ],
    // Next Week Meal Plan (populated when "Generate Next Week" is used)
    nextWeekMealPlan: [
      {
        day: String,
        meals: [
          {
            mealType: String,
            recipe: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Recipe',
            },
          },
        ],
      },
    ],
    nextWeekStartDate: {
      type: Date,
    },
    weeklyShoppingList: [
      {
        category: String,
        items: [
          {
            name: String,
            amount: String,
            checked: { type: Boolean, default: false }
          }
        ]
      }
    ],
    favouriteRecipes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
    }],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
