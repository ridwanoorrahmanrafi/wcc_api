import express from 'express';
import { Store } from '../data/store.js';

const router = express.Router();

router.get('/impact', async (req, res, next) => {
  try {
    res.json(await Store.getImpactStats());
  } catch (err) {
    next(err);
  }
});

export default router;