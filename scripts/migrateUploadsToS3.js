/**
 * One-time migration: upload all local files from /uploads to S3 and
 * update MongoDB records so they point to the new S3 URLs.
 *
 * Run once: node scripts/migrateUploadsToS3.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const s3 = require('../config/s3');

const BUCKET = process.env.AWS_S3_BUCKET_NAME;
const REGION = process.env.AWS_REGION;
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const S3_BASE = `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

const mimeMap = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** Determine the S3 folder for a local file path */
function getS3Key(localPath) {
  const rel = path.relative(UPLOADS_DIR, localPath).replace(/\\/g, '/');
  if (rel.startsWith('avatars/')) return rel; // avatars/avatar-xxx.jpg
  if (rel.startsWith('mealplan-')) return `mealplans/${rel}`;
  return `recipes/${rel}`; // recipe-xxx, bare files
}

/** Collect all files recursively under UPLOADS_DIR */
function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

async function uploadFile(localPath) {
  const key = getS3Key(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = mimeMap[ext] || 'application/octet-stream';
  const body = fs.readFileSync(localPath);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return { localPath, key, url: `${S3_BASE}/${key}` };
}

async function main() {
  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ MongoDB connected');

  const { Recipe } = require('../models/Recipe');
  const { UserRecipe } = require('../models/UserRecipe');
  const Post = require('../models/Post');
  const User = require('../models/User');

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('No uploads directory found. Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const files = collectFiles(UPLOADS_DIR);
  console.log(`\nFound ${files.length} file(s) to upload.\n`);

  // Build a map: localRelativePath → S3 URL
  const pathMap = {}; // e.g. { '/uploads/recipe-xxx.jpg': 'https://...' }

  for (const file of files) {
    try {
      const { key, url } = await uploadFile(file);
      const localWebPath = '/' + path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
      pathMap[localWebPath] = url;
      console.log(`  ✓ ${localWebPath} → ${key}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${file} — ${err.message}`);
    }
  }

  console.log('\nUpdating MongoDB records...\n');

  let updated = 0;

  // Helper: update a model's field based on pathMap
  async function updateField(Model, fieldName) {
    const docs = await Model.find({ [fieldName]: { $regex: '^/uploads/' } }).lean();
    for (const doc of docs) {
      const oldPath = doc[fieldName];
      const newUrl = pathMap[oldPath];
      if (newUrl) {
        await Model.updateOne({ _id: doc._id }, { [fieldName]: newUrl });
        console.log(`  ✓ ${Model.modelName}.${fieldName}: ${oldPath} → (S3 URL)`);
        updated++;
      } else {
        console.log(`  ⚠ No S3 mapping for ${oldPath} (file may not exist locally)`);
      }
    }
  }

  await updateField(Recipe, 'recipeImage');
  await updateField(UserRecipe, 'recipeImage');
  await updateField(Post, 'image');
  await updateField(User, 'avatar');

  console.log(`\n✓ Migration complete. ${files.length} files uploaded, ${updated} DB records updated.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
