import { isDatabaseConnected } from '../config/db.js';
import User from '../models/User.js';
import Member from '../models/Member.js';
import Account from '../models/Account.js';
import Activity from '../models/Activity.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Reimbursement from '../models/Reimbursement.js';
import Advance from '../models/Advance.js';
import Vendor from '../models/Vendor.js';
import AuditLog from '../models/AuditLog.js';
import bcrypt from 'bcryptjs';

// Empty in-memory fallback cache (used only if MongoDB is offline)
const memoryStore = {
  users: [],
  members: [],
  accounts: [],
  activities: [],
  transactions: [],
  income: [],
  expenses: [],
  reimbursements: [],
  advances: [],
  vendors: [],
  auditLogs: []
};

export const Store = {
  // Members
  async getMembers({ search, wing, blood, status, profession, page = 1, limit = 50 }) {
    if (isDatabaseConnected()) {
      const query = {};
      if (status && status !== 'All') query.status = status;
      if (wing && wing !== 'All') query.wing = wing;
      if (blood && blood !== 'All') query.blood = blood;
      if (profession && profession !== 'All') query.profession = profession;
      if (search) {
        query.$or = [
          { nameEn: { $regex: search, $options: 'i' } },
          { nameBn: { $regex: search, $options: 'i' } },
          { memberId: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { profession: { $regex: search, $options: 'i' } }
        ];
      }
      const skip = (Number(page) - 1) * Number(limit);
      const total = await Member.countDocuments(query);
      const members = await Member.find(query).sort({ memberId: 1 }).skip(skip).limit(Number(limit));
      return { total, page: Number(page), limit: Number(limit), members };
    }

    // Memory fallback
    let list = [...memoryStore.members];
    if (status && status !== 'All') list = list.filter(m => m.status === status);
    if (wing && wing !== 'All') list = list.filter(m => m.wing === wing);
    if (blood && blood !== 'All') list = list.filter(m => m.blood === blood);
    if (profession && profession !== 'All') list = list.filter(m => m.profession === profession);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        m =>
          (m.nameEn && m.nameEn.toLowerCase().includes(s)) ||
          (m.nameBn && m.nameBn.includes(s)) ||
          (m.memberId && m.memberId.toLowerCase().includes(s)) ||
          (m.mobile && m.mobile.includes(s)) ||
          (m.email && m.email.toLowerCase().includes(s)) ||
          (m.profession && m.profession.toLowerCase().includes(s))
      );
    }
    const total = list.length;
    const start = (Number(page) - 1) * Number(limit);
    const members = list.slice(start, start + Number(limit));
    return { total, page: Number(page), limit: Number(limit), members };
  },

  async getMemberById(id) {
    if (isDatabaseConnected()) {
      return await Member.findOne({ $or: [{ memberId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    }
    return memoryStore.members.find(m => m.memberId === id || m._id === id) || null;
  },

  async createMember(data) {
    if (!data.memberId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Member.countDocuments() : memoryStore.members.length;
      data.memberId = `WCC-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    if (isDatabaseConnected()) {
      return await Member.create(data);
    }
    const newMember = { ...data, _id: 'mbr_' + Date.now(), createdAt: new Date() };
    memoryStore.members.unshift(newMember);
    return newMember;
  },

  async updateMember(id, data) {
    if (isDatabaseConnected()) {
      return await Member.findOneAndUpdate(
        { $or: [{ memberId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        data,
        { new: true }
      );
    }
    const idx = memoryStore.members.findIndex(m => m.memberId === id || m._id === id);
    if (idx !== -1) {
      memoryStore.members[idx] = { ...memoryStore.members[idx], ...data, updatedAt: new Date() };
      return memoryStore.members[idx];
    }
    return null;
  },

  async deleteMember(id) {
    if (isDatabaseConnected()) {
      return await Member.findOneAndDelete({ $or: [{ memberId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    }
    const idx = memoryStore.members.findIndex(m => m.memberId === id || m._id === id);
    if (idx !== -1) {
      const removed = memoryStore.members.splice(idx, 1);
      return removed[0];
    }
    return null;
  },

  async getMemberStats() {
    let allMembers = [];
    if (isDatabaseConnected()) {
      allMembers = await Member.find({});
    } else {
      allMembers = memoryStore.members;
    }

    const total = allMembers.length;
    const active = allMembers.filter(m => m.status === 'Active').length;
    const pending = allMembers.filter(m => m.status === 'Pending').length;
    const inactive = allMembers.filter(m => m.status === 'Inactive').length;
    const students = allMembers.filter(m => m.currentlyStudying === 'হ্যাঁ' || m.currentlyStudying === 'Yes').length;
    const professionals = total - students;

    const bloodGroups = {};
    const wings = {};
    const upazilas = {};

    allMembers.forEach(m => {
      const b = m.blood || 'Unknown';
      bloodGroups[b] = (bloodGroups[b] || 0) + 1;

      const w = m.wing || 'সাধারণ উইং';
      wings[w] = (wings[w] || 0) + 1;

      const u = m.upazila || 'ঝালকাঠি সদর';
      upazilas[u] = (upazilas[u] || 0) + 1;
    });

    return {
      total,
      active,
      pending,
      inactive,
      students,
      professionals,
      bloodGroups,
      wings,
      upazilas
    };
  },

  // Accounts
  async getAccounts() {
    if (isDatabaseConnected()) return await Account.find({}).sort({ createdAt: 1 });
    return memoryStore.accounts;
  },

  async createAccount(data) {
    if (!data.accountId) {
      const count = isDatabaseConnected() ? await Account.countDocuments() : memoryStore.accounts.length;
      data.accountId = `WCC-ACC-${String(count + 1).padStart(6, '0')}`;
    }
    if (isDatabaseConnected()) return await Account.create(data);
    const newAcc = { ...data, _id: 'acc_' + Date.now(), currentBalance: data.openingBalance || 0 };
    memoryStore.accounts.push(newAcc);
    return newAcc;
  },

  // Activities
  async getActivities() {
    if (isDatabaseConnected()) return await Activity.find({}).sort({ startDate: -1 });
    return memoryStore.activities;
  },

  async getActivityById(id) {
    if (isDatabaseConnected()) return await Activity.findOne({ activityId: id });
    return memoryStore.activities.find(a => a.activityId === id);
  },

  async createActivity(data) {
    if (!data.activityId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Activity.countDocuments() : memoryStore.activities.length;
      data.activityId = `WCC-ACT-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    if (isDatabaseConnected()) return await Activity.create(data);
    const newAct = { ...data, _id: 'act_' + Date.now() };
    memoryStore.activities.unshift(newAct);
    return newAct;
  },

  // Transactions
  async getTransactions({ category, type, activityId, limit = 100 }) {
    if (isDatabaseConnected()) {
      const query = {};
      if (category && category !== 'All') query.category = category;
      if (type && type !== 'All') query.type = type;
      if (activityId && activityId !== 'All') query.activityId = activityId;
      return await Transaction.find(query).sort({ date: -1 }).limit(Number(limit));
    }
    let list = [...memoryStore.transactions];
    if (category && category !== 'All') list = list.filter(t => t.category === category);
    if (type && type !== 'All') list = list.filter(t => t.type === type);
    if (activityId && activityId !== 'All') list = list.filter(t => t.activityId === activityId);
    return list.slice(0, Number(limit));
  },

  async createTransaction(data) {
    if (!data.transactionId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Transaction.countDocuments() : memoryStore.transactions.length;
      data.transactionId = `WCC-TXN-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    if (isDatabaseConnected()) {
      const txn = await Transaction.create(data);
      // Update account balance
      if (data.accountId && data.amount) {
        const delta = data.type === 'Income' ? data.amount : -data.amount;
        await Account.findOneAndUpdate({ accountId: data.accountId }, { $inc: { currentBalance: delta } });
      }
      return txn;
    }
    const newTxn = { ...data, _id: 'txn_' + Date.now() };
    memoryStore.transactions.unshift(newTxn);
    if (data.accountId && data.amount) {
      const acc = memoryStore.accounts.find(a => a.accountId === data.accountId);
      if (acc) {
        acc.currentBalance += data.type === 'Income' ? data.amount : -data.amount;
      }
    }
    return newTxn;
  },

  // Income
  async getIncome() {
    if (isDatabaseConnected()) return await Income.find({}).sort({ date: -1 });
    return memoryStore.income;
  },

  async createIncome(data) {
    if (!data.incomeId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Income.countDocuments() : memoryStore.income.length;
      data.incomeId = `WCC-INC-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    // Also record in master ledger
    await this.createTransaction({
      date: data.date,
      type: 'Income',
      activityId: data.activityId,
      activityName: data.activityName,
      category: data.incomeType || 'Donation',
      description: data.remarks || `Income from ${data.sourceOrDonor}`,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      accountId: data.accountId,
      accountName: data.accountName,
      receivedFrom: data.sourceOrDonor,
      referenceNo: data.referenceNo,
      createdBy: data.createdBy
    });

    if (isDatabaseConnected()) return await Income.create(data);
    const newInc = { ...data, _id: 'inc_' + Date.now() };
    memoryStore.income.unshift(newInc);
    return newInc;
  },

  // Expenses
  async getExpenses() {
    if (isDatabaseConnected()) return await Expense.find({}).sort({ date: -1 });
    return memoryStore.expenses;
  },

  async createExpense(data) {
    if (!data.expenseId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Expense.countDocuments() : memoryStore.expenses.length;
      data.expenseId = `WCC-EXP-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    // Record in master transaction ledger
    await this.createTransaction({
      date: data.date,
      type: 'Expense',
      activityId: data.activityId,
      activityName: data.activityName,
      category: data.category,
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      accountId: data.accountId,
      accountName: data.accountName,
      paidBy: data.paidBy,
      vendorOrMember: data.vendorOrMember,
      referenceNo: data.referenceNo,
      status: data.isPersonalExpense ? 'Pending Reimbursement' : 'Paid',
      createdBy: data.createdBy
    });

    if (isDatabaseConnected()) return await Expense.create(data);
    const newExp = { ...data, _id: 'exp_' + Date.now() };
    memoryStore.expenses.unshift(newExp);
    return newExp;
  },

  // Reimbursements
  async getReimbursements() {
    if (isDatabaseConnected()) return await Reimbursement.find({}).sort({ requestDate: -1 });
    return memoryStore.reimbursements;
  },

  async createReimbursement(data) {
    if (!data.reimbursementId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Reimbursement.countDocuments() : memoryStore.reimbursements.length;
      data.reimbursementId = `WCC-REIM-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    if (isDatabaseConnected()) return await Reimbursement.create(data);
    const newReim = { ...data, _id: 'reim_' + Date.now() };
    memoryStore.reimbursements.unshift(newReim);
    return newReim;
  },

  async updateReimbursementStatus(id, { approvalStatus, paymentAccountId, paymentDate, paymentReference, paymentMethod }) {
    const updateData = { approvalStatus };
    if (paymentDate) updateData.paymentDate = paymentDate;
    if (paymentAccountId) updateData.paymentAccountId = paymentAccountId;
    if (paymentReference) updateData.paymentReference = paymentReference;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;

    if (isDatabaseConnected()) {
      return await Reimbursement.findOneAndUpdate({ reimbursementId: id }, updateData, { new: true });
    }
    const reim = memoryStore.reimbursements.find(r => r.reimbursementId === id);
    if (reim) {
      Object.assign(reim, updateData);
      return reim;
    }
    return null;
  },

  // Advances
  async getAdvances() {
    if (isDatabaseConnected()) return await Advance.find({}).sort({ disbursementDate: -1 });
    return memoryStore.advances;
  },

  async createAdvance(data) {
    if (!data.advanceId) {
      const year = new Date().getFullYear();
      const count = isDatabaseConnected() ? await Advance.countDocuments() : memoryStore.advances.length;
      data.advanceId = `WCC-ADV-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    if (isDatabaseConnected()) return await Advance.create(data);
    const newAdv = { ...data, _id: 'adv_' + Date.now() };
    memoryStore.advances.unshift(newAdv);
    return newAdv;
  },

  async settleAdvance(id, { actualExpenseSubmitted, settlementType, notes }) {
    const advance = isDatabaseConnected()
      ? await Advance.findOne({ advanceId: id })
      : memoryStore.advances.find(a => a.advanceId === id);

    if (!advance) return null;

    const diff = advance.advanceAmount - actualExpenseSubmitted;
    const updateData = {
      actualExpenseSubmitted,
      settlementBalance: Math.abs(diff),
      settlementType: diff >= 0 ? 'Refund Received' : 'Additional Reimbursement',
      status: 'Settled',
      notes
    };

    if (isDatabaseConnected()) {
      return await Advance.findOneAndUpdate({ advanceId: id }, updateData, { new: true });
    }
    Object.assign(advance, updateData);
    return advance;
  },

  // Vendors
  async getVendors() {
    if (isDatabaseConnected()) return await Vendor.find({}).sort({ name: 1 });
    return memoryStore.vendors;
  },

  // Finance Dashboard KPIs
  async getFinanceDashboard() {
    let accounts = [];
    let transactions = [];
    let income = [];
    let expenses = [];
    let reimbursements = [];
    let activities = [];

    if (isDatabaseConnected()) {
      accounts = await Account.find({});
      transactions = await Transaction.find({}).sort({ date: -1 }).limit(10);
      income = await Income.find({});
      expenses = await Expense.find({});
      reimbursements = await Reimbursement.find({});
      activities = await Activity.find({});
    } else {
      accounts = memoryStore.accounts;
      transactions = memoryStore.transactions.slice(0, 10);
      income = memoryStore.income;
      expenses = memoryStore.expenses;
      reimbursements = memoryStore.reimbursements;
      activities = memoryStore.activities;
    }

    const totalLiquidity = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const totalIncome = income.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingClaims = reimbursements
      .filter(r => r.approvalStatus === 'Submitted' || r.approvalStatus === 'Verified')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // Spend by category
    const categorySpend = {};
    expenses.forEach(e => {
      categorySpend[e.category] = (categorySpend[e.category] || 0) + (e.amount || 0);
    });

    return {
      totalLiquidity,
      totalIncome,
      totalExpense,
      pendingClaims,
      netReserve: totalIncome - totalExpense,
      accountsSummary: accounts.map(a => ({
        id: a.accountId,
        name: a.name,
        type: a.accountType,
        balance: a.currentBalance
      })),
      categorySpend,
      recentTransactions: transactions,
      activitiesSummary: activities.map(act => ({
        id: act.activityId,
        name: act.name,
        budget: act.budget,
        actualExpense: act.actualExpense,
        status: act.status
      }))
    };
  },

  // Users & Auth
  async findUserByEmail(email) {
    if (isDatabaseConnected()) {
      return await User.findOne({ email: email.toLowerCase() });
    }
    return memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  async createUser(userData) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    const newUser = {
      ...userData,
      email: userData.email.toLowerCase(),
      password: hashedPassword
    };

    if (isDatabaseConnected()) {
      return await User.create(newUser);
    }
    const created = { ...newUser, _id: 'usr_' + Date.now() };
    memoryStore.users.push(created);
    return created;
  },

  // Audit Logs
  async getAuditLogs(limit = 50) {
    if (isDatabaseConnected()) {
      return await AuditLog.find({}).sort({ timestamp: -1 }).limit(Number(limit));
    }
    return memoryStore.auditLogs.slice(0, Number(limit));
  },

  async addAuditLog({ user, role, action, module, recordId, details }) {
    const logData = {
      logId: 'LOG-' + Date.now(),
      timestamp: new Date(),
      user: user || 'system',
      role: role || 'admin',
      action,
      module,
      recordId,
      details
    };
    if (isDatabaseConnected()) {
      return await AuditLog.create(logData);
    }
    memoryStore.auditLogs.unshift(logData);
    return logData;
  }
};
