import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Store.getWings());
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const wing = await Store.getWingBySlug(req.params.slug);
    if (!wing) return res.status(404).json({ error: 'Wing not found' });
    res.json(wing);
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, requireRoles('admin'), async (req, res, next) => {
  try {
    const { nameEn, nameBn, slug } = req.body;
    if (!nameEn || !nameBn || !slug) {
      return res.status(400).json({ error: 'English name, Bengali name, and slug are required' });
    }
    if (await Store.getWingBySlug(slug)) {
      return res.status(409).json({ error: 'A wing with this slug already exists' });
    }
    const wing = await Store.createWing(req.body);
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'CREATE_WING', module: 'Wings', recordId: String(wing._id), details: `Created wing ${wing.nameEn}` });
    res.status(201).json(wing);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', verifyToken, requireRoles('admin'), async (req, res, next) => {
  try {
    if (req.body.slug) {
      const existing = await Store.getWingBySlug(req.body.slug);
      if (existing && String(existing._id) !== String(req.params.id)) {
        return res.status(409).json({ error: 'A wing with this slug already exists' });
      }
    }
    const wing = await Store.updateWing(req.params.id, req.body);
    if (!wing) return res.status(404).json({ error: 'Wing not found' });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'UPDATE_WING', module: 'Wings', recordId: String(wing._id), details: `Updated wing ${wing.nameEn}` });
    res.json(wing);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', verifyToken, requireRoles('admin'), async (req, res, next) => {
  try {
    const wing = await Store.deleteWing(req.params.id);
    if (!wing) return res.status(404).json({ error: 'Wing not found' });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'DELETE_WING', module: 'Wings', recordId: String(wing._id), details: `Deleted wing ${wing.nameEn}` });
    res.json({ message: 'Wing deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
