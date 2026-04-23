const { z } = require('zod');

const signupSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().min(8, 'Phone number is too short'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  age: z.number().min(0).max(120).optional(),
  height: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  activityLevel: z.enum(['Sedentary', 'Moderate', 'Active', 'Very Active']).optional(),
  goal: z.enum(['Weight Loss', 'Weight Gain', 'Muscle Gain', 'Maintenance']).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  unwantedIngredients: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  targetWeight: z.number().min(0).optional(),
  mealPlanPreferences: z.array(z.enum(['Breakfast', 'Snack-1', 'Lunch', 'Snack-2', 'Dinner', 'Snack-3'])).optional(),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  signupSchema,
  signinSchema,
};
