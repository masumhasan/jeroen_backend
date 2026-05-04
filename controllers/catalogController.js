const Allergy = require('../models/Allergy');
const DietaryPreference = require('../models/DietaryPreference');

// ── Allergies ──

const getAllergiesForAdmin = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const items = await Allergy.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

const createAllergyByAdmin = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const item = await Allergy.create({
      name,
      description: String(req.body.description || '').trim(),
      createdBy: req.user?._id || null
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const updateAllergyByAdmin = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    const item = await Allergy.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const deleteAllergyByAdmin = async (req, res, next) => {
  try {
    const item = await Allergy.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Dietary Preferences ──

const getDietaryPreferencesForAdmin = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const items = await DietaryPreference.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

const createDietaryPreferenceByAdmin = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const item = await DietaryPreference.create({
      name,
      description: String(req.body.description || '').trim(),
      createdBy: req.user?._id || null
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const updateDietaryPreferenceByAdmin = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    const item = await DietaryPreference.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const deleteDietaryPreferenceByAdmin = async (req, res, next) => {
  try {
    const item = await DietaryPreference.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Public endpoints (for mobile app) ──

const getAllergiesList = async (req, res, next) => {
  try {
    const items = await Allergy.find({}).sort({ name: 1 }).select('name').lean();
    res.status(200).json({ status: 'success', data: items.map(i => i.name) });
  } catch (error) {
    next(error);
  }
};

const getDietaryPreferencesList = async (req, res, next) => {
  try {
    const items = await DietaryPreference.find({}).sort({ name: 1 }).select('name').lean();
    res.status(200).json({ status: 'success', data: items.map(i => i.name) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllergiesForAdmin,
  createAllergyByAdmin,
  updateAllergyByAdmin,
  deleteAllergyByAdmin,
  getDietaryPreferencesForAdmin,
  createDietaryPreferenceByAdmin,
  updateDietaryPreferenceByAdmin,
  deleteDietaryPreferenceByAdmin,
  getAllergiesList,
  getDietaryPreferencesList,
};
