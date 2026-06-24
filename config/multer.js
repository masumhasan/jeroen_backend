const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const s3 = require('./s3');

const BUCKET = process.env.AWS_S3_BUCKET_NAME;

const mimeToExt = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function makeS3Storage(folder, prefix) {
  return multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key(_req, file, cb) {
      const ext = mimeToExt[file.mimetype] || path.extname(file.originalname).replace('.', '') || 'jpg';
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${folder}/${prefix}-${uniqueSuffix}.${ext}`);
    },
  });
}

const imageFileFilter = (_req, file, cb) => {
  const allowed = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/;
  cb(null, allowed.test(file.mimetype));
};

// recipes/ — for admin-managed recipes and user-submitted recipes
const upload = multer({
  storage: makeS3Storage('recipes', 'recipe'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// avatars/ — for user profile pictures
const uploadAvatar = multer({
  storage: makeS3Storage('avatars', 'avatar'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// community/ — for community post images
const uploadPost = multer({
  storage: makeS3Storage('community', 'post'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// support/ — for support message attachments
const uploadSupport = multer({
  storage: makeS3Storage('support', 'support'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;
module.exports.uploadAvatar = uploadAvatar;
module.exports.uploadPost = uploadPost;
module.exports.uploadSupport = uploadSupport;
