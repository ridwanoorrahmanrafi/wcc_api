import express from 'express';
import { Store } from '../data/store.js';

const router = express.Router();

// Get demographic stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Store.getMemberStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Public Member Verification endpoint (Safe non-PII for QR scanning)
router.get('/verify/:id', async (req, res, next) => {
  try {
    const member = await Store.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({
        verified: false,
        message: 'Member record not found in official WCC registry'
      });
    }

    res.json({
      verified: true,
      memberId: member.memberId,
      nameBn: member.nameBn,
      nameEn: member.nameEn,
      wing: member.wing,
      membership: member.membership,
      status: member.status,
      photoUrl: member.photoUrl,
      joinedDate: member.joinedDate || member.createdAt,
      message: 'Official active membership verified'
    });
  } catch (err) {
    next(err);
  }
});

// List members with search, filters, pagination
router.get('/', async (req, res, next) => {
  try {
    const { search, wing, blood, status, profession, page = 1, limit = 50 } = req.query;
    const result = await Store.getMembers({ search, wing, blood, status, profession, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Member Requests (Wing change or Become Volunteer)
router.post('/requests', async (req, res, next) => {
  try {
    const { userId, memberId, memberName, memberEmail, type, currentWing, requestedWing, volunteerInterests, reason } = req.body;
    if (!memberId || !type) {
      return res.status(400).json({ error: 'memberId and request type are required' });
    }

    const newRequest = await Store.createMemberRequest({
      userId: userId || req.user?.id,
      memberId,
      memberName: memberName || 'Member',
      memberEmail: memberEmail || '',
      type,
      currentWing: currentWing || 'সাধারণ উইং',
      requestedWing: requestedWing || '',
      volunteerInterests: volunteerInterests || [],
      reason: reason || '',
      status: 'pending'
    });

    await Store.addAuditLog({
      action: 'SUBMIT_MEMBER_REQUEST',
      module: 'Membership',
      recordId: memberId,
      details: `Submitted ${type} request for ${memberName} (${memberId})`
    });

    res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
});

router.get('/requests', async (req, res, next) => {
  try {
    const { type, status, userId, memberId, limit } = req.query;
    if (userId || memberId) {
      const myRequests = await Store.getMemberRequestsByUserId(userId, memberId);
      return res.json(myRequests);
    }
    const requests = await Store.getMemberRequests({ type, status, limit });
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

router.patch('/requests/:id', async (req, res, next) => {
  try {
    const { status, adminNotes, reviewedBy } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await Store.reviewMemberRequest(req.params.id, {
      status,
      adminNotes,
      reviewedBy: reviewedBy || req.user?.name || 'Admin'
    });

    if (!updated) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await Store.addAuditLog({
      action: status === 'approved' ? 'APPROVE_MEMBER_REQUEST' : 'REJECT_MEMBER_REQUEST',
      module: 'Membership',
      recordId: updated.memberId,
      details: `${status.toUpperCase()} ${updated.type} request for ${updated.memberName} (${updated.memberId})`
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Get single member details
router.get('/:id', async (req, res, next) => {
  try {
    const member = await Store.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (err) {
    next(err);
  }
});

// Create new member (Application / Registration)
router.post('/', async (req, res, next) => {
  try {
    const { nameBn, nameEn, mobile, email } = req.body;
    if (!nameBn || !nameEn || !mobile) {
      return res.status(400).json({ error: 'Name (Bengali & English) and Mobile number are required' });
    }

    const newMember = await Store.createMember(req.body);
    await Store.addAuditLog({
      action: 'REGISTER_MEMBER',
      module: 'Membership',
      recordId: newMember.memberId,
      details: `New member registered: ${newMember.nameEn} (${newMember.memberId})`
    });

    res.status(201).json({
      message: 'Member registered successfully',
      member: newMember
    });
  } catch (err) {
    next(err);
  }
});

// Update member details
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await Store.updateMember(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await Store.addAuditLog({
      action: 'UPDATE_MEMBER',
      module: 'Membership',
      recordId: updated.memberId,
      details: `Updated details for member: ${updated.nameEn}`
    });

    res.json({
      message: 'Member updated successfully',
      member: updated
    });
  } catch (err) {
    next(err);
  }
});

// Update member status (Active, Pending, Inactive, Suspended)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updated = await Store.updateMember(req.params.id, { status });
    if (!updated) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await Store.addAuditLog({
      action: 'UPDATE_STATUS',
      module: 'Membership',
      recordId: updated.memberId,
      details: `Changed status of ${updated.memberId} to ${status}`
    });

    res.json({
      message: 'Status updated successfully',
      member: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete member
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Store.deleteMember(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await Store.addAuditLog({
      action: 'DELETE_MEMBER',
      module: 'Membership',
      recordId: deleted.memberId,
      details: `Deleted member ${deleted.nameEn} (${deleted.memberId})`
    });

    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
