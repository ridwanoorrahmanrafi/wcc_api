import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken, requireAdminOrCoordinator } from '../middleware/auth.js';
import { sendIssueStatusEmail, isValidEmail } from '../services/emailService.js';
import { publicSubmitLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();
const ALLOWED_STATUSES = ['pending', 'in_progress', 'resolved'];

/**
 * Generate human-readable, unique issue tracking code.
 * Example format: ISSUE-2026-784192
 */
async function generateUniqueIssueCode() {
  const currentYear = new Date().getFullYear();
  let code = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    code = `ISSUE-${currentYear}-${randomSuffix}`;
    const existing = await Store.getIssueByCode(code);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    code = `ISSUE-${currentYear}-${Date.now().toString().slice(-6)}`;
  }
  return code;
}

/**
 * POST /api/issues
 * Public endpoint to submit a community issue.
 * Validates required fields, generates a unique issueCode, defaults status to pending.
 */
router.post('/', publicSubmitLimiter, async (req, res, next) => {
  try {
    const { title, description, location, reporterName, reporterContact, photoUrl, wingId } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Issue title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Issue description is required' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Location / Area is required' });
    }
    if (!reporterName || !reporterName.trim()) {
      return res.status(400).json({ error: 'Reporter name is required' });
    }
    if (!reporterContact || !reporterContact.trim()) {
      return res.status(400).json({ error: 'Reporter contact (phone or email) is required' });
    }

    // Optional wing validation if provided
    let validatedWingId = null;
    if (wingId) {
      const wing = await Store.getWingById(wingId);
      if (wing) {
        validatedWingId = wing._id;
      }
    }

    // Generate unique human-readable issue tracking code
    const issueCode = await generateUniqueIssueCode();

    const newIssue = await Store.createIssue({
      issueCode,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      photoUrl: photoUrl ? String(photoUrl).trim() : '',
      status: 'pending',
      reporterName: reporterName.trim(),
      reporterContact: reporterContact.trim(),
      assignedTo: null,
      wingId: validatedWingId
    });

    res.status(201).json({
      message: 'Community issue submitted successfully',
      issueCode: newIssue.issueCode,
      issue: {
        issueCode: newIssue.issueCode,
        title: newIssue.title,
        description: newIssue.description,
        location: newIssue.location,
        photoUrl: newIssue.photoUrl,
        status: newIssue.status,
        createdAt: newIssue.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/issues/track/:issueCode
 * Safe public lookup endpoint to track issue status by issueCode.
 * Strips PII (reporter contact) and internal system data.
 */
router.get('/track/:issueCode', async (req, res, next) => {
  try {
    const rawCode = req.params.issueCode;
    if (!rawCode || !rawCode.trim()) {
      return res.status(400).json({ error: 'Tracking code is required' });
    }

    const issue = await Store.getIssueByCode(rawCode.trim());
    if (!issue) {
      return res.status(404).json({
        error: `No community issue found matching tracking code '${rawCode.trim()}'. Please verify the code and try again.`
      });
    }

    // Safe public response without PII (reporter contact, user IDs, internal data)
    res.json({
      issueCode: issue.issueCode,
      title: issue.title,
      description: issue.description,
      location: issue.location,
      photoUrl: issue.photoUrl || '',
      status: issue.status,
      wing: issue.wingId ? { nameEn: issue.wingId.nameEn, nameBn: issue.wingId.nameBn } : null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/issues
 * Admin & Coordinator only.
 * Lists issues with optional filtering (status, assignedTo, wingId, search, pagination).
 *
 * NOTE ON WING SCOPING LIMITATION:
 * The prompt specifies: "Coordinator should only see issues relevant to their assigned wing if the existing
 * issue categorization allows it. If there is no wing relationship yet, do not invent complicated behavior;
 * document the limitation."
 * Public issues are submitted without mandatory wing categorization. When an issue has wingId assigned,
 * coordinators are scoped to their assigned wing. Issues without wing assignment are visible to all coordinators
 * and admins so civic emergencies are never silently hidden from triage.
 */
router.get('/', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { status, assignedTo, wingId, search, page = 1, limit = 50 } = req.query;

    let targetWingId = wingId;
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      // If coordinator queries with a wingId or when filtering by their assigned wing
      if (wingId && String(wingId) !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only filter issues for their assigned wing.'
        });
      }
      if (!targetWingId && coordWingId) {
        // Coordinator can view issues of their wing or untriaged issues
        // When explicitly filtering by their wing:
        targetWingId = coordWingId;
      }
    }

    const result = await Store.getIssues({
      status,
      assignedTo,
      wingId: targetWingId,
      search,
      page,
      limit
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/issues/:id
 * Admin & Coordinator only.
 * Retrieves full details of a specific issue by its internal ID.
 */
router.get('/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const issue = await Store.getIssueById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Wing scoping check for coordinator
    if (req.user.role === 'coordinator' && issue.wingId) {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const issueWingId = String(issue.wingId?._id || issue.wingId || '');
      if (coordWingId && issueWingId && coordWingId !== issueWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators cannot view issues assigned to other wings.'
        });
      }
    }

    res.json(issue);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/issues/:id/status
 * Admin & Coordinator only.
 * Updates issue status and records previous and new status in AuditLog.
 */
router.patch('/:id/status', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const cleanStatus = status.toLowerCase().trim();
    if (!ALLOWED_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const issue = await Store.getIssueById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Wing scoping check for coordinator
    if (req.user.role === 'coordinator' && issue.wingId) {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const issueWingId = String(issue.wingId?._id || issue.wingId || '');
      if (coordWingId && issueWingId && coordWingId !== issueWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators cannot update issues assigned to other wings.'
        });
      }
    }

    const previousStatus = issue.status;

    // If status is unchanged, return early
    if (previousStatus === cleanStatus) {
      return res.json({
        message: `Issue is already set to status '${cleanStatus}'`,
        issue
      });
    }

    const updatedIssue = await Store.updateIssue(req.params.id, {
      status: cleanStatus
    });

    // Create AuditLog entry using existing AuditLog pattern
    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'UPDATE_ISSUE_STATUS',
      module: 'CommunityIssues',
      recordId: issue.issueCode,
      details: `Status changed from '${previousStatus}' to '${cleanStatus}' for issue ${issue.issueCode} ("${issue.title}")`
    });

    // Send transactional email to reporter if transition matches and contact is a valid email
    if (
      (previousStatus === 'pending' && cleanStatus === 'in_progress') ||
      (previousStatus === 'in_progress' && cleanStatus === 'resolved')
    ) {
      if (isValidEmail(issue.reporterContact)) {
        try {
          await sendIssueStatusEmail({
            to: issue.reporterContact,
            reporterName: issue.reporterName,
            issueCode: issue.issueCode,
            issueTitle: issue.title,
            status: cleanStatus,
            previousStatus
          });
        } catch (err) {
          console.error('[EmailService Error] Failed to send issue status update email:', err.message);
        }
      }
    }

    res.json({
      message: 'Issue status updated successfully',
      previousStatus,
      newStatus: cleanStatus,
      issue: updatedIssue
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/issues/:id/assign
 * Admin & Coordinator only.
 * Assigns an issue to a user and/or wing. Validates assigned user and coordinator permissions.
 */
router.patch('/:id/assign', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { assignedTo, wingId } = req.body;

    const issue = await Store.getIssueById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Wing scoping check for coordinator
    if (req.user.role === 'coordinator' && issue.wingId) {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const issueWingId = String(issue.wingId?._id || issue.wingId || '');
      if (coordWingId && issueWingId && coordWingId !== issueWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators cannot modify issues assigned to other wings.'
        });
      }
    }

    let assignedUser = null;
    if (assignedTo) {
      assignedUser = await Store.getUserById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({ error: 'Assigned user does not exist' });
      }

      // Respect coordinator permissions: coordinator cannot assign to users belonging to different wings
      if (req.user.role === 'coordinator') {
        const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
        const targetWingId = String(assignedUser.assignedWing?._id || assignedUser.assignedWing || '');
        if (targetWingId && coordWingId && targetWingId !== coordWingId) {
          return res.status(403).json({
            error: 'Forbidden: Coordinators can only assign issues to personnel in their assigned wing.'
          });
        }
      }
    }

    let targetWing = null;
    if (wingId) {
      targetWing = await Store.getWingById(wingId);
      if (!targetWing) {
        return res.status(400).json({ error: 'Referenced wing does not exist' });
      }
      if (req.user.role === 'coordinator') {
        const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
        if (coordWingId && String(targetWing._id) !== coordWingId) {
          return res.status(403).json({
            error: 'Forbidden: Coordinators cannot assign issues to another wing.'
          });
        }
      }
    }

    const updateData = {};
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo || null;
    }
    if (wingId !== undefined) {
      updateData.wingId = wingId || null;
    }

    const updatedIssue = await Store.updateIssue(req.params.id, updateData);

    // Create AuditLog entry
    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'ASSIGN_ISSUE',
      module: 'CommunityIssues',
      recordId: issue.issueCode,
      details: assignedUser
        ? `Assigned issue ${issue.issueCode} to ${assignedUser.name} (${assignedUser.role})`
        : `Unassigned issue ${issue.issueCode}`
    });

    res.json({
      message: 'Issue assignment updated successfully',
      issue: updatedIssue
    });
  } catch (err) {
    next(err);
  }
});

export default router;
