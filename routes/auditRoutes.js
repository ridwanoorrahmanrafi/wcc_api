import express from 'express';
import { Store } from '../data/store.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await Store.getAuditLogs(limit);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
