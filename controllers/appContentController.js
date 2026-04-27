const {
  AppContent,
  APP_CONTENT_TYPES,
  DEFAULT_CONTENT_BY_TYPE,
} = require('../models/AppContent');

const normalizeType = (type) => String(type || '').trim().toLowerCase();

const assertValidType = (type) => {
  if (!APP_CONTENT_TYPES.includes(type)) {
    const error = new Error('Invalid content type');
    error.statusCode = 400;
    throw error;
  }
};

const findOrCreateContent = async (type) => {
  let doc = await AppContent.findOne({ type });
  if (!doc) {
    doc = await AppContent.create({
      type,
      content: DEFAULT_CONTENT_BY_TYPE[type] || '',
    });
  }
  return doc;
};

const getAppContentByType = async (req, res, next) => {
  try {
    const type = normalizeType(req.params.type);
    assertValidType(type);

    const content = await findOrCreateContent(type);

    res.status(200).json({
      success: true,
      message: `${type} content fetched successfully`,
      data: content,
    });
  } catch (error) {
    next(error);
  }
};

const updateAppContentByType = async (req, res, next) => {
  try {
    const type = normalizeType(req.params.type);
    assertValidType(type);

    const payloadContent = String(req.body?.content || '').trim();
    if (!payloadContent) {
      return res.status(400).json({
        success: false,
        message: 'Content cannot be empty',
      });
    }

    const content = await AppContent.findOneAndUpdate(
      { type },
      { content: payloadContent },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.status(200).json({
      success: true,
      message: `${type} content updated successfully`,
      data: content,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAppContentByType,
  updateAppContentByType,
};
