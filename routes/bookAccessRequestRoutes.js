const express = require('express');
const BookAccessRequest = require('../models/BookAccessRequest');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { requireDashboardAccess } = require('../middleware/dashboardAuthMiddleware');

const router = express.Router();

// POST — user submits a book access request
router.post('/', protect, async (req, res) => {
  try {
    const { bookSku, bookTitle, requestEmail, note } = req.body;
    if (!bookSku || !bookTitle || !requestEmail) {
      return res.status(400).json({ message: 'bookSku, bookTitle and requestEmail are required' });
    }

    // Prevent duplicate pending requests for the same book
    const existing = await BookAccessRequest.findOne({
      userId: req.user._id,
      bookSku,
      status: 'pending',
    });
    if (existing) {
      return res.status(409).json({ message: 'You already have a pending request for this book' });
    }

    const request = await BookAccessRequest.create({
      userId: req.user._id,
      bookSku,
      bookTitle,
      requestEmail: requestEmail.trim().toLowerCase(),
      note: note || '',
    });

    res.status(201).json({ status: 'success', data: request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET — user fetches their own requests (for rejection notifications)
router.get('/my', protect, async (req, res) => {
  try {
    const requests = await BookAccessRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ status: 'success', data: requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH — user dismisses a rejection notification
router.patch('/:id/dismiss', protect, async (req, res) => {
  try {
    const request = await BookAccessRequest.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { dismissedAt: new Date() },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json({ status: 'success', data: request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET — dashboard: list all requests with filters
router.get('/', protect, requireDashboardAccess, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status && status !== 'All') query.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { requestEmail: { $regex: escaped, $options: 'i' } },
        { bookTitle: { $regex: escaped, $options: 'i' } },
        { note: { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [requests, totalResults] = await Promise.all([
      BookAccessRequest.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BookAccessRequest.countDocuments(query),
    ]);

    res.json({
      requests,
      totalPages: Math.ceil(totalResults / Number(limit)),
      currentPage: Number(page),
      totalResults,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH — dashboard: approve a request → add SKU to user's purchasedBooks
router.patch('/:id/approve', protect, requireDashboardAccess, async (req, res) => {
  try {
    const request = await BookAccessRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await Promise.all([
      BookAccessRequest.findByIdAndUpdate(req.params.id, {
        status: 'approved',
        adminNote: null,
      }),
      User.findByIdAndUpdate(request.userId, {
        $addToSet: { purchasedBooks: request.bookSku },
      }),
    ]);

    const updated = await BookAccessRequest.findById(req.params.id)
      .populate('userId', 'firstName lastName email')
      .lean();

    res.json({ status: 'success', data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH — dashboard: reject a request with a note
router.patch('/:id/reject', protect, requireDashboardAccess, async (req, res) => {
  try {
    const adminNote = String(req.body?.adminNote || '').trim();
    if (!adminNote) {
      return res.status(400).json({ message: 'A rejection note is required' });
    }

    const updated = await BookAccessRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', adminNote, dismissedAt: null },
      { new: true }
    ).populate('userId', 'firstName lastName email').lean();

    if (!updated) return res.status(404).json({ message: 'Request not found' });
    res.json({ status: 'success', data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
