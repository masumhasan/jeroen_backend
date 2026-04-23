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
    targetWeight: {
      type: Number, // in kg
    },
    // Meal Plan Preferences
    mealPlanPreferences: {
      type: [String],
      enum: ['Breakfast', 'Snack-1', 'Lunch', 'Snack-2', 'Dinner', 'Snack-3'],
      default: [],
    },
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
