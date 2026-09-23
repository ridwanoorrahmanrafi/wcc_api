import jwt from 'jsonwebtoken';
import { Store } from '../data/store.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.id) {
      try {
        const liveUser = await Store.getUserById(decoded.id);
        if (liveUser) {
          req.user = {
            ...decoded,
            role: liveUser.role || decoded.role,
            assignedWing: liveUser.assignedWing ? (liveUser.assignedWing._id || liveUser.assignedWing) : null,
            name: liveUser.name || decoded.name,
            email: liveUser.email || decoded.email
          };
          return next();
        }
      } catch (err) {
        // Fallback to decoded payload if Store lookup encounters error
      }
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

export const requireAdmin = requireRole('admin');
export const requireCoordinator = requireRole('coordinator');
export const requireAdminOrCoordinator = requireRole('admin', 'coordinator');

// Optional authentication: decodes JWT if present without rejecting unauthenticated requests
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      ...decoded,
      isAdmin: decoded.role === 'admin',
      isCoordinator: decoded.role === 'coordinator',
      assignedWing: decoded.assignedWing ? String(decoded.assignedWing._id || decoded.assignedWing) : null
    };
  } catch (error) {
    req.user = undefined;
  }
  next();
};


