import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRoles, canManageWing } from '../middleware/roles.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Store.getPrograms({ wingId: req.query.wingId, publicOnly: !req.headers.authorization }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const program = await Store.getProgramById(req.params.id);
    if (!program || (!req.headers.authorization && program.status !== 'published')) return res.status(404).json({ error: 'Program not found' });
    res.json(program);
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const { title, wingId } = req.body;
    if (!title || !wingId) return res.status(400).json({ error: 'Title and wingId are required' });
    if (!(await Store.getWingById(wingId))) return res.status(400).json({ error: 'Wing not found' });
    if (!canManageWing(req, wingId)) return res.status(403).json({ error: 'You cannot manage programs outside your assigned wing' });
    const program = await Store.createProgram(req.body);
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'CREATE_PROGRAM', module: 'Programs', recordId: String(program._id), details: `Created program ${program.title}` });
    res.status(201).json(program);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const current = await Store.getProgramById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Program not found' });
    if (!canManageWing(req, req.body.wingId || current.wingId)) return res.status(403).json({ error: 'You cannot manage programs outside your assigned wing' });
    if (req.body.wingId && !(await Store.getWingById(req.body.wingId))) return res.status(400).json({ error: 'Wing not found' });
    const program = await Store.updateProgram(req.params.id, req.body);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'UPDATE_PROGRAM', module: 'Programs', recordId: String(program._id), details: `Updated program ${program.title}` });
    res.json(program);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const existing = await Store.getProgramById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    if (!canManageWing(req, existing.wingId)) return res.status(403).json({ error: 'You cannot manage programs outside your assigned wing' });
    const program = await Store.deleteProgram(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'DELETE_PROGRAM', module: 'Programs', recordId: String(program._id), details: `Deleted program ${program.title}` });
    res.json({ message: 'Program deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
