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
import MemberRequest from '../models/MemberRequest.js';
import Wing from '../models/Wing.js';
import Program from '../models/Program.js';
import Event from '../models/Event.js';
import Issue from '../models/Issue.js';
import EventRegistration from '../models/EventRegistration.js';
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
  auditLogs: [],
  requests: [],
  wings: [],
  programs: [],
  events: [],
  issues: [],
  issueCounter: 0,
  registrations: []
};

export const Store = {
  // Wings, Programs, and Events
  async getWings() {
    if (isDatabaseConnected()) return await Wing.find({}).sort({ nameEn: 1 });
    return memoryStore.wings;
  },

  async getWingBySlug(slug) {
    if (isDatabaseConnected()) return await Wing.findOne({ slug: String(slug).toLowerCase() });
    return memoryStore.wings.find(wing => wing.slug === String(slug).toLowerCase()) || null;
  },

  async getWingById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) return await Wing.findById(id);
    return memoryStore.wings.find(wing => String(wing._id) === String(id)) || null;
  },

  async createWing(data) {
    if (isDatabaseConnected()) return await Wing.create(data);
    const wing = { ...data, slug: String(data.slug).toLowerCase(), _id: `wing_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date(), updatedAt: new Date() };
    memoryStore.wings.push(wing);
    return wing;
  },

  async updateWing(id, data) {
    if (isDatabaseConnected()) return await Wing.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    const wing = await this.getWingById(id);
    if (!wing) return null;
    Object.assign(wing, data, data.slug ? { slug: String(data.slug).toLowerCase() } : {}, { updatedAt: new Date() });
    return wing;
  },

  async deleteWing(id) {
    if (isDatabaseConnected()) return await Wing.findByIdAndDelete(id);
    const index = memoryStore.wings.findIndex(wing => String(wing._id) === String(id));
    return index === -1 ? null : memoryStore.wings.splice(index, 1)[0];
  },

  async getPrograms({ wingId, publicOnly = false } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (wingId) query.wingId = wingId;
      if (publicOnly) query.status = 'published';
      return await Program.find(query).populate('wingId').sort({ startDate: 1, createdAt: -1 });
    }
    return memoryStore.programs.filter(program => (!wingId || String(program.wingId) === String(wingId)) && (!publicOnly || program.status === 'published'));
  },

  async getProgramById(id) {
    if (isDatabaseConnected()) return await Program.findById(id).populate('wingId');
    return memoryStore.programs.find(program => String(program._id) === String(id)) || null;
  },

  async createProgram(data) {
    if (isDatabaseConnected()) return await Program.create(data);
    const program = { ...data, _id: `program_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date(), updatedAt: new Date() };
    memoryStore.programs.push(program);
    return program;
  },

  async updateProgram(id, data) {
    if (isDatabaseConnected()) return await Program.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    const program = await this.getProgramById(id);
    if (!program) return null;
    Object.assign(program, data, { updatedAt: new Date() });
    return program;
  },

  async deleteProgram(id) {
    if (isDatabaseConnected()) return await Program.findByIdAndDelete(id);
    const index = memoryStore.programs.findIndex(program => String(program._id) === String(id));
    return index === -1 ? null : memoryStore.programs.splice(index, 1)[0];
  },

  async getEvents({ wingId, programId, publicOnly = false } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (wingId) query.wingId = wingId;
      if (programId) query.programId = programId;
      if (publicOnly) query.status = 'published';
      return await Event.find(query).populate('wingId programId').sort({ date: 1 });
    }
    return memoryStore.events.filter(event => (!wingId || String(event.wingId) === String(wingId)) && (!programId || String(event.programId) === String(programId)) && (!publicOnly || event.status === 'published'));
  },

  async getEventById(id) {
    if (isDatabaseConnected()) return await Event.findById(id).populate('wingId programId');
    return memoryStore.events.find(event => String(event._id) === String(id)) || null;
  },

  async createEvent(data) {
    if (isDatabaseConnected()) return await Event.create(data);
    const event = { ...data, _id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date(), updatedAt: new Date() };
    memoryStore.events.push(event);
    return event;
  },

  async updateEvent(id, data) {
    if (isDatabaseConnected()) return await Event.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    const event = await this.getEventById(id);
    if (!event) return null;
    Object.assign(event, data, { updatedAt: new Date() });
    return event;
  },

  async deleteEvent(id) {
    if (isDatabaseConnected()) return await Event.findByIdAndDelete(id);
    const index = memoryStore.events.findIndex(event => String(event._id) === String(id));
    return index === -1 ? null : memoryStore.events.splice(index, 1)[0];
  },

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
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return await Member.findOne(isObjectId ? { $or: [{ memberId: id }, { _id: id }] } : { memberId: id });
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
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return await Member.findOneAndUpdate(
        isObjectId ? { $or: [{ memberId: id }, { _id: id }] } : { memberId: id },
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
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return await Member.findOneAndDelete(isObjectId ? { $or: [{ memberId: id }, { _id: id }] } : { memberId: id });
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
  },

  // Member Requests (Wing Change & Become Volunteer)
  async createMemberRequest(data) {
    if (isDatabaseConnected()) {
      return await MemberRequest.create(data);
    }
    const newReq = { ...data, _id: 'req_' + Date.now(), createdAt: new Date() };
    memoryStore.requests.unshift(newReq);
    return newReq;
  },

  async getMemberRequests({ type, status, limit = 50 } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (type && type !== 'All') query.type = type;
      if (status && status !== 'All') query.status = status;
      return await MemberRequest.find(query).sort({ createdAt: -1 }).limit(Number(limit));
    }
    return memoryStore.requests.filter(r => {
      if (type && type !== 'All' && r.type !== type) return false;
      if (status && status !== 'All' && r.status !== status) return false;
      return true;
    }).slice(0, Number(limit));
  },

  async getMemberRequestsByUserId(userId, memberId) {
    if (isDatabaseConnected()) {
      const orClauses = [];
      if (userId) orClauses.push({ userId });
      if (memberId) orClauses.push({ memberId });
      const query = orClauses.length > 0 ? { $or: orClauses } : {};
      return await MemberRequest.find(query).sort({ createdAt: -1 });
    }
    return memoryStore.requests.filter(r => 
      (userId && String(r.userId) === String(userId)) || 
      (memberId && String(r.memberId) === String(memberId))
    );
  },

  async reviewMemberRequest(id, { status, adminNotes = '', reviewedBy = 'Admin' }) {
    if (isDatabaseConnected()) {
      const req = await MemberRequest.findById(id);
      if (!req) return null;

      req.status = status;
      req.adminNotes = adminNotes;
      req.reviewedBy = reviewedBy;
      req.reviewedAt = new Date();
      await req.save();

      // If approved, update member and user records in MongoDB
      if (status === 'approved') {
        const memberQuery = req.memberId ? { memberId: req.memberId } : (req.memberEmail ? { email: req.memberEmail } : null);
        const userQuery = req.userId ? { _id: req.userId } : (req.memberId ? { memberId: req.memberId } : (req.memberEmail ? { email: req.memberEmail } : null));

        if (req.type === 'wing_change' && req.requestedWing) {
          if (memberQuery) await Member.findOneAndUpdate(memberQuery, { wing: req.requestedWing });
          if (userQuery) await User.findOneAndUpdate(userQuery, { volunteerWing: req.requestedWing });
        } else if (req.type === 'become_volunteer') {
          if (userQuery) {
            await User.findOneAndUpdate(
              userQuery,
              {
                role: 'volunteer',
                volunteerWing: req.requestedWing || req.currentWing || 'সাধারণ উইং',
                volunteerInterests: req.volunteerInterests || []
              }
            );
          }
          if (memberQuery) await Member.findOneAndUpdate(memberQuery, { profession: 'Youth Volunteer' });
        }
      }

      return req;
    }

    const idx = memoryStore.requests.findIndex(r => String(r._id) === String(id));
    if (idx !== -1) {
      memoryStore.requests[idx].status = status;
      memoryStore.requests[idx].adminNotes = adminNotes;
      memoryStore.requests[idx].reviewedBy = reviewedBy;
      memoryStore.requests[idx].reviewedAt = new Date();
      return memoryStore.requests[idx];
    }
    return null;
  },

  // ─── Issues ────────────────────────────────────────────────────────────────
  async generateIssueCode() {
    const year = new Date().getFullYear();
    if (isDatabaseConnected()) {
      const count = await Issue.countDocuments();
      return `WCC-ISSUE-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    memoryStore.issueCounter += 1;
    return `WCC-ISSUE-${year}-${String(memoryStore.issueCounter).padStart(4, '0')}`;
  },

  async getIssues({ status, wingId, limit = 100 } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (status && status !== 'All') query.status = status;
      if (wingId) query.wingId = wingId;
      return await Issue.find(query).sort({ createdAt: -1 }).limit(Number(limit));
    }
    return memoryStore.issues.filter(i =>
      (!status || status === 'All' || i.status === status) &&
      (!wingId || i.wingId === wingId)
    ).slice(0, Number(limit));
  },

  async getIssueById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(id));
      return isObjectId
        ? await Issue.findById(id)
        : await Issue.findOne({ issueCode: id });
    }
    return memoryStore.issues.find(i => String(i._id) === String(id) || i.issueCode === id) || null;
  },

  async createIssue(data) {
    if (!data.issueCode) data.issueCode = await this.generateIssueCode();
    if (isDatabaseConnected()) return await Issue.create(data);
    const issue = { ...data, _id: `issue_${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    memoryStore.issues.unshift(issue);
    return issue;
  },

  async updateIssueStatus(id, status) {
    if (isDatabaseConnected()) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(id));
      return await Issue.findOneAndUpdate(
        isObjectId ? { _id: id } : { issueCode: id },
        { status, updatedAt: new Date() },
        { new: true }
      );
    }
    const issue = memoryStore.issues.find(i => String(i._id) === String(id) || i.issueCode === id);
    if (!issue) return null;
    issue.status = status;
    issue.updatedAt = new Date();
    return issue;
  },

  async assignIssue(id, { assignedTo, assignedToId }) {
    if (isDatabaseConnected()) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(id));
      return await Issue.findOneAndUpdate(
        isObjectId ? { _id: id } : { issueCode: id },
        { assignedTo, assignedToId, updatedAt: new Date() },
        { new: true }
      );
    }
    const issue = memoryStore.issues.find(i => String(i._id) === String(id) || i.issueCode === id);
    if (!issue) return null;
    issue.assignedTo = assignedTo;
    issue.assignedToId = assignedToId;
    issue.updatedAt = new Date();
    return issue;
  },

  async countResolvedIssues() {
    if (isDatabaseConnected()) return await Issue.countDocuments({ status: 'resolved' });
    return memoryStore.issues.filter(i => i.status === 'resolved').length;
  },

  async getImpactStats() {
    if (isDatabaseConnected()) {
      return {
        totalPrograms: await Program.countDocuments(),
        totalVolunteers: await User.countDocuments({ role: 'volunteer' }),
        resolvedIssues: await Issue.countDocuments({ status: 'resolved' })
      };
    }
    return {
      totalPrograms: memoryStore.programs.length,
      totalVolunteers: memoryStore.users.filter(user => user.role === 'volunteer').length,
      resolvedIssues: memoryStore.issues.filter(issue => issue.status === 'resolved').length
    };
  },

  // ─── Event Registrations ───────────────────────────────────────────────────
  async getEventRegistrations(eventId) {
    if (isDatabaseConnected()) return await EventRegistration.find({ eventId: String(eventId) }).sort({ registeredAt: 1 });
    return memoryStore.registrations.filter(r => String(r.eventId) === String(eventId));
  },

  async getRegistrationByUserAndEvent(userId, eventId) {
    if (isDatabaseConnected()) return await EventRegistration.findOne({ userId: String(userId), eventId: String(eventId) });
    return memoryStore.registrations.find(r => String(r.userId) === String(userId) && String(r.eventId) === String(eventId)) || null;
  },

  async createEventRegistration(data) {
    if (isDatabaseConnected()) {
      try {
        return await EventRegistration.create(data);
      } catch (err) {
        if (err.code === 11000) throw new Error('Already registered for this event');
        throw err;
      }
    }
    const existing = await this.getRegistrationByUserAndEvent(data.userId, data.eventId);
    if (existing) throw new Error('Already registered for this event');
    const reg = { ...data, _id: `reg_${Date.now()}`, registeredAt: new Date(), attended: false };
    memoryStore.registrations.push(reg);
    return reg;
  },

  async markAttendance(eventId, userId, attended) {
    if (isDatabaseConnected()) {
      return await EventRegistration.findOneAndUpdate(
        { eventId: String(eventId), userId: String(userId) },
        { attended },
        { new: true }
      );
    }
    const reg = memoryStore.registrations.find(r => String(r.eventId) === String(eventId) && String(r.userId) === String(userId));
    if (!reg) return null;
    reg.attended = attended;
    return reg;
  }
};
