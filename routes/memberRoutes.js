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
