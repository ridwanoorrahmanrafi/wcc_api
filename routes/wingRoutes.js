import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// List all wings (Public)
router.get('/', async (req, res, next) => {
  try {
    const wings = await Store.getWings();
    res.json(wings);
  } catch (err) {
    next(err);
  }
});

// Get single wing by slug (Public)
router.get('/:slug', async (req, res, next) => {
  try {
    const wing = await Store.getWingBySlug(req.params.slug);
    if (!wing) {
      return res.status(404).json({ error: 'Wing not found' });
    }
    res.json(wing);
  } catch (err) {
    next(err);
  }
});

// Create new wing (Admin only)
router.post('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { nameEn, nameBn, slug, description, missionPoints, coverImage } = req.body;
    if (!nameEn || !nameBn || !slug) {
      return res.status(400).json({ error: 'nameEn, nameBn, and slug are required' });
    }

    const cleanSlug = String(slug).trim().toLowerCase();
    const existing = await Store.findWingBySlug(cleanSlug);
    if (existing) {
      return res.status(409).json({ error: 'A wing with this slug already exists' });
    }

    const newWing = await Store.createWing({
      nameEn: nameEn.trim(),
      nameBn: nameBn.trim(),
      slug: cleanSlug,
      description: description || '',
      missionPoints: Array.isArray(missionPoints) ? missionPoints : [],
      coverImage: coverImage || ''
    });

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'CREATE_WING',
      module: 'Wings',
      recordId: newWing.slug || String(newWing._id),
      details: `Created new wing: ${newWing.nameEn} (${newWing.slug})`
    });

    res.status(201).json({
      message: 'Wing created successfully',
      wing: newWing
    });
  } catch (err) {
    next(err);
  }
});

// Update wing by id (Admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { nameEn, nameBn, slug, description, missionPoints, coverImage } = req.body;

    if (slug) {
      const cleanSlug = String(slug).trim().toLowerCase();
      const existing = await Store.findWingBySlug(cleanSlug, req.params.id);
      if (existing) {
        return res.status(409).json({ error: 'A wing with this slug already exists' });
      }
    }

    const updateData = {};
    if (nameEn !== undefined) updateData.nameEn = nameEn.trim();
    if (nameBn !== undefined) updateData.nameBn = nameBn.trim();
    if (slug !== undefined) updateData.slug = String(slug).trim().toLowerCase();
    if (description !== undefined) updateData.description = description;
    if (missionPoints !== undefined) updateData.missionPoints = Array.isArray(missionPoints) ? missionPoints : [];
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    const updated = await Store.updateWing(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: 'Wing not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'UPDATE_WING',
      module: 'Wings',
      recordId: updated.slug || String(updated._id),
      details: `Updated wing: ${updated.nameEn} (${updated.slug})`
    });

    res.json({
      message: 'Wing updated successfully',
      wing: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete wing by id (Admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const deleted = await Store.deleteWing(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Wing not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'DELETE_WING',
      module: 'Wings',
      recordId: deleted.slug || String(deleted._id),
      details: `Deleted wing: ${deleted.nameEn} (${deleted.slug})`
    });

    res.json({ message: 'Wing deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
