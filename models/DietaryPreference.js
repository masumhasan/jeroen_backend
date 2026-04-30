const mongoose = require('mongoose');

const dietaryPreferenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Dietary preference name is required'],
      trim: true,
      unique: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

dietaryPreferenceSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('DietaryPreference', dietaryPreferenceSchema);
