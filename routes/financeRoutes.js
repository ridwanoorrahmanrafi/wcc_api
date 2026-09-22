import express from 'express';
import { Store } from '../data/store.js';

const router = express.Router();

// Executive Financial Dashboard KPIs
router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboardData = await Store.getFinanceDashboard();
    res.json(dashboardData);
  } catch (err) {
    next(err);
  }
});

// Accounts (Cash, Bank, MFS)
router.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await Store.getAccounts();
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

router.post('/accounts', async (req, res, next) => {
  try {
    const { name, accountType } = req.body;
    if (!name || !accountType) {
      return res.status(400).json({ error: 'Account name and type are required' });
    }
    const acc = await Store.createAccount(req.body);
    await Store.addAuditLog({
      action: 'CREATE_ACCOUNT',
      module: 'Finance',
      recordId: acc.accountId,
      details: `Created new account: ${acc.name} (${acc.accountType})`
    });
    res.status(201).json(acc);
  } catch (err) {
    next(err);
  }
});

// Transactions / Central Ledger
router.get('/transactions', async (req, res, next) => {
  try {
    const { category, type, activityId, limit } = req.query;
    const txns = await Store.getTransactions({ category, type, activityId, limit });
    res.json(txns);
  } catch (err) {
    next(err);
  }
});

