import express from 'express';
import { Store } from '../data/store.js';
import { getSentEmails, clearSentEmails } from '../services/emailService.js';

const router = express.Router();

/**
 * GET /api/stats/impact
 *
 * Returns grassroots community impact metrics:
 * - totalPrograms: number of valid Program records
 * - totalVolunteers: count using the existing Volunteer/User architecture (role: 'volunteer')
 * - resolvedIssues: count of Issue records where status = "resolved"
 */
router.get('/impact', async (req, res, next) => {
  try {
    const stats = await Store.getImpactStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Test verification endpoint for development & automated tests
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-emails', (req, res) => {
    res.json({ emails: getSentEmails() });
  });

  router.delete('/test-emails', (req, res) => {
    clearSentEmails();
    res.json({ message: 'Sent email log cleared' });
  });
}

export default router;

