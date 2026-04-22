const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Recipe } = require('../models/Recipe');
const { transformRecipe } = require('../utils/transformRecipe');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

const BOOK_FILES = [
  { file: 'lisa_book1.json', book: 1 },
  { file: 'lisa_book2.json', book: 2 },
  { file: 'lisa_book4.json', book: 4 },
  { file: 'lisa_book5.json', book: 5 },
  { file: 'lisa_book6.json', book: 6 },
  { file: 'lisa_book7.json', book: 7 },
];

const DATA_DIR = path.resolve(__dirname, '../../jeroen_im');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function importBook(fileName, bookNumber) {
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ File not found: ${filePath}`);
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const rawRecipes = loadJsonFile(filePath);
  console.log(`  Found ${rawRecipes.length} recipes in ${fileName}`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rawRecipes.length; i += BATCH_SIZE) {
    const batch = rawRecipes.slice(i, i + BATCH_SIZE);
    const operations = batch.map((raw) => {
      const transformed = transformRecipe(raw, bookNumber);
      return {
        updateOne: {
          filter: { book: bookNumber, number: transformed.number },
          update: { $setOnInsert: transformed },
          upsert: true,
        },
      };
    });

    try {
      const result = await Recipe.bulkWrite(operations, { ordered: false });
      imported += result.upsertedCount;
      skipped += result.matchedCount;
    } catch (err) {
      if (err.writeErrors) {
        errors += err.writeErrors.length;
        console.error(`  ✗ Batch errors: ${err.writeErrors.length}`);
      } else {
        errors += batch.length;
        console.error(`  ✗ Batch failed: ${err.message}`);
      }
    }

    const progress = Math.min(i + BATCH_SIZE, rawRecipes.length);
    process.stdout.write(`  Progress: ${progress}/${rawRecipes.length}\r`);

    if (i + BATCH_SIZE < rawRecipes.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log(`  ✓ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}`);
  return { imported, skipped, errors };
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Recipe Import Script');
  console.log('═══════════════════════════════════════\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const totals = { imported: 0, skipped: 0, errors: 0 };

  for (const { file, book } of BOOK_FILES) {
    console.log(`\n── Book ${book} (${file}) ──`);
    const result = await importBook(file, book);
    totals.imported += result.imported;
    totals.skipped += result.skipped;
    totals.errors += result.errors;
  }

  const totalDocs = await Recipe.countDocuments();

  console.log('\n═══════════════════════════════════════');
  console.log('  Import Summary');
  console.log('═══════════════════════════════════════');
  console.log(`  New recipes inserted : ${totals.imported}`);
  console.log(`  Already existing     : ${totals.skipped}`);
  console.log(`  Errors               : ${totals.errors}`);
  console.log(`  Total in database    : ${totalDocs}`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('✓ Disconnected from MongoDB');
  process.exit(0);
}

main();
