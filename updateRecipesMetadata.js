const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { Recipe } = require('./models/Recipe');
const { getBookMetadata } = require('./utils/bookMetadata');

dotenv.config();

async function updateExistingRecipes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const recipes = await Recipe.find({
      $or: [
        { bookTitle: { $exists: false } },
        { bookSku: { $exists: false } }
      ]
    });

    console.log(`Found ${recipes.length} recipes to update`);

    for (const recipe of recipes) {
      const metadata = getBookMetadata(recipe.book);
      recipe.bookTitle = metadata.title;
      recipe.bookSku = metadata.sku;
      await recipe.save();
      console.log(`Updated recipe ${recipe.number} in book ${recipe.book}`);
    }

    console.log('Finished updating recipes');
    process.exit(0);
  } catch (err) {
    console.error('Error updating recipes:', err);
    process.exit(1);
  }
}

updateExistingRecipes();
