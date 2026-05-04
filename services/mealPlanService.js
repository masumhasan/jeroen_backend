const mongoose = require('mongoose');
const { Recipe } = require('../models/Recipe');
const { UserRecipe } = require('../models/UserRecipe');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');
const ShoppingList = require('../models/ShoppingList');
const { OpenAI } = require('openai');
const {
  normalizeIngredientText,
  isValidIngredientLine,
  isValidIngredientName
} = require('../utils/ingredientSanitizer');

let _openai;
const getOpenAIClient = () => {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
};

const CATEGORY_MAP = {
  'Breakfast': 'Ontbijt',
  'Lunch': 'Lunch',
  'Dinner': 'Diner',
  'Snack-1': 'Snack',
  'Snack-2': 'Snack',
  'Snack-3': 'Snack'
};

const ALL_MEAL_TYPES = ['Breakfast', 'Snack-1', 'Lunch', 'Snack-2', 'Dinner', 'Snack-3'];

const { populateWeekPlanRecipes } = require('../utils/populateRecipes');

const normalizeMealType = (mealType) => {
  if (!mealType || typeof mealType !== 'string') return null;
  const normalized = mealType.trim().toLowerCase();
  if (normalized === 'breakfast') return 'Breakfast';
  if (normalized === 'lunch') return 'Lunch';
  if (normalized === 'dinner') return 'Dinner';
  if (normalized === 'snack' || normalized === 'snack1' || normalized === 'snack-1') return 'Snack-1';
  if (normalized === 'snack2' || normalized === 'snack-2') return 'Snack-2';
  if (normalized === 'snack3' || normalized === 'snack-3') return 'Snack-3';
  return null;
};

const normalizePreferredMealTypes = (preferences = []) => {
  const normalized = (preferences || [])
    .map(normalizeMealType)
    .filter(Boolean);

  const deduped = [...new Set(normalized)];
  if (deduped.length > 0) return deduped;
  return ['Breakfast', 'Lunch', 'Dinner'];
};

const SHOPPING_CATEGORIES = [
  'Vegetables',
  'Meat & Fish',
  'Dairy',
  'Grains & Breads',
  'Spices'
];

const INGREDIENT_CATEGORY_KEYWORDS = {
  'Vegetables': [
    'potato', 'potatoes', 'sweet potato', 'onion', 'garlic', 'carrot', 'broccoli', 'asparagus', 'cucumber',
    'tomato', 'spinach', 'lettuce', 'kale', 'pepper', 'zucchini', 'aubergine', 'eggplant', 'mushroom',
    'cauliflower', 'cabbage', 'leek', 'celery', 'beet', 'radish', 'pumpkin', 'salad', 'avocado'
  ],
  'Meat & Fish': [
    'chicken', 'turkey', 'beef', 'pork', 'lamb', 'veal', 'duck', 'bacon', 'ham',
    'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'fish', 'egg', 'eggs'
  ],
  'Dairy': [
    'milk', 'cheese', 'yogurt', 'yoghurt', 'cream', 'butter', 'feta', 'mozzarella',
    'parmesan', 'ricotta', 'curd', 'kefir'
  ],
  'Grains & Breads': [
    'rice', 'bread', 'pasta', 'spaghetti', 'noodle', 'quinoa', 'oat', 'oats', 'flour',
    'couscous', 'barley', 'bulgur', 'tortilla', 'wrap', 'cracker', 'grain'
  ],
  'Spices': [
    'salt', 'pepper', 'paprika', 'cumin', 'turmeric', 'oregano', 'basil', 'thyme', 'rosemary',
    'coriander', 'chili', 'chilli', 'cinnamon', 'nutmeg', 'ginger', 'garam masala', 'spice', 'herb'
  ]
};

const UNIT_NORMALIZATION = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  gr: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  piece: 'pc',
  pieces: 'pc',
  pc: 'pc'
};

const convertToBaseUnit = (amount, unit) => {
  if (!unit) return { value: amount, unit: 'pc' };
  if (unit === 'kg') return { value: amount * 1000, unit: 'g' };
  if (unit === 'l') return { value: amount * 1000, unit: 'ml' };
  return { value: amount, unit };
};

