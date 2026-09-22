import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { sendIssueStatusEmail } from '../services/emailService.js';

const router = express.Router();

// ─── PUBLIC: Submit an issue (no auth required) ───────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { title, description, location, reporterName, reporterContact } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Issue title is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'Issue description is required' });
    if (!location || !location.trim()) return res.status(400).json({ error: 'Location is required' });
    if (!reporterName || !reporterName.trim()) return res.status(400).json({ error: 'Reporter name is required' });
    if (!reporterContact || !reporterContact.trim()) return res.status(400).json({ error: 'Reporter contact is required' });

    const issue = await Store.createIssue({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      reporterName: reporterName.trim(),
      reporterContact: reporterContact.trim(),
      wingId: req.body.wingId || '',
      photoUrl: req.body.photoUrl || '',
      status: 'pending'
    });

    res.status(201).json({
      message: 'Issue submitted successfully',
      issueCode: issue.issueCode,
      issue: {
        issueCode: issue.issueCode,
        title: issue.title,
        location: issue.location,
        status: issue.status,
        createdAt: issue.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUBLIC: Track issue by code (safe, no PII) ─────────────────────────────
router.get('/track/:code', async (req, res, next) => {
  try {
    const issue = await Store.getIssueById(req.params.code);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    // Return only safe public fields — no reporter contact
    res.json({
      issueCode: issue.issueCode,
      title: issue.title,
      location: issue.location,
      status: issue.status,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN/COORDINATOR: List issues ──────────────────────────────────────────
router.get('/', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const { status, wingId, limit } = req.query;
    // Coordinators can only see issues for their assigned wing
    let effectiveWingId = wingId;
    if (req.user.role === 'coordinator' && req.user.assignedWing) {
      effectiveWingId = String(req.user.assignedWing);
    }
    const issues = await Store.getIssues({ status, wingId: effectiveWingId, limit });
    res.json(issues);
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN/COORDINATOR: Get single issue ─────────────────────────────────────
router.get('/:id', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const issue = await Store.getIssueById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    // Coordinator wing restriction
    if (req.user.role === 'coordinator' && req.user.assignedWing && issue.wingId && String(issue.wingId) !== String(req.user.assignedWing)) {
      return res.status(403).json({ error: 'Access denied to this issue' });
    }
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN/COORDINATOR: Update issue status ─────────────────────────────────
router.patch('/:id/status', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, in_progress, or resolved' });
    }

    const existing = await Store.getIssueById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Issue not found' });
    // Coordinator wing restriction
    if (req.user.role === 'coordinator' && req.user.assignedWing && existing.wingId && String(existing.wingId) !== String(req.user.assignedWing)) {
      return res.status(403).json({ error: 'Access denied to this issue' });
    }

    const previousStatus = existing.status;
    const allowedTransitions = { pending: ['in_progress'], in_progress: ['resolved'], resolved: [] };
    if (!allowedTransitions[previousStatus].includes(status)) {
      return res.status(400).json({ error: `Cannot change issue status from ${previousStatus} to ${status}` });
    }
    const updated = await Store.updateIssueStatus(req.params.id, status);

    // AuditLog entry for status change
    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: 'UPDATE_ISSUE_STATUS',
      module: 'Issues',
      recordId: updated.issueCode,
      details: `Issue ${updated.issueCode} status changed: ${previousStatus} → ${status}`
    });

    // Email notification (non-blocking)
    sendIssueStatusEmail(updated, status).catch(err =>
      console.error('[Email] Issue status notification failed:', err.message)
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN/COORDINATOR: Assign issue ─────────────────────────────────────────
router.patch('/:id/assign', verifyToken, requireRoles('admin', 'coordinator'), async (req, res, next) => {
  try {
    const { assignedTo, assignedToId } = req.body;
    if (!assignedTo) return res.status(400).json({ error: 'assignedTo (name) is required' });

    const existing = await Store.getIssueById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Issue not found' });
    if (req.user.role === 'coordinator' && req.user.assignedWing && existing.wingId && String(existing.wingId) !== String(req.user.assignedWing)) {
      return res.status(403).json({ error: 'Access denied to this issue' });
    }

    const updated = await Store.assignIssue(req.params.id, { assignedTo, assignedToId: assignedToId || '' });

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: 'ASSIGN_ISSUE',
      module: 'Issues',
      recordId: updated.issueCode,
      details: `Issue ${updated.issueCode} assigned to ${assignedTo}`
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
