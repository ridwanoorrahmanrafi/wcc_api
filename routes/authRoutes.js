import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Store } from '../data/store.js';
import { verifyToken, requireAdmin, requireAdminOrCoordinator } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { loginLimiter } from '../middleware/rateLimiters.js';
import VolunteerLog from '../models/VolunteerLog.js';
import User from '../models/User.js';


const router = express.Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, memberId, volunteerWing, volunteerInterests } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await Store.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const assignedRole = role === 'volunteer' ? 'volunteer' : (role === 'admin' ? 'admin' : 'member');
    const autoMemberId = memberId || (assignedRole === 'volunteer' 
      ? `WCC-VOL-${Math.floor(1000 + Math.random() * 9000)}` 
      : `WCC-2026-${Math.floor(1000 + Math.random() * 9000)}`);

    const user = await Store.createUser({
      name,
      email,
      password,
      role: assignedRole,
      phone: phone || '',
      memberId: autoMemberId,
      volunteerWing: volunteerWing || '',
      volunteerInterests: volunteerInterests || [],
      totalHours: 0
    });

    if (assignedRole === 'member') {
      await Store.createMember({
        memberId: autoMemberId,
        nameEn: name,
        nameBn: name,
        mobile: phone || '',
        email: email,
        wing: volunteerWing || 'সাধারণ উইং',
        profession: 'General Member',
        status: 'Active',
        joinedDate: new Date()
      }).catch(err => console.error('[Member Record Create Notice]', err.message));
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        assignedWing: user.assignedWing ? (user.assignedWing._id || user.assignedWing) : null
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedWing: user.assignedWing || null,
        phone: user.phone,
        memberId: user.memberId,
        volunteerWing: user.volunteerWing,
        volunteerInterests: user.volunteerInterests,
        totalHours: user.totalHours || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await Store.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        assignedWing: user.assignedWing ? (user.assignedWing._id || user.assignedWing) : null
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedWing: user.assignedWing || null,
        phone: user.phone,
        memberId: user.memberId,
        volunteerWing: user.volunteerWing || '',
        volunteerInterests: user.volunteerInterests || [],
        totalHours: user.totalHours || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// Google OAuth Sign-in & Registration
router.post('/google', async (req, res, next) => {
  try {
    const { email, name, photoUrl } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google authentication' });
    }

    let user = await Store.findUserByEmail(email);

    if (!user) {
      // Automatically register new member via Google
      const autoMemberId = `WCC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const randomPassword = Math.random().toString(36).slice(-12) + 'Wcc!';

      user = await Store.createUser({
        name: name || email.split('@')[0],
        email,
        password: randomPassword,
        role: 'member',
        phone: '',
        memberId: autoMemberId,
        volunteerWing: 'সাধারণ উইং',
        volunteerInterests: [],
        totalHours: 0
      });

      // Create linked member record in MongoDB
      await Store.createMember({
        memberId: autoMemberId,
        nameEn: name || email.split('@')[0],
        nameBn: name || email.split('@')[0],
        mobile: '',
        email: email,
        wing: 'সাধারণ উইং',
        profession: 'General Member',
        photoUrl: photoUrl || '',
        status: 'Active',
        joinedDate: new Date()
      }).catch((err) => console.error('[Google Member Record Create Notice]', err.message));
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        memberId: user.memberId || '',
        volunteerWing: user.volunteerWing || 'সাধারণ উইং',
        volunteerInterests: user.volunteerInterests || [],
        totalHours: user.totalHours || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// Request Password Reset (POST /forgot-password)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await Store.findUserByEmail(cleanEmail);

    // To prevent user enumeration attacks, respond with a generic success message even if not found
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, a password reset link has been dispatched.'
      });
    }

    // Generate secure 32-byte hex token and 1-hour expiration
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await Store.updateUser(user._id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });

    // Send transactional email
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name || 'Member',
        resetToken
      });
    } catch (mailErr) {
      console.error('[EmailService Error] Failed to send password reset email:', mailErr.message);
    }

    await Store.addAuditLog({
      user: user.name || user.email,
      role: user.role,
      action: 'REQUEST_PASSWORD_RESET',
      module: 'Security',
      recordId: String(user._id),
      details: `Password reset link generated for ${user.email}`
    });

    res.json({
      message: 'If an account exists with this email, a password reset link has been dispatched.',
      // In development or test mode, expose resetToken for instant verification
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: resetToken } : {})
    });
  } catch (err) {
    next(err);
  }
});

// Verify Reset Token (GET /verify-reset-token)
router.get('/verify-reset-token', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Reset token is required' });
    }

    const user = await Store.findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({
        valid: false,
        error: 'Password reset link is invalid or has expired. Please request a new one.'
      });
    }

    res.json({
      valid: true,
      email: user.email,
      name: user.name
    });
  } catch (err) {
    next(err);
  }
});

// Reset Password with Token (POST /reset-password)
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await Store.findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({
        error: 'Password reset token is invalid or has expired. Please request a new link.'
      });
    }

    await Store.updateUserPassword(user._id, newPassword);

    await Store.addAuditLog({
      user: user.name || user.email,
      role: user.role,
      action: 'RESET_PASSWORD',
      module: 'Security',
      recordId: String(user._id),
      details: `Password was successfully reset using valid security token for ${user.email}`
    });

    res.json({
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (err) {
    next(err);
  }
});

// Helper to format public user profile safely
const formatUserProfile = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  assignedWing: user.assignedWing || null,
  phone: user.phone || '',
  memberId: user.memberId || '',
  volunteerWing: user.volunteerWing || '',
  volunteerInterests: user.volunteerInterests || [],
  totalHours: user.totalHours || 0,
  photoUrl: user.photoUrl || '/default-avatar.svg',
  blood: user.blood || '',
  upazila: user.upazila || 'ঝালকাঠি সদর',
  district: user.district || 'ঝালকাঠি',
  profession: user.profession || '',
  bio: user.bio || '',
  status: user.status || 'active',
  createdAt: user.createdAt
});

// Current User profile (GET /me and GET /profile)
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await Store.findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: formatUserProfile(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    const user = await Store.findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: formatUserProfile(user) });
  } catch (err) {
    next(err);
  }
});

// Update Profile (PUT /profile)
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    const {
      name,
      phone,
      photoUrl,
      blood,
      upazila,
      district,
      profession,
      bio,
      volunteerInterests
    } = req.body;

    const user = await Store.findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateFields = {};
    if (name !== undefined && name.trim()) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (photoUrl !== undefined) updateFields.photoUrl = photoUrl.trim();
    if (blood !== undefined) updateFields.blood = blood.trim();
    if (upazila !== undefined) updateFields.upazila = upazila.trim();
    if (district !== undefined) updateFields.district = district.trim();
    if (profession !== undefined) updateFields.profession = profession.trim();
    if (bio !== undefined) updateFields.bio = bio.trim();
    if (volunteerInterests !== undefined && Array.isArray(volunteerInterests)) {
      updateFields.volunteerInterests = volunteerInterests;
    }

    const updated = await Store.updateUser(user._id, updateFields);

    await Store.addAuditLog({
      user: updated.name || updated.email,
      role: updated.role,
      action: 'UPDATE_PROFILE',
      module: 'UserProfile',
      recordId: String(updated._id),
      details: `User ${updated.name} (${updated.email}) updated their profile details`
    });

    res.json({
      message: 'Profile updated successfully',
      user: formatUserProfile(updated)
    });
  } catch (err) {
    next(err);
  }
});

// Change Password for authenticated user (PUT /change-password)
router.put('/change-password', verifyToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await Store.getUserById(req.user.id || req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match' });
    }

    await Store.updateUserPassword(user._id, newPassword);

    await Store.addAuditLog({
      user: user.name || user.email,
      role: user.role,
      action: 'CHANGE_PASSWORD',
      module: 'Security',
      recordId: String(user._id),
      details: `User ${user.name} (${user.email}) changed their password`
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});


// Admin User Management: List all users
router.get('/users', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const users = await Store.getUsers({ role, search });
    res.json(
      users.map(u => ({
        id: u._id,
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        assignedWing: u.assignedWing || null,
        phone: u.phone || '',
        memberId: u.memberId || '',
        volunteerWing: u.volunteerWing || '',
        volunteerInterests: u.volunteerInterests || [],
        totalHours: u.totalHours || 0,
        upazila: u.upazila || '',
        district: u.district || '',
        photoUrl: u.photoUrl || '',
        status: u.status || 'active',
        createdAt: u.createdAt
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Admin User Management: List coordinators
router.get('/coordinators', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const coordinators = await Store.getUsers({ role: 'coordinator' });
    res.json(
      coordinators.map(u => ({
        id: u._id,
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        assignedWing: u.assignedWing || null,
        phone: u.phone || '',
        memberId: u.memberId || '',
        volunteerWing: u.volunteerWing || '',
        volunteerInterests: u.volunteerInterests || [],
        totalHours: u.totalHours || 0,
        upazila: u.upazila || '',
        district: u.district || '',
        photoUrl: u.photoUrl || '',
        status: u.status || 'active',
        createdAt: u.createdAt
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Admin User Management: Assign/Update Wing for a User / Coordinator
router.patch('/users/:id/wing', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { assignedWing } = req.body;

    let wingObj = null;
    if (assignedWing) {
      wingObj = await Store.getWingById(assignedWing);
      if (!wingObj) {
        return res.status(400).json({ error: 'Assigned wing does not exist' });
      }
    }

    const updateFields = {
      assignedWing: assignedWing || null
    };
    if (wingObj) {
      updateFields.volunteerWing = `${wingObj.nameBn} (${wingObj.nameEn})`;
    } else if (assignedWing === null || assignedWing === '') {
      updateFields.volunteerWing = '';
    }

    const updatedUser = await Store.updateUser(req.params.id, updateFields);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'ASSIGN_WING',
      module: 'UserManagement',
      recordId: String(updatedUser._id),
      details: `Assigned wing ${wingObj ? wingObj.nameEn : 'None'} to user ${updatedUser.name} (${updatedUser.email})`
    });

    res.json({
      message: 'User assigned wing updated successfully',
      user: {
        id: updatedUser._id,
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        assignedWing: updatedUser.assignedWing || null,
        phone: updatedUser.phone,
        memberId: updatedUser.memberId
      }
    });
  } catch (err) {
    next(err);
  }
});

// Admin User Management: Update role for a user
router.patch('/users/:id/role', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { role, assignedWing } = req.body;
    const allowedRoles = ['admin', 'finance_officer', 'coordinator', 'member', 'volunteer'];

    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`
      });
    }

    const updateData = { role };
    if (assignedWing !== undefined) {
      if (assignedWing) {
        const wingObj = await Store.getWingById(assignedWing);
        if (!wingObj) {
          return res.status(400).json({ error: 'Assigned wing does not exist' });
        }
        updateData.assignedWing = assignedWing;
      } else {
        updateData.assignedWing = null;
      }
    }

    const updatedUser = await Store.updateUser(req.params.id, updateData);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'UPDATE_USER_ROLE',
      module: 'UserManagement',
      recordId: String(updatedUser._id),
      details: `Updated role of user ${updatedUser.name} to ${role}`
    });

    res.json({
      message: 'User role updated successfully',
      user: {
        id: updatedUser._id,
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        assignedWing: updatedUser.assignedWing || null
      }
    });
  } catch (err) {
    next(err);
  }
});

// Volunteer Service Log Endpoints
router.post('/volunteer/log', verifyToken, async (req, res, next) => {
  try {
    const { driveName, hours, notes } = req.body;
    if (!driveName || !hours) {
      return res.status(400).json({ error: 'Campaign/Drive name and hours are required' });
    }

    const numericHours = Number(hours);
    if (isNaN(numericHours) || numericHours <= 0) {
      return res.status(400).json({ error: 'Hours must be a valid positive number' });
    }

    const log = await VolunteerLog.create({
      userId: req.user.id,
      userEmail: req.user.email,
      volunteerName: req.user.name,
      driveName,
      hours: numericHours,
      notes: notes || '',
      date: new Date()
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { totalHours: numericHours } },
      { new: true }
    );

    res.status(201).json({
      message: 'Service hours logged successfully',
      log,
      totalHours: updatedUser ? updatedUser.totalHours : numericHours
    });
  } catch (err) {
    next(err);
  }
});

router.get('/volunteer/logs', verifyToken, async (req, res, next) => {
  try {
    const logs = await VolunteerLog.find({ userEmail: req.user.email.toLowerCase() }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