const formatAmount = (value, unit) => {
  if (unit === 'g' && value >= 1000) {
    return `${(value / 1000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}kg`;
  }
  if (unit === 'ml' && value >= 1000) {
    return `${(value / 1000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}L`;
  }
  if (unit === 'pc') {
    return `${Math.round(value)}`;
  }
  return `${Number(value.toFixed(2)).toString()}${unit}`;
};

const parseIngredient = (ingredient) => {
  if (!ingredient || typeof ingredient !== 'string') return null;

  const text = normalizeIngredientText(ingredient);
  if (!text) return null;
  if (!isValidIngredientLine(text, 2)) return null;

  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s*(?:of\s+)?(.+)$/i);
  if (!match) {
    if (!isValidIngredientName(text, 2)) return null;
    return {
      name: text.toLowerCase(),
      displayName: text,
      amount: 1,
      unit: 'pc'
    };
  }

  const rawAmount = parseFloat(match[1].replace(',', '.'));
  const normalizedUnit = match[2] ? UNIT_NORMALIZATION[match[2].toLowerCase()] : 'pc';
  const ingredientName = normalizeIngredientText(match[3] || '');

  if (!ingredientName) {
    return {
      name: text.toLowerCase(),
      displayName: text,
      amount: Number.isNaN(rawAmount) ? 1 : rawAmount,
      unit: normalizedUnit || 'pc'
    };
  }
  if (!isValidIngredientName(ingredientName, 2)) return null;

  return {
    name: ingredientName.toLowerCase(),
    displayName: ingredientName,
    amount: Number.isNaN(rawAmount) ? 1 : rawAmount,
    unit: normalizedUnit || 'pc'
  };
};