router.post('/transactions', async (req, res, next) => {
  try {
    const { date, type, category, description, amount } = req.body;
    if (!date || !type || !category || !description || !amount) {
      return res.status(400).json({ error: 'Date, type, category, description, and amount are required' });
    }
    const txn = await Store.createTransaction(req.body);
    res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
});

// Income & Inflows
router.get('/income', async (req, res, next) => {
  try {
    const income = await Store.getIncome();
    res.json(income);
  } catch (err) {
    next(err);
  }
});

router.post('/income', async (req, res, next) => {
  try {
    const { date, sourceOrDonor, amount } = req.body;
    if (!date || !sourceOrDonor || !amount) {
      return res.status(400).json({ error: 'Date, donor/source, and amount are required' });
    }
    const record = await Store.createIncome(req.body);
    await Store.addAuditLog({
      action: 'RECORD_INCOME',
      module: 'Finance',
      recordId: record.incomeId,
      details: `Recorded income ${record.amount} BDT from ${record.sourceOrDonor}`
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// Expenses
router.get('/expenses', async (req, res, next) => {
  try {
    const expenses = await Store.getExpenses();
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.post('/expenses', async (req, res, next) => {
  try {
    const { date, category, description, amount } = req.body;
    if (!date || !category || !description || !amount) {
      return res.status(400).json({ error: 'Date, category, description, and amount are required' });
    }
    const record = await Store.createExpense(req.body);
    await Store.addAuditLog({
      action: 'RECORD_EXPENSE',
      module: 'Finance',
      recordId: record.expenseId,
      details: `Recorded expense ${record.amount} BDT for ${record.description}`
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// Activities
router.get('/activities', async (req, res, next) => {
  try {
    const activities = await Store.getActivities();
    res.json(activities);
  } catch (err) {
    next(err);
  }
});

router.post('/activities', async (req, res, next) => {
  try {
    const { name, budget } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Activity name is required' });
    }
    const act = await Store.createActivity(req.body);
    await Store.addAuditLog({
      action: 'CREATE_ACTIVITY',
      module: 'Finance',
      recordId: act.activityId,
      details: `Created activity ${act.name} with budget ${budget || 0} BDT`
    });
    res.status(201).json(act);
  } catch (err) {
    next(err);
  }
});

router.get('/activities/:id', async (req, res, next) => {
  try {
    const act = await Store.getActivityById(req.params.id);
    if (!act) return res.status(404).json({ error: 'Activity not found' });
    res.json(act);
  } catch (err) {
    next(err);
  }
});

// Activity Financial Statement
router.get('/activities/:id/statement', async (req, res, next) => {
  try {
    const act = await Store.getActivityById(req.params.id);
    if (!act) return res.status(404).json({ error: 'Activity not found' });

    const allExpenses = await Store.getExpenses();
    const activityExpenses = allExpenses.filter(e => e.activityId === req.params.id);

    const totalSpent = activityExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const variance = (act.budget || 0) - totalSpent;

    const categoryBreakdown = {};
    activityExpenses.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
    });

    res.json({
      activity: act,
      statementDate: new Date().toISOString().split('T')[0],
      totalBudget: act.budget || 0,
      totalSpent,
      variance,
      varianceType: variance >= 0 ? 'Under Budget (Surplus)' : 'Over Budget (Deficit)',
      categoryBreakdown,
      itemizedExpenses: activityExpenses
    });
  } catch (err) {
    next(err);
  }
});

// Reimbursements
router.get('/reimbursements', async (req, res, next) => {
  try {
    const claims = await Store.getReimbursements();
    res.json(claims);
  } catch (err) {
    next(err);
  }
});

router.post('/reimbursements', async (req, res, next) => {
  try {
    const { memberName, description, amount, requestDate } = req.body;
    if (!memberName || !description || !amount) {
      return res.status(400).json({ error: 'Member name, description, and amount are required' });
    }
    const claim = await Store.createReimbursement({
      ...req.body,
      requestDate: requestDate || new Date().toISOString().split('T')[0]
    });
    res.status(201).json(claim);
  } catch (err) {
    next(err);
  }
});

router.patch('/reimbursements/:id/status', async (req, res, next) => {
  try {
    const { approvalStatus, paymentAccountId, paymentDate, paymentReference, paymentMethod } = req.body;
    const updated = await Store.updateReimbursementStatus(req.params.id, {
      approvalStatus,
      paymentAccountId,
      paymentDate,
      paymentReference,
      paymentMethod
    });
    if (!updated) return res.status(404).json({ error: 'Reimbursement record not found' });

    await Store.addAuditLog({
      action: 'UPDATE_REIMBURSEMENT',
      module: 'Finance',
      recordId: req.params.id,
      details: `Reimbursement status updated to ${approvalStatus}`
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Advances & Settlements
router.get('/advances', async (req, res, next) => {
  try {
    const advances = await Store.getAdvances();
    res.json(advances);
  } catch (err) {
    next(err);
  }
});

router.post('/advances', async (req, res, next) => {
  try {
    const { memberName, activityId, purpose, advanceAmount } = req.body;
    if (!memberName || !purpose || !advanceAmount) {
      return res.status(400).json({ error: 'Member, purpose, and amount are required' });
    }
    const adv = await Store.createAdvance({
      ...req.body,
      disbursementDate: req.body.disbursementDate || new Date().toISOString().split('T')[0]
    });
    res.status(201).json(adv);
  } catch (err) {
    next(err);
  }
});

router.post('/advances/:id/settle', async (req, res, next) => {
  try {
    const { actualExpenseSubmitted, notes } = req.body;
    if (actualExpenseSubmitted === undefined) {
      return res.status(400).json({ error: 'Actual expense submitted is required' });
    }
    const settled = await Store.settleAdvance(req.params.id, {
      actualExpenseSubmitted: Number(actualExpenseSubmitted),
      notes
    });
    if (!settled) return res.status(404).json({ error: 'Advance not found' });

    await Store.addAuditLog({
      action: 'SETTLE_ADVANCE',
      module: 'Finance',
      recordId: req.params.id,
      details: `Settled advance: expense submitted ${actualExpenseSubmitted} BDT (${settled.settlementType})`
    });

    res.json(settled);
  } catch (err) {
    next(err);
  }
});

// Vendors
router.get('/vendors', async (req, res, next) => {
  try {
    const vendors = await Store.getVendors();
    res.json(vendors);
  } catch (err) {
    next(err);
  }
});

export default router;
