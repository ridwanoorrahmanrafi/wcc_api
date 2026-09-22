import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Store } from '../data/store.js';
import { verifyToken } from '../middleware/auth.js';

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
      { id: user._id, email: user.email, role: user.role, name: user.name, memberId: user.memberId, assignedWing: user.assignedWing },
      process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production',
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
        phone: user.phone,
        memberId: user.memberId,
        volunteerWing: user.volunteerWing,
        volunteerInterests: user.volunteerInterests,
        totalHours: user.totalHours || 0,
        assignedWing: user.assignedWing || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
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
    // Also allow demo plaintext check in case of initial mock fallback
    const isDirectMatch = user.password === password;
    if (!isMatch && !isDirectMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name, memberId: user.memberId, assignedWing: user.assignedWing },
      process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production',
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
        phone: user.phone,
        memberId: user.memberId,
        volunteerWing: user.volunteerWing || '',
        volunteerInterests: user.volunteerInterests || [],
        totalHours: user.totalHours || 0,
        assignedWing: user.assignedWing || ''
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
      { id: user._id, email: user.email, role: user.role, name: user.name, memberId: user.memberId, assignedWing: user.assignedWing },
      process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production',
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
        totalHours: user.totalHours || 0,
        assignedWing: user.assignedWing || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

// Current User profile
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await Store.findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        memberId: user.memberId,
        volunteerWing: user.volunteerWing || '',
        volunteerInterests: user.volunteerInterests || [],
        totalHours: user.totalHours || 0,
        assignedWing: user.assignedWing || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

// Volunteer Service Log Endpoints
import VolunteerLog from '../models/VolunteerLog.js';
import User from '../models/User.js';

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
