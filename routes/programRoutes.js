import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken, requireAdminOrCoordinator } from '../middleware/auth.js';

const router = express.Router();
const ALLOWED_STATUSES = ['draft', 'published', 'completed', 'cancelled'];

// List programs with optional filtering by wingId and status (Public)
router.get('/', async (req, res, next) => {
  try {
    const { wingId, status } = req.query;
    const programs = await Store.getPrograms({ wingId, status });
    res.json(programs);
  } catch (err) {
    next(err);
  }
});

// Get single program by ID (Public)
router.get('/:id', async (req, res, next) => {
  try {
    const program = await Store.getProgramById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json(program);
  } catch (err) {
    next(err);
  }
});

// Create new program (Admin & Coordinator for their wing)
router.post('/', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { title, wingId, description, startDate, endDate, status, coverImage } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!wingId) {
      return res.status(400).json({ error: 'wingId is required' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      if (!coordWingId || coordWingId !== String(wingId)) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only create programs for their assigned wing.'
        });
      }
    }

    // Validate that wingId references an existing Wing
    const wing = await Store.getWingById(wingId);
    if (!wing) {
      return res.status(400).json({ error: 'Referenced Wing does not exist' });
    }

    // Validate status if provided
    let programStatus = 'draft';
    if (status) {
      const cleanStatus = status.toLowerCase().trim();
      if (!ALLOWED_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
        });
      }
      programStatus = cleanStatus;
    }

    // Validate dates
    let parsedStartDate = null;
    let parsedEndDate = null;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format' });
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate format' });
      }
    }

    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return res.status(400).json({ error: 'endDate cannot be before startDate' });
    }

    const newProgram = await Store.createProgram({
      title: title.trim(),
      wingId,
      description: description || '',
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: programStatus,
      coverImage: coverImage || ''
    });

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'CREATE_PROGRAM',
      module: 'Programs',
      recordId: String(newProgram._id),
      details: `Created program: ${newProgram.title} under wing ${wing.nameEn}`
    });

    res.status(201).json({
      message: 'Program created successfully',
      program: newProgram
    });
  } catch (err) {
    next(err);
  }
});

// Update program by ID (Admin & Coordinator for their wing)
router.put('/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const existing = await Store.getProgramById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Program not found' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const existingWingId = String(existing.wingId?._id || existing.wingId || '');
      if (!coordWingId || existingWingId !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only manage programs belonging to their assigned wing.'
        });
      }
      if (req.body.wingId !== undefined && String(req.body.wingId) !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators cannot reassign programs to another wing.'
        });
      }
    }

    const { title, wingId, description, startDate, endDate, status, coverImage } = req.body;
    const updateData = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updateData.title = title.trim();
    }

    if (wingId !== undefined) {
      const wing = await Store.getWingById(wingId);
      if (!wing) {
        return res.status(400).json({ error: 'Referenced Wing does not exist' });
      }
      updateData.wingId = wingId;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (coverImage !== undefined) {
      updateData.coverImage = coverImage;
    }

    if (status !== undefined) {
      const cleanStatus = status.toLowerCase().trim();
      if (!ALLOWED_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
        });
      }
      updateData.status = cleanStatus;
    }

    // Date validation
    let resolvedStart = startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate;
    let resolvedEnd = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate;

    if (startDate !== undefined && startDate) {
      if (isNaN(resolvedStart.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format' });
      }
      updateData.startDate = resolvedStart;
    } else if (startDate === null || startDate === '') {
      updateData.startDate = null;
      resolvedStart = null;
    }

    if (endDate !== undefined && endDate) {
      if (isNaN(resolvedEnd.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate format' });
      }
      updateData.endDate = resolvedEnd;
    } else if (endDate === null || endDate === '') {
      updateData.endDate = null;
      resolvedEnd = null;
    }

    if (resolvedStart && resolvedEnd && new Date(resolvedEnd) < new Date(resolvedStart)) {
      return res.status(400).json({ error: 'endDate cannot be before startDate' });
    }

    const updated = await Store.updateProgram(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: 'Program not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'UPDATE_PROGRAM',
      module: 'Programs',
      recordId: String(updated._id),
      details: `Updated program: ${updated.title}`
    });

    res.json({
      message: 'Program updated successfully',
      program: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete program by ID (Admin & Coordinator for their wing)
router.delete('/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const existing = await Store.getProgramById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Program not found' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const existingWingId = String(existing.wingId?._id || existing.wingId || '');
      if (!coordWingId || existingWingId !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only delete programs belonging to their assigned wing.'
        });
      }
    }

    const deleted = await Store.deleteProgram(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Program not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'DELETE_PROGRAM',
      module: 'Programs',
      recordId: String(deleted._id),
      details: `Deleted program: ${deleted.title}`
    });

    res.json({ message: 'Program deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
