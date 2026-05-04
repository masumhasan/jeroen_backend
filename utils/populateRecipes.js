const { Recipe } = require('../models/Recipe');
const { UserRecipe } = require('../models/UserRecipe');

/**
 * Populate recipe data for a week plan from BOTH the Recipe and UserRecipe
 * collections. Mongoose .populate() only targets one model, so any meals
 * referencing UserRecipe come back null. This does it manually.
 */
const populateWeekPlanRecipes = async (weekPlan) => {
  if (!Array.isArray(weekPlan)) return weekPlan;

  const plan = weekPlan.map((d) => (d.toObject ? d.toObject() : d));

  const allIds = new Set();
  for (const dayEntry of plan) {
    for (const meal of (dayEntry.meals || [])) {
      if (meal.recipe) {
        const id = typeof meal.recipe === 'object' && meal.recipe._id
          ? meal.recipe._id.toString()
          : meal.recipe.toString();
        allIds.add(id);
      }
    }
  }

  if (allIds.size === 0) return plan;

  const idArray = [...allIds];
  const [mainRecipes, userRecipes] = await Promise.all([
    Recipe.find({ _id: { $in: idArray } }).lean(),
    UserRecipe.find({ _id: { $in: idArray } }).lean(),
  ]);

  const lookup = new Map();
  for (const r of mainRecipes) lookup.set(r._id.toString(), r);
  for (const r of userRecipes) {
    const doc = { ...r, _isUserRecipe: true };
    lookup.set(r._id.toString(), doc);
  }

  for (const dayEntry of plan) {
    for (const meal of (dayEntry.meals || [])) {
      if (meal.recipe) {
        const id = typeof meal.recipe === 'object' && meal.recipe._id
          ? meal.recipe._id.toString()
          : meal.recipe.toString();
        meal.recipe = lookup.get(id) || null;
      }
    }
  }

  return plan;
};

module.exports = { populateWeekPlanRecipes };
