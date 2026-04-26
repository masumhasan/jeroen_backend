const SupportThread = require('../models/SupportThread');

function fullName(user) {
  if (!user) return 'Unknown';
  const n = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return n || 'Unknown';
}

function formatMessageTime(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function mapMessageDoc(m) {
  const text =
    (m.body && String(m.body).trim()) || (m.imageUrl ? '[Image]' : '');
  return {
    id: String(m._id),
    body: m.body || '',
    imageUrl: m.imageUrl || null,
    from: m.from,
    text,
    time: formatMessageTime(m.createdAt),
    isAdmin: m.from === 'admin',
    createdAt: m.createdAt,
  };
}

/** GET /api/support/thread — current user's thread (create if missing). */
exports.getMyThread = async (req, res, next) => {
  try {
    let thread = await SupportThread.findOne({ user: req.user._id });
    if (!thread) {
      thread = await SupportThread.create({
        user: req.user._id,
        messages: [],
        adminUnreadCount: 0,
        userUnreadCount: 0,
      });
    }
    res.status(200).json({
      status: 'success',
      data: {
        threadId: String(thread._id),
        userUnreadCount: thread.userUnreadCount || 0,
        messages: thread.messages.map((m) => mapMessageDoc(m)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/support/thread/read — clear user-side unread (admin replies). */
exports.markMyThreadRead = async (req, res, next) => {
  try {
    await SupportThread.updateOne(
      { user: req.user._id },
      { $set: { userUnreadCount: 0 } }
    );
    res.status(200).json({ status: 'success', data: {} });
  } catch (err) {
    next(err);
  }
};

/** POST /api/support/messages — optional multipart file field `support_image`. */
exports.postUserMessage = async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    if (!body && !imageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Message cannot be empty',
      });
    }
    let thread = await SupportThread.findOne({ user: req.user._id });
    if (!thread) {
      thread = await SupportThread.create({
        user: req.user._id,
        messages: [],
        adminUnreadCount: 0,
        userUnreadCount: 0,
      });
    }
    thread.messages.push({
      from: 'user',
      body: body || '',
      imageUrl,
    });
    thread.adminUnreadCount = (thread.adminUnreadCount || 0) + 1;
    await thread.save();
    const m = thread.messages[thread.messages.length - 1];
    res.status(201).json({
      status: 'success',
      data: { message: mapMessageDoc(m) },
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/admin/support/threads */
exports.listThreadsAdmin = async (req, res, next) => {
  try {
    const threads = await SupportThread.find()
      .populate('user', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .lean();

    const data = threads.map((t) => {
      const msgs = t.messages || [];
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      const preview = last
        ? (last.body && String(last.body).trim()) || (last.imageUrl ? '[Image]' : '')
        : '';
      return {
        id: String(t._id),
        userId: t.user?._id?.toString(),
        name: fullName(t.user),
        avatar: '',
        lastMessage: preview,
        lastTime: formatMessageTime(t.updatedAt),
        unread: t.adminUnreadCount || 0,
        online: false,
      };
    });

    res.status(200).json({ status: 'success', data: { threads: data } });
  } catch (err) {
    next(err);
  }
};

/** GET /api/admin/support/threads/:threadId */
exports.getThreadAdmin = async (req, res, next) => {
  try {
    const thread = await SupportThread.findById(req.params.threadId)
      .populate('user', 'firstName lastName email')
      .lean();
    if (!thread) {
      return res.status(404).json({ status: 'error', message: 'Thread not found' });
    }
    const messages = (thread.messages || []).map((m) => ({
      id: String(m._id),
      senderId: m.from === 'admin' ? 'admin' : String(thread.user?._id || ''),
      text:
        (m.body && String(m.body).trim()) || (m.imageUrl ? '[Image]' : ''),
      time: formatMessageTime(m.createdAt),
      isAdmin: m.from === 'admin',
      imageUrl: m.imageUrl || null,
      body: m.body || '',
    }));

    res.status(200).json({
      status: 'success',
      data: {
        thread: {
          id: String(thread._id),
          userId: thread.user?._id?.toString(),
          name: fullName(thread.user),
          email: thread.user?.email,
        },
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/admin/support/threads/:threadId/read */
exports.markThreadReadAdmin = async (req, res, next) => {
  try {
    await SupportThread.findByIdAndUpdate(req.params.threadId, {
      $set: { adminUnreadCount: 0 },
    });
    res.status(200).json({ status: 'success', data: {} });
  } catch (err) {
    next(err);
  }
};

/** POST /api/admin/support/threads/:threadId/replies */
exports.postAdminReply = async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) {
      return res.status(400).json({
        status: 'error',
        message: 'Reply text is required',
      });
    }
    const thread = await SupportThread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ status: 'error', message: 'Thread not found' });
    }
    thread.messages.push({
      from: 'admin',
      body,
      imageUrl: null,
    });
    thread.userUnreadCount = (thread.userUnreadCount || 0) + 1;
    await thread.save();
    const m = thread.messages[thread.messages.length - 1];
    res.status(201).json({
      status: 'success',
      data: {
        message: {
          id: String(m._id),
          senderId: 'admin',
          text: m.body,
          time: formatMessageTime(m.createdAt),
          isAdmin: true,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
