import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin manually invites/appoints a member to Volunteer or Coordinator
router.post('/invite', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const {
      recipientUserId,
      recipientMemberId,
      recipientEmail,
      recipientName,
      targetRole,
      targetWing,
      targetWingId,
      note
    } = req.body;

    if (!recipientEmail && !recipientMemberId) {
      return res.status(400).json({ error: 'Recipient email or memberId is required' });
    }

    if (!['volunteer', 'coordinator'].includes(targetRole)) {
      return res.status(400).json({ error: 'targetRole must be volunteer or coordinator' });
    }

    const wingLabel = targetWing || 'General Operations';
    const roleLabel = targetRole === 'coordinator' ? 'Wing Coordinator' : 'Volunteer';

    const defaultTitle = targetRole === 'coordinator'
      ? `🌟 Leadership Appointment: Wing Coordinator`
      : `🎉 Volunteer Corps Nomination: You're Invited to Join!`;

    const defaultMessage = targetRole === 'coordinator'
      ? `Administration has nominated you to lead as Coordinator for ${wingLabel}. Please accept or decline this appointment.`
      : `Administration has nominated you to join the Volunteer Corps under ${wingLabel}. Please accept or decline this role.`;

    const notif = await Store.createNotification({
      recipientUserId: recipientUserId || null,
      recipientMemberId: recipientMemberId || '',
      recipientEmail: recipientEmail || '',
      recipientName: recipientName || '',
      senderId: req.user?.id || 'admin',
      senderName: req.user?.name || 'WCC Central Administration',
      type: 'role_invitation',
      title: defaultTitle,
      message: note?.trim() ? `${defaultMessage}\n\nNote from Administration: "${note.trim()}"` : defaultMessage,
      targetRole,
      targetWing: wingLabel,
      targetWingId: targetWingId || '',
      status: 'pending',
      adminNotes: note?.trim() || ''
    });

    await Store.addAuditLog({
      action: 'SEND_ROLE_INVITATION',
      module: 'Administration',
      recordId: notif._id,
      details: `Admin ${req.user?.name || 'Admin'} sent ${roleLabel} invitation to ${recipientName || recipientEmail} (${wingLabel})`
    });

    res.status(201).json({
      message: `Role invitation sent to ${recipientName || recipientEmail} successfully`,
      notification: notif
    });
  } catch (err) {
    next(err);
  }
});

// Current user retrieves their notifications (including pending role invitations)
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    const notifications = await Store.getMyNotifications({
      userId: req.user?.id || req.user?._id,
      memberId: req.user?.memberId,
      email: req.user?.email,
      status: req.query.status
    });

    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// Current user responds to a role invitation (accept or reject)
router.post('/:id/respond', verifyToken, async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or reject' });
    }

    const result = await Store.respondToRoleInvitation(req.params.id, {
      action,
      recipientUser: req.user
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await Store.addAuditLog({
      action: action === 'accept' ? 'ACCEPT_ROLE_INVITATION' : 'REJECT_ROLE_INVITATION',
      module: 'Membership',
      recordId: result.notification._id,
      details: `User ${req.user.name} (${req.user.email}) ${action}ed invitation for ${result.notification.targetRole} (${result.notification.targetWing})`
    });

    res.json({
      message: action === 'accept'
        ? `Congratulations! You are now a ${result.notification.targetRole === 'coordinator' ? 'Wing Coordinator' : 'Volunteer'}.`
        : 'Role invitation declined.',
      notification: result.notification,
      user: result.user
    });
  } catch (err) {
    next(err);
  }
});

// Admin views all role invitations
router.get('/invitations', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const invitations = await Store.getRoleInvitations({
      status: req.query.status,
      targetRole: req.query.targetRole,
      limit: req.query.limit
    });
    res.json(invitations);
  } catch (err) {
    next(err);
  }
});

// Mark notification as read
router.patch('/:id/read', verifyToken, async (req, res, next) => {
  try {
    const updated = await Store.markNotificationRead(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
