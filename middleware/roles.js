export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  next();
};

export const canManageWing = (req, wingId) => req.user?.role === 'admin' || (req.user?.role === 'coordinator' && req.user.assignedWing && String(req.user.assignedWing) === String(wingId));
