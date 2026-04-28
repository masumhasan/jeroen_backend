const DASHBOARD_ROLES = ['moderator', 'admin', 'superadmin'];
const ROLE_MANAGERS = ['admin', 'superadmin'];

const normalizeRole = (user) => {
  const r = (user?.role || 'user').toLowerCase();
  return DASHBOARD_ROLES.includes(r) ? r : 'user';
};

/** After `protect` — only dashboard staff may call /api/admin routes. */
const requireDashboardAccess = (req, res, next) => {
  const role = normalizeRole(req.user);
  if (!DASHBOARD_ROLES.includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'Dashboard access is not allowed for this account.',
    });
  }
  req.dashboardRole = role;
  next();
};

/** After `protect` + `requireDashboardAccess` — only admin & superadmin. */
const requireAdminOrSuperadmin = (req, res, next) => {
  const role = normalizeRole(req.user);
  if (!ROLE_MANAGERS.includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can perform this action.',
    });
  }
  next();
};

module.exports = {
  requireDashboardAccess,
  requireAdminOrSuperadmin,
  normalizeRole,
  DASHBOARD_ROLES,
  ROLE_MANAGERS,
};
