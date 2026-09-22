import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRoles, canManageWing } from '../middleware/roles.js';
import { sendEventRegistrationEmail } from '../services/emailService.js';

const router = express.Router();

router.post('/:id/register', verifyToken, requireRoles('member', 'volunteer'), async (req, res, next) => {
  try {
    const event = await Store.getEventById(req.params.id);
    if (!event || event.status !== 'published') return res.status(404).json({ error: 'Published event not found' });
    const existing = await Store.getRegistrationByUserAndEvent(req.user.id, req.params.id);
    if (existing) return res.status(409).json({ error: 'Already registered for this event' });
    const registrations = await Store.getEventRegistrations(req.params.id);
    if (registrations.length >= Number(event.capacity)) return res.status(409).json({ error: 'Event capacity has been reached' });
    const registration = await Store.createEventRegistration({ eventId: req.params.id, userId: req.user.id, userName: req.user.name, userEmail: req.user.email, userMemberId: req.user.memberId || '' });
    sendEventRegistrationEmail(event, req.user).catch(err => console.error('[Email] Registration notification failed:', err.message));
    res.status(201).json({ message: 'Event registration successful', registration });
  } catch (err) { next(err); }
});

router.get('/:id/registrations', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try { res.json(await Store.getEventRegistrations(req.params.id)); } catch (err) { next(err); }
});

router.patch('/:id/attendance', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const { userId, attended } = req.body;
    if (!userId || typeof attended !== 'boolean') return res.status(400).json({ error: 'userId and boolean attended are required' });
    const updated = await Store.markAttendance(req.params.id, userId, attended);
    if (!updated) return res.status(404).json({ error: 'Registration not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await Store.getEvents({ wingId: req.query.wingId, programId: req.query.programId, publicOnly: !req.headers.authorization }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await Store.getEventById(req.params.id);
    if (!event || (!req.headers.authorization && event.status !== 'published')) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const { title, wingId, date, location, capacity } = req.body;
    if (!title || !wingId || !date || !location || capacity === undefined) return res.status(400).json({ error: 'Title, wingId, date, location, and capacity are required' });
    if (Number(capacity) < 1 || !Number.isInteger(Number(capacity))) return res.status(400).json({ error: 'Capacity must be a positive whole number' });
    if (!(await Store.getWingById(wingId))) return res.status(400).json({ error: 'Wing not found' });
    if (!canManageWing(req, wingId)) return res.status(403).json({ error: 'You cannot manage events outside your assigned wing' });
    if (req.body.programId && !(await Store.getProgramById(req.body.programId))) return res.status(400).json({ error: 'Program not found' });
    const event = await Store.createEvent({ ...req.body, capacity: Number(capacity), createdBy: req.user.id });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'CREATE_EVENT', module: 'Events', recordId: String(event._id), details: `Created event ${event.title}` });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const current = await Store.getEventById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });
    if (!canManageWing(req, req.body.wingId || current.wingId)) return res.status(403).json({ error: 'You cannot manage events outside your assigned wing' });
    if (req.body.wingId && !(await Store.getWingById(req.body.wingId))) return res.status(400).json({ error: 'Wing not found' });
    if (req.body.programId && !(await Store.getProgramById(req.body.programId))) return res.status(400).json({ error: 'Program not found' });
    if (req.body.capacity !== undefined && (Number(req.body.capacity) < 1 || !Number.isInteger(Number(req.body.capacity)))) return res.status(400).json({ error: 'Capacity must be a positive whole number' });
    const event = await Store.updateEvent(req.params.id, req.body);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'UPDATE_EVENT', module: 'Events', recordId: String(event._id), details: `Updated event ${event.title}` });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const existing = await Store.getEventById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (!canManageWing(req, existing.wingId)) return res.status(403).json({ error: 'You cannot manage events outside your assigned wing' });
    const event = await Store.deleteEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await Store.addAuditLog({ user: req.user.name || req.user.email, role: req.user.role, action: 'DELETE_EVENT', module: 'Events', recordId: String(event._id), details: `Deleted event ${event.title}` });
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
