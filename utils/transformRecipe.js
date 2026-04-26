const { DEFAULT_IMAGE } = require('../models/Recipe');
const { sanitizeIngredientList } = require('./ingredientSanitizer');

/**
 * Safely parses a numeric string that may use commas as decimal separators.
 * Returns null if the value is null, undefined, or unparseable.
 */
function safeParseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Transforms a raw JSON recipe object into the schema-compliant format.
 * @param {object} raw - Raw recipe from JSON file
 * @param {number} bookNumber - Source book identifier
 * @returns {object} Transformed recipe ready for Mongoose
 */
function transformRecipe(raw, bookNumber) {
  return {
    number: raw.Number,
    name: (raw.Name || '').trim(),
    category: mapCategory(raw.Category),
    recipeDetails: Array.isArray(raw.Recipe_Details) ? raw.Recipe_Details : [],
    ingredients: sanitizeIngredientList(raw.Ingredients, 2),
    cookingTip: raw.Cooking_TIP || null,
    personsServing: safeParseNumber(raw.Persons_Serving),
    nutrition: {
      kcal: safeParseNumber(raw.KCAL),
      khd: safeParseNumber(raw.KHD),
      vetten: safeParseNumber(raw.VETTEN),
      eiwitten: safeParseNumber(raw.EIWITTEN),
      vezels: safeParseNumber(raw.VEZELS),
    },
    book: bookNumber,
    recipeImage: DEFAULT_IMAGE,
  };
}

/**
 * Maps raw category strings to valid enum values.
 * Falls back to 'Uncategorised' for unknown categories.
 */
function mapCategory(rawCategory) {
  const valid = ['Ontbijt', 'Lunch', 'Diner', 'Snack', 'Dranken'];
  if (!rawCategory) return 'Uncategorised';
  const trimmed = rawCategory.trim();
  const match = valid.find((v) => v.toLowerCase() === trimmed.toLowerCase());
  return match || 'Uncategorised';
}

module.exports = { transformRecipe, safeParseNumber };