const normalizeNameForDisplay = (name) => {
  const cleaned = name.trim();
  if (!cleaned) return cleaned;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const getIngredientCategory = (ingredientName) => {
  const normalized = ingredientName.toLowerCase();

  for (const category of SHOPPING_CATEGORIES) {
    const keywords = INGREDIENT_CATEGORY_KEYWORDS[category] || [];
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return 'Spices';
};

const buildWeeklyShoppingList = (recipes) => {
  const grouped = new Map();

  recipes.forEach((recipe) => {
    (recipe.ingredients || []).forEach((ingredientLine) => {
      const parsed = parseIngredient(ingredientLine);
      if (!parsed) return;
      if (!isValidIngredientName(parsed.name, 2)) return;

      const base = convertToBaseUnit(parsed.amount, parsed.unit);
      const key = `${parsed.name}__${base.unit}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.amount += base.value;
      } else {
        grouped.set(key, {
          name: normalizeNameForDisplay(parsed.displayName || parsed.name),
          normalizedName: parsed.name,
          unit: base.unit,
          amount: base.value
        });
      }
    });
  });

  const byCategory = new Map(SHOPPING_CATEGORIES.map((category) => [category, []]));

  for (const value of grouped.values()) {
    const category = getIngredientCategory(value.normalizedName);
    byCategory.get(category).push({
      name: value.name,
      amount: formatAmount(value.amount, value.unit)
    });
  }

  return SHOPPING_CATEGORIES.map((category) => {
    const items = byCategory.get(category)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { category, items };
  }).filter((entry) => entry.items.length > 0);
};

const enforceDailyMealsByPreference = (rawPlan, preferredMealTypes, recipes) => {
  const recipeIdsByCategory = {};
  Object.entries(CATEGORY_MAP).forEach(([mealType, category]) => {
    recipeIdsByCategory[mealType] = recipes
      .filter((recipe) => {
        const cats = Array.isArray(recipe.category) ? recipe.category : [recipe.category];
        return cats.includes(category);
      })
      .map((recipe) => recipe._id.toString());
  });

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return validDays.map((dayName, dayIndex) => {
    const aiDay = Array.isArray(rawPlan)
      ? rawPlan.find((d) => String(d.day || '').toLowerCase() === dayName.toLowerCase()) || rawPlan[dayIndex]
      : null;

    let aiMeals = aiDay?.meals;
    if (typeof aiMeals === 'string') {
      try {
        aiMeals = JSON.parse(aiMeals);
      } catch (error) {
        aiMeals = [];
      }
    }

    const aiByType = new Map();
    if (Array.isArray(aiMeals)) {
      aiMeals.forEach((meal) => {
        const mealType = normalizeMealType(meal?.mealType || meal?.type);
        const recipeId = meal?.recipeId || meal?.recipe;
        if (!mealType || !recipeId || !mongoose.Types.ObjectId.isValid(recipeId)) return;

        const allowedRecipeIds = recipeIdsByCategory[mealType] || [];
        const recipeIdString = recipeId.toString();
        if (!allowedRecipeIds.includes(recipeIdString)) return;

        if (!aiByType.has(mealType)) {
          aiByType.set(mealType, recipeIdString);
        }
      });
    }

    const usedInDay = new Set();
    const normalizedMeals = preferredMealTypes.map((mealType, preferredIndex) => {
      let recipeId = aiByType.get(mealType);
      const candidates = (recipeIdsByCategory[mealType] || []).filter((id) => !usedInDay.has(id));

      if (!recipeId) {
        if (candidates.length > 0) {
          recipeId = candidates[(dayIndex + preferredIndex) % candidates.length];
        } else {
          recipeId = (recipeIdsByCategory[mealType] || [])[0] || null;
        }
      }

      if (!recipeId) {
        return null;
      }

      usedInDay.add(recipeId);
      return {
        mealType,
        recipe: recipeId
      };
    }).filter(Boolean);

    return {
      day: dayName,
      meals: normalizedMeals
    };
  });
};

const ORDERED_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_NAME_TO_JS = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

/** Build a 7-day name list starting from the user's chosen weekStartDay. */
const orderedDayNames = (startDay = 'Monday') => {
  const idx = ORDERED_DAYS.indexOf(startDay);
  const start = idx >= 0 ? idx : 0;
  return [...ORDERED_DAYS.slice(start), ...ORDERED_DAYS.slice(0, start)];
};

/**
 * Compute the start-of-week calendar date.
 * – For a normal (re)generate: the most recent occurrence of weekStartDay
 *   that is <= today (i.e. the current week).
 * – For "next week": shift that date forward by 7 days.
 */
const computeWeekStartDate = (weekStartDay = 'Monday', nextWeek = false) => {
  const targetJS = DAY_NAME_TO_JS[weekStartDay] ?? 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayJS = today.getDay();
  let diff = todayJS - targetJS;
  if (diff < 0) diff += 7;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - diff);

  if (nextWeek) startDate.setDate(startDate.getDate() + 7);

  return startDate;
};

const generateWeeklyMealPlan = async (userId, { nextWeek = false } = {}) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  let weekStartDate;
  if (nextWeek) {
    // Compute from the latest stored week boundary so generation is truly additive
    const existingDoc = await MealPlan.findOne({ user: user._id });
    const latestStart = existingDoc?.nextWeekStartDate || existingDoc?.weekStartDate || null;
    if (latestStart) {
      weekStartDate = new Date(latestStart);
      weekStartDate.setDate(weekStartDate.getDate() + 7);
    } else {
      weekStartDate = computeWeekStartDate(user.weekStartDay, true);
    }
  } else {
    weekStartDate = computeWeekStartDate(user.weekStartDay, false);
  }

  const weekDays = orderedDayNames(user.weekStartDay);

  // Fetch all recipes summary
  const recipes = await Recipe.find({}, 'name category nutrition');
  
  const recipeList = recipes.map(r => ({
    id: r._id,
    name: r.name,
    category: r.category,
    calories: r.nutrition.kcal,
    protein: r.nutrition.eiwitten,
    carbs: r.nutrition.khd,
    fat: r.nutrition.vetten
  }));

  const userProfile = {
    goal: user.goal,
    dailyCalories: user.recommendedCalories,
    dailyProtein: user.recommendedProtein,
    dailyCarbs: user.recommendedCarbs,
    dailyFat: user.recommendedFat,
    preferences: user.mealPlanPreferences,
    restrictions: user.dietaryRestrictions,
    unwanted: user.unwantedIngredients,
    allergies: user.allergies
  };

  const prompt = `
    You are a professional nutritionist. Create a 7-day meal plan for a user with the following profile:
    - Goal: ${userProfile.goal}
    - Daily Target: ${userProfile.dailyCalories} kcal, ${userProfile.dailyProtein}g Protein, ${userProfile.dailyCarbs}g Carbs, ${userProfile.dailyFat}g Fat.
    - Meal Preferences: ${userProfile.preferences.join(', ')}
    - Dietary Restrictions: ${userProfile.restrictions.join(', ')}
    - Allergies (unwanted ingredients): ${userProfile.unwanted.join(', ')}
    - User Allergies: ${userProfile.allergies.join(', ')}

    Rules:
    1. For each day, you must select EXACTLY one recipe for each type in the user's "Meal Preferences".
    2. The number of meals per day MUST be exactly ${userProfile.preferences.length}.
    3. Use the following Category Mapping for selection:
       - "Breakfast" should select from "Ontbijt" recipes.
       - "Lunch" should select from "Lunch" recipes.
       - "Dinner" should select from "Diner" recipes.
       - "Snack-1", "Snack-2", "Snack-3" should select from "Snack" recipes.
    4. The sum of calories and macros for all meals in a single day should be close to the daily target (within 10-15% margin).
    5. Avoid repeating the same recipe within the same week if possible.
    6. Use ONLY the recipes provided in the list below.
    7. Provide the response in a JSON format.
    8. The week starts on ${weekDays[0]}. Order the days as: ${weekDays.join(', ')}.

    Recipe List:
    ${JSON.stringify(recipeList)}

    Expected JSON Format:
    {
      "plan": [
        {
          "day": "${weekDays[0]}",
          "meals": [
            { "mealType": "Breakfast", "recipeId": "RECIPE_ID_HERE" },
            { "mealType": "Lunch", "recipeId": "RECIPE_ID_HERE" },
            { "mealType": "Dinner", "recipeId": "RECIPE_ID_HERE" }
          ]
        },
        ... (7 days total, in the order above)
      ]
    }
    CRITICAL: Ensure "meals" is a valid JSON array of objects, NOT a string.
  `;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a nutrition expert who provides meal plans in JSON format.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);
  console.log('AI Meal Plan Result:', JSON.stringify(result, null, 2));
  
  if (!result.plan || !Array.isArray(result.plan)) {
    throw new Error('Invalid meal plan format received from AI');
  }

  // Update user's meal plan
  try {
    const preferredMealTypes = normalizePreferredMealTypes(userProfile.preferences);
    const normalizedMealPlan = enforceDailyMealsByPreference(result.plan, preferredMealTypes, recipes);

    const recipeIds = [];
    normalizedMealPlan.forEach((day) => {
      day.meals.forEach((meal) => {
        if (meal.recipe) recipeIds.push(meal.recipe);
      });
    });

    const uniqueRecipeIds = [...new Set(recipeIds.map((id) => id.toString()))];
    const planRecipes = uniqueRecipeIds.length > 0
      ? await Recipe.find({ _id: { $in: uniqueRecipeIds } }, 'ingredients')
      : [];

    const normalizedShoppingList = buildWeeklyShoppingList(planRecipes);

    if (nextWeek) {
      // If a next-week plan already exists, promote it to current week first
      const existingDoc = await MealPlan.findOne({ user: user._id });
      const hadPreviousNextWeek = existingDoc?.nextWeekPlan?.length > 0;

      if (hadPreviousNextWeek) {
        const promotedStart = existingDoc.nextWeekStartDate;
        const promotedPlan = existingDoc.nextWeekPlan;
        await MealPlan.findOneAndUpdate(
          { user: user._id },
          {
            $set: {
              weekPlan: promotedPlan,
              weekStartDate: promotedStart,
              nextWeekPlan: normalizedMealPlan,
              nextWeekStartDate: weekStartDate,
            }
          }
        );
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              weeklyMealPlan: promotedPlan,
              mealPlanStartDate: promotedStart,
              nextWeekMealPlan: normalizedMealPlan,
              nextWeekStartDate: weekStartDate,
            },
          }
        );
      } else {
        await MealPlan.findOneAndUpdate(
          { user: user._id },
          {
            $set: {
              nextWeekPlan: normalizedMealPlan,
              nextWeekStartDate: weekStartDate,
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              nextWeekMealPlan: normalizedMealPlan,
              nextWeekStartDate: weekStartDate,
            },
          }
        );
      }
    } else {
      // Regular (re)generation — replaces current week and clears any next-week data
      await MealPlan.findOneAndUpdate(
        { user: user._id },
        {
          $set: {
            weekPlan: normalizedMealPlan,
            weekStartDate,
            nextWeekPlan: [],
            nextWeekStartDate: null,
            generatedAt: new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            weeklyMealPlan: normalizedMealPlan,
            weeklyShoppingList: normalizedShoppingList,
            mealPlanStartDate: weekStartDate,
            nextWeekMealPlan: [],
            nextWeekStartDate: null,
          },
        }
      );
    }

    await ShoppingList.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          weeklyItems: normalizedShoppingList,
          generatedAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mealPlanDoc = await MealPlan.findOne({ user: user._id });

    const populatedWeekPlan = await populateWeekPlanRecipes(mealPlanDoc?.weekPlan || normalizedMealPlan);
    const populatedNextWeekPlan = await populateWeekPlanRecipes(mealPlanDoc?.nextWeekPlan || []);

    return {
      plan: populatedWeekPlan,
      nextWeekPlan: populatedNextWeekPlan,
      weekStartDate: mealPlanDoc?.weekStartDate || weekStartDate,
      nextWeekStartDate: mealPlanDoc?.nextWeekStartDate || null,
    };
  } catch (err) {
    console.error('Error processing or saving meal plan:', err);
    throw err;
  }
};

const getMealSwapAlternatives = async (userId, options = {}) => {
  const {
    day,
    mealType,
    recipeId,
    search = '',
    sort = 'calories',
    calorieFilter = 'all'
  } = options;

  const normalizedMealType = normalizeMealType(mealType);
  if (!day || !normalizedMealType) {
    const error = new Error('day and mealType are required');
    error.statusCode = 400;
    throw error;
  }

  const mealPlanDoc = await MealPlan.findOne({ user: userId }).populate({
    path: 'weekPlan.meals.recipe',
    model: 'Recipe'
  });
  if (!mealPlanDoc) {
    const error = new Error('Meal plan not found');
    error.statusCode = 404;
    throw error;
  }

  const dayEntry = (mealPlanDoc.weekPlan || []).find(
    (entry) => String(entry.day || '').toLowerCase() === String(day).toLowerCase()
  );
  if (!dayEntry) {
    const error = new Error('Day not found in meal plan');
    error.statusCode = 404;
    throw error;
  }

  const mealEntry = (dayEntry.meals || []).find(
    (meal) => normalizeMealType(meal.mealType) === normalizedMealType
  );
  if (!mealEntry?.recipe) {
    const error = new Error('Current meal not found');
    error.statusCode = 404;
    throw error;
  }

  const currentRecipe = mealEntry.recipe;
  const currentRecipeId = recipeId || currentRecipe._id?.toString();
  const currentCalories = Number(currentRecipe.nutrition?.kcal || 0);
  const targetCategory = CATEGORY_MAP[normalizedMealType];

  const query = {
    category: { $in: [targetCategory] },
    _id: { $ne: currentRecipeId },
    'nutrition.kcal': {
      $gte: Math.max(0, currentCalories - 100),
      $lte: currentCalories + 100
    }
  };

  if (search && String(search).trim()) {
    query.name = { $regex: String(search).trim(), $options: 'i' };
  }

  let alternatives = await Recipe.find(
    query,
    'name category nutrition recipeImage personsServing'
  ).lean();

  alternatives = alternatives.filter((recipe) => {
    const kcal = Number(recipe?.nutrition?.kcal || 0);
    if (calorieFilter === '<400') return kcal < 400;
    if (calorieFilter === '400-550') return kcal >= 400 && kcal <= 550;
    if (calorieFilter === '>550') return kcal > 550;
    return true;
  });

  alternatives.sort((a, b) => {
    if (sort === 'protein') {
      return Number(b?.nutrition?.eiwitten || 0) - Number(a?.nutrition?.eiwitten || 0);
    }
    if (sort === 'name') {
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    }
    return Number(a?.nutrition?.kcal || 0) - Number(b?.nutrition?.kcal || 0);
  });

  return {
    currentMeal: currentRecipe,
    alternatives
  };
};

const swapMealInPlan = async (userId, payload = {}) => {
  const { day, mealType, newRecipeId, currentRecipeId } = payload;
  const normalizedMealType = normalizeMealType(mealType);
  if (!day || !normalizedMealType || !newRecipeId) {
    const error = new Error('day, mealType and newRecipeId are required');
    error.statusCode = 400;
    throw error;
  }
  if (!mongoose.Types.ObjectId.isValid(newRecipeId)) {
    const error = new Error('Invalid newRecipeId');
    error.statusCode = 400;
    throw error;
  }

  let replacementRecipe = await Recipe.findById(newRecipeId, 'category');
  let isUserRecipe = false;
  if (!replacementRecipe) {
    replacementRecipe = await UserRecipe.findById(newRecipeId, 'category submittedBy');
    if (!replacementRecipe) {
      const error = new Error('Replacement recipe not found');
      error.statusCode = 404;
      throw error;
    }
    isUserRecipe = true;
  }

  const expectedCategory = CATEGORY_MAP[normalizedMealType];
  const replacementCategories = Array.isArray(replacementRecipe.category)
    ? replacementRecipe.category
    : [replacementRecipe.category];
  if (!replacementCategories.includes(expectedCategory)) {
    const error = new Error('Replacement meal must match meal type category');
    error.statusCode = 400;
    throw error;
  }

  const mealPlanDoc = await MealPlan.findOne({ user: userId });
  if (!mealPlanDoc) {
    const error = new Error('Meal plan not found');
    error.statusCode = 404;
    throw error;
  }

  const dayIndex = (mealPlanDoc.weekPlan || []).findIndex(
    (entry) => String(entry.day || '').toLowerCase() === String(day).toLowerCase()
  );
  if (dayIndex < 0) {
    const error = new Error('Day not found in meal plan');
    error.statusCode = 404;
    throw error;
  }

  const meals = mealPlanDoc.weekPlan[dayIndex].meals || [];
  const mealIndex = meals.findIndex(
    (entry) => normalizeMealType(entry.mealType) === normalizedMealType
  );
  if (mealIndex < 0) {
    const error = new Error('Meal not found in selected day');
    error.statusCode = 404;
    throw error;
  }

  if (
    currentRecipeId &&
    String(meals[mealIndex].recipe) !== String(currentRecipeId)
  ) {
    const error = new Error('Meal has changed. Refresh and try again.');
    error.statusCode = 409;
    throw error;
  }

  meals[mealIndex].recipe = newRecipeId;
  mealPlanDoc.markModified('weekPlan');
  await mealPlanDoc.save();

  const recipeIds = [];
  (mealPlanDoc.weekPlan || []).forEach((dayEntry) => {
    (dayEntry.meals || []).forEach((mealEntry) => {
      if (mealEntry.recipe) recipeIds.push(mealEntry.recipe.toString());
    });
  });
  const uniqueRecipeIds = [...new Set(recipeIds)];
  const [mainRecipes, userRecipes] = uniqueRecipeIds.length > 0
    ? await Promise.all([
        Recipe.find({ _id: { $in: uniqueRecipeIds } }, 'ingredients'),
        UserRecipe.find({ _id: { $in: uniqueRecipeIds } }, 'ingredients'),
      ])
    : [[], []];
  const planRecipes = [...mainRecipes, ...userRecipes];
  const normalizedShoppingList = buildWeeklyShoppingList(planRecipes);

  await ShoppingList.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        weeklyItems: normalizedShoppingList,
        generatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        weeklyMealPlan: mealPlanDoc.weekPlan,
        weeklyShoppingList: normalizedShoppingList,
      },
    }
  );

  const updatedPlanDoc = await MealPlan.findOne({ user: userId });
  const populatedPlan = await populateWeekPlanRecipes(
    updatedPlanDoc?.weekPlan || mealPlanDoc.weekPlan
  );

  return {
    plan: populatedPlan,
    shoppingList: normalizedShoppingList
  };
};

module.exports = {
  generateWeeklyMealPlan,
  getMealSwapAlternatives,
  swapMealInPlan
};
