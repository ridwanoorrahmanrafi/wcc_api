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
import Notification from '../models/Notification.js';
import Course from '../models/Course.js';
import Book from '../models/Book.js';
import BookRequest from '../models/BookRequest.js';
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
  eventRegistrations: [],
  notifications: [],
  courses: [],
  books: [],
  bookRequests: []
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
      return await User.findOne({ email: email.toLowerCase() }).populate('assignedWing');
    }
    return memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  async getUserById(id) {
    if (isDatabaseConnected()) {
      return await User.findById(id).populate('assignedWing');
    }
    return memoryStore.users.find(u => String(u._id) === String(id));
  },

  async getUsers({ role, search } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (role && role !== 'all') {
        query.role = role;
      }
      if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: 'i' };
        query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { memberId: regex }];
      }
      return await User.find(query).populate('assignedWing').sort({ createdAt: -1 });
    }
    let list = [...memoryStore.users];
    if (role && role !== 'all') {
      list = list.filter(u => u.role === role);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.memberId?.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async findUserByResetToken(token) {
    if (!token) return null;
    if (isDatabaseConnected()) {
      return await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
      }).populate('assignedWing');
    }
    return memoryStore.users.find(
      u => u.resetPasswordToken === token && u.resetPasswordExpires && new Date(u.resetPasswordExpires) > new Date()
    ) || null;
  },

  async updateUserPassword(id, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    if (isDatabaseConnected()) {
      return await User.findByIdAndUpdate(
        id,
        {
          $set: {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
          }
        },
        { new: true }
      ).populate('assignedWing');
    }
    const idx = memoryStore.users.findIndex(u => String(u._id) === String(id));
    if (idx === -1) return null;
    memoryStore.users[idx] = {
      ...memoryStore.users[idx],
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      updatedAt: new Date()
    };
    return memoryStore.users[idx];
  },

  async updateUser(id, updateData) {
    let updated;
    if (isDatabaseConnected()) {
      updated = await User.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true }).populate('assignedWing');
    } else {
      const idx = memoryStore.users.findIndex(u => String(u._id) === String(id));
      if (idx !== -1) {
        memoryStore.users[idx] = { ...memoryStore.users[idx], ...updateData, updatedAt: new Date() };
        updated = memoryStore.users[idx];
      }
    }

    // Sync profile updates to linked Member record if applicable
    if (updated && updated.memberId) {
      const memberFields = {};
      if (updateData.name) {
        memberFields.nameEn = updateData.name;
        memberFields.nameBn = updateData.name;
      }
      if (updateData.phone !== undefined) memberFields.mobile = updateData.phone;
      if (updateData.blood !== undefined) memberFields.blood = updateData.blood;
      if (updateData.upazila !== undefined) memberFields.upazila = updateData.upazila;
      if (updateData.district !== undefined) memberFields.district = updateData.district;
      if (updateData.profession !== undefined) memberFields.profession = updateData.profession;
      if (updateData.photoUrl !== undefined) memberFields.photoUrl = updateData.photoUrl;
      if (updateData.volunteerWing !== undefined) memberFields.wing = updateData.volunteerWing;

      if (Object.keys(memberFields).length > 0) {
        await this.updateMember(updated.memberId, memberFields).catch(err => {
          console.warn('[Member Sync Notice] Could not sync member record:', err.message);
        });
      }
    }

    return updated;
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
      const created = await User.create(newUser);
      return await User.findById(created._id).populate('assignedWing');
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

  // Wings
  async getWings() {
    if (isDatabaseConnected()) {
      return await Wing.find({}).populate('leader', 'name email phone memberId photoUrl role').sort({ createdAt: 1 });
    }
    return [...memoryStore.wings].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  },

  async getWingBySlug(slug) {
    if (!slug) return null;
    const cleanSlug = String(slug).trim().toLowerCase();
    if (isDatabaseConnected()) {
      return await Wing.findOne({ slug: cleanSlug }).populate('leader', 'name email phone memberId photoUrl role');
    }
    return memoryStore.wings.find(w => w.slug.toLowerCase() === cleanSlug) || null;
  },

  async getWingById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Wing.findById(id).populate('leader', 'name email phone memberId photoUrl role') : null;
    }
    return memoryStore.wings.find(w => String(w._id) === String(id)) || null;
  },

  async findWingBySlug(slug, excludeId = null) {
    if (!slug) return null;
    const cleanSlug = String(slug).trim().toLowerCase();
    if (isDatabaseConnected()) {
      const query = { slug: cleanSlug };
      if (excludeId) {
        query._id = { $ne: excludeId };
      }
      return await Wing.findOne(query).populate('leader', 'name email phone memberId photoUrl role');
    }
    return memoryStore.wings.find(w => w.slug.toLowerCase() === cleanSlug && String(w._id) !== String(excludeId)) || null;
  },

  async createWing(data) {
    if (isDatabaseConnected()) {
      const created = await Wing.create(data);
      return await Wing.findById(created._id).populate('leader', 'name email phone memberId photoUrl role');
    }
    const newWing = {
      _id: 'wing_' + Date.now(),
      nameEn: data.nameEn,
      nameBn: data.nameBn,
      slug: data.slug.toLowerCase(),
      description: data.description || '',
      missionPoints: Array.isArray(data.missionPoints) ? data.missionPoints : [],
      coverImage: data.coverImage || '',
      leader: data.leader || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.wings.push(newWing);
    return newWing;
  },

  async updateWing(id, data) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Wing.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('leader', 'name email phone memberId photoUrl role') : null;
    }
    const idx = memoryStore.wings.findIndex(w => String(w._id) === String(id));
    if (idx !== -1) {
      memoryStore.wings[idx] = { ...memoryStore.wings[idx], ...data, updatedAt: new Date() };
      return memoryStore.wings[idx];
    }
    return null;
  },

  async assignWingLeader(wingId, userId) {
    if (!wingId) return null;
    if (isDatabaseConnected()) {
      const wing = await Wing.findById(wingId);
      if (!wing) return null;

      let leaderUser = null;
      if (userId) {
        leaderUser = await User.findById(userId);
        if (!leaderUser) return null;

        // Upgrade/set user role & assigned wing
        leaderUser.role = 'wing_leader';
        leaderUser.assignedWing = wing._id;
        leaderUser.volunteerWing = `${wing.nameBn} (${wing.nameEn})`;
        await leaderUser.save();
      }

      wing.leader = leaderUser ? leaderUser._id : null;
      await wing.save();
      return await Wing.findById(wing._id).populate('leader', 'name email phone memberId photoUrl role');
    }

    const wingIdx = memoryStore.wings.findIndex(w => String(w._id) === String(wingId));
    if (wingIdx === -1) return null;

    let leaderObj = null;
    if (userId) {
      const userIdx = memoryStore.users.findIndex(u => String(u._id) === String(userId));
      if (userIdx !== -1) {
        memoryStore.users[userIdx].role = 'wing_leader';
        memoryStore.users[userIdx].assignedWing = memoryStore.wings[wingIdx]._id;
        leaderObj = memoryStore.users[userIdx];
      }
    }

    memoryStore.wings[wingIdx].leader = leaderObj;
    return memoryStore.wings[wingIdx];
  },

  async deleteWing(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Wing.findByIdAndDelete(id) : null;
    }
    const idx = memoryStore.wings.findIndex(w => String(w._id) === String(id));
    if (idx !== -1) {
      const removed = memoryStore.wings.splice(idx, 1);
      return removed[0];
    }
    return null;
  },

  // Programs
  async getPrograms({ wingId, status } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (wingId && wingId !== 'All') {
        query.wingId = wingId;
      }
      if (status && status !== 'All') {
        query.status = status.toLowerCase();
      }
      return await Program.find(query)
        .populate('wingId', 'nameEn nameBn slug coverImage')
        .sort({ startDate: -1, createdAt: -1 });
    }

    let list = [...memoryStore.programs];
    if (wingId && wingId !== 'All') {
      list = list.filter(p => String(p.wingId?._id || p.wingId) === String(wingId));
    }
    if (status && status !== 'All') {
      list = list.filter(p => p.status?.toLowerCase() === status.toLowerCase());
    }

    return list.map(p => {
      const wing = memoryStore.wings.find(w => String(w._id) === String(p.wingId?._id || p.wingId));
      return {
        ...p,
        wingId: wing
          ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage }
          : p.wingId
      };
    }).sort((a, b) => new Date(b.startDate || b.createdAt || 0) - new Date(a.startDate || a.createdAt || 0));
  },

  async getProgramById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Program.findById(id).populate('wingId', 'nameEn nameBn slug coverImage') : null;
    }
    const program = memoryStore.programs.find(p => String(p._id) === String(id));
    if (!program) return null;
    const wing = memoryStore.wings.find(w => String(w._id) === String(program.wingId?._id || program.wingId));
    return {
      ...program,
      wingId: wing
        ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage }
        : program.wingId
    };
  },

  async createProgram(data) {
    if (isDatabaseConnected()) {
      const created = await Program.create(data);
      return await Program.findById(created._id).populate('wingId', 'nameEn nameBn slug coverImage');
    }
    const wing = memoryStore.wings.find(w => String(w._id) === String(data.wingId));
    const newProg = {
      _id: 'prog_' + Date.now(),
      title: data.title,
      wingId: wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage } : data.wingId,
      description: data.description || '',
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status ? data.status.toLowerCase() : 'draft',
      coverImage: data.coverImage || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.programs.unshift(newProg);
    return newProg;
  },

  async updateProgram(id, data) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Program.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('wingId', 'nameEn nameBn slug coverImage')
        : null;
    }
    const idx = memoryStore.programs.findIndex(p => String(p._id) === String(id));
    if (idx !== -1) {
      let wingInfo = memoryStore.programs[idx].wingId;
      if (data.wingId) {
        const wing = memoryStore.wings.find(w => String(w._id) === String(data.wingId));
        wingInfo = wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage } : data.wingId;
      }
      memoryStore.programs[idx] = {
        ...memoryStore.programs[idx],
        ...data,
        wingId: wingInfo,
        updatedAt: new Date()
      };
      return memoryStore.programs[idx];
    }
    return null;
  },

  async deleteProgram(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Program.findByIdAndDelete(id) : null;
    }
    const idx = memoryStore.programs.findIndex(p => String(p._id) === String(id));
    if (idx !== -1) {
      const removed = memoryStore.programs.splice(idx, 1);
      return removed[0];
    }
    return null;
  },

  // Events
  async getEvents({ wingId, programId, status, isPublic = true } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (wingId && wingId !== 'All') query.wingId = wingId;
      if (programId && programId !== 'All') query.programId = programId;
      if (status && status !== 'All') {
        query.status = status.toLowerCase();
      } else if (isPublic) {
        query.status = 'published';
      }

      return await Event.find(query)
        .populate('wingId', 'nameEn nameBn slug coverImage')
        .populate('programId', 'title status coverImage')
        .sort({ date: 1, createdAt: -1 });
    }

    let list = [...memoryStore.events];
    if (wingId && wingId !== 'All') {
      list = list.filter(e => String(e.wingId?._id || e.wingId) === String(wingId));
    }
    if (programId && programId !== 'All') {
      list = list.filter(e => String(e.programId?._id || e.programId) === String(programId));
    }
    if (status && status !== 'All') {
      list = list.filter(e => e.status?.toLowerCase() === status.toLowerCase());
    } else if (isPublic) {
      list = list.filter(e => e.status === 'published');
    }

    return list.map(e => {
      const wing = memoryStore.wings.find(w => String(w._id) === String(e.wingId?._id || e.wingId));
      const prog = memoryStore.programs.find(p => String(p._id) === String(e.programId?._id || e.programId));
      return {
        ...e,
        wingId: wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage } : e.wingId,
        programId: prog ? { _id: prog._id, title: prog.title, status: prog.status, coverImage: prog.coverImage } : e.programId
      };
    }).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  },

  async getEventById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Event.findById(id)
            .populate('wingId', 'nameEn nameBn slug coverImage')
            .populate('programId', 'title status coverImage')
        : null;
    }
    const e = memoryStore.events.find(ev => String(ev._id) === String(id));
    if (!e) return null;
    const wing = memoryStore.wings.find(w => String(w._id) === String(e.wingId?._id || e.wingId));
    const prog = memoryStore.programs.find(p => String(p._id) === String(e.programId?._id || e.programId));
    return {
      ...e,
      wingId: wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage } : e.wingId,
      programId: prog ? { _id: prog._id, title: prog.title, status: prog.status, coverImage: prog.coverImage } : e.programId
    };
  },

  async createEvent(data) {
    if (isDatabaseConnected()) {
      const created = await Event.create(data);
      return await Event.findById(created._id)
        .populate('wingId', 'nameEn nameBn slug coverImage')
        .populate('programId', 'title status coverImage');
    }
    const wing = memoryStore.wings.find(w => String(w._id) === String(data.wingId));
    const prog = data.programId ? memoryStore.programs.find(p => String(p._id) === String(data.programId)) : null;

    const newEvent = {
      _id: 'evt_' + Date.now(),
      title: data.title,
      wingId: wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage } : data.wingId,
      programId: prog ? { _id: prog._id, title: prog.title, status: prog.status, coverImage: prog.coverImage } : (data.programId || null),
      date: new Date(data.date),
      location: data.location,
      capacity: data.capacity ? Number(data.capacity) : null,
      description: data.description || '',
      coverImage: data.coverImage || '',
      status: data.status ? data.status.toLowerCase() : 'draft',
      createdBy: data.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.events.unshift(newEvent);
    return newEvent;
  },

  async updateEvent(id, data) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Event.findByIdAndUpdate(id, data, { new: true, runValidators: true })
            .populate('wingId', 'nameEn nameBn slug coverImage')
            .populate('programId', 'title status coverImage')
        : null;
    }
    const idx = memoryStore.events.findIndex(e => String(e._id) === String(id));
    if (idx !== -1) {
      let wingInfo = memoryStore.events[idx].wingId;
      if (data.wingId) {
        const wing = memoryStore.wings.find(w => String(w._id) === String(data.wingId));
        wingInfo = wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug, coverImage: wing.coverImage } : data.wingId;
      }
      let progInfo = memoryStore.events[idx].programId;
      if (data.programId !== undefined) {
        if (data.programId) {
          const prog = memoryStore.programs.find(p => String(p._id) === String(data.programId));
          progInfo = prog ? { _id: prog._id, title: prog.title, status: prog.status, coverImage: prog.coverImage } : data.programId;
        } else {
          progInfo = null;
        }
      }

      memoryStore.events[idx] = {
        ...memoryStore.events[idx],
        ...data,
        wingId: wingInfo,
        programId: progInfo,
        updatedAt: new Date()
      };
      return memoryStore.events[idx];
    }
    return null;
  },

  async deleteEvent(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Event.findByIdAndDelete(id) : null;
    }
    const idx = memoryStore.events.findIndex(e => String(e._id) === String(id));
    if (idx !== -1) {
      const removed = memoryStore.events.splice(idx, 1);
      return removed[0];
    }
    return null;
  },

  // Issues (Community Issue Reporting)
  async createIssue(data) {
    if (isDatabaseConnected()) {
      const created = await Issue.create(data);
      return await Issue.findById(created._id)
        .populate('assignedTo', 'name email role phone')
        .populate('wingId', 'nameEn nameBn slug');
    }
    const assignedUser = data.assignedTo
      ? memoryStore.users.find(u => String(u._id) === String(data.assignedTo))
      : null;
    const wing = data.wingId
      ? memoryStore.wings.find(w => String(w._id) === String(data.wingId))
      : null;

    const newIssue = {
      _id: 'iss_' + Date.now(),
      issueCode: data.issueCode,
      title: data.title,
      description: data.description,
      location: data.location,
      photoUrl: data.photoUrl || '',
      status: (data.status || 'pending').toLowerCase(),
      reporterName: data.reporterName,
      reporterContact: data.reporterContact,
      assignedTo: assignedUser ? { _id: assignedUser._id, name: assignedUser.name, email: assignedUser.email, role: assignedUser.role, phone: assignedUser.phone } : null,
      wingId: wing ? { _id: wing._id, nameEn: wing.nameEn, nameBn: wing.nameBn, slug: wing.slug } : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.issues.unshift(newIssue);
    return newIssue;
  },

  async getIssues({ status, assignedTo, wingId, search, page = 1, limit = 50 } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (status && status !== 'All') query.status = status.toLowerCase();
      if (assignedTo && assignedTo !== 'All') query.assignedTo = assignedTo;
      if (wingId && wingId !== 'All') query.wingId = wingId;
      if (search) {
        query.$or = [
          { issueCode: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { reporterName: { $regex: search, $options: 'i' } }
        ];
      }
      const skip = (Number(page) - 1) * Number(limit);
      const total = await Issue.countDocuments(query);
      const issues = await Issue.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('assignedTo', 'name email role phone')
        .populate('wingId', 'nameEn nameBn slug');
      return { total, page: Number(page), limit: Number(limit), issues };
    }

    let list = [...memoryStore.issues];
    if (status && status !== 'All') {
      list = list.filter(i => i.status === status.toLowerCase());
    }
    if (assignedTo && assignedTo !== 'All') {
      list = list.filter(i => {
        const aId = i.assignedTo?._id || i.assignedTo;
        return String(aId) === String(assignedTo);
      });
    }
    if (wingId && wingId !== 'All') {
      list = list.filter(i => {
        const wId = i.wingId?._id || i.wingId;
        return String(wId) === String(wingId);
      });
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        i =>
          (i.issueCode && i.issueCode.toLowerCase().includes(s)) ||
          (i.title && i.title.toLowerCase().includes(s)) ||
          (i.location && i.location.toLowerCase().includes(s)) ||
          (i.reporterName && i.reporterName.toLowerCase().includes(s))
      );
    }
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = list.slice(skip, skip + Number(limit));
    return {
      total: list.length,
      page: Number(page),
      limit: Number(limit),
      issues: paginated
    };
  },

  async getIssueById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Issue.findById(id)
            .populate('assignedTo', 'name email role phone')
            .populate('wingId', 'nameEn nameBn slug')
        : null;
    }
    return memoryStore.issues.find(i => String(i._id) === String(id)) || null;
  },

  async getIssueByCode(issueCode) {
    if (!issueCode) return null;
    const cleanCode = issueCode.trim();
    if (isDatabaseConnected()) {
      return await Issue.findOne({
        issueCode: { $regex: new RegExp(`^${cleanCode}$`, 'i') }
      })
        .populate('assignedTo', 'name email role phone')
        .populate('wingId', 'nameEn nameBn slug');
    }
    return (
      memoryStore.issues.find(
        i => i.issueCode && i.issueCode.toLowerCase() === cleanCode.toLowerCase()
      ) || null
    );
  },

  async updateIssue(id, data) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Issue.findByIdAndUpdate(id, data, { new: true, runValidators: true })
            .populate('assignedTo', 'name email role phone')
            .populate('wingId', 'nameEn nameBn slug')
        : null;
    }
    const idx = memoryStore.issues.findIndex(i => String(i._id) === String(id));
    if (idx !== -1) {
      let assignedUser = memoryStore.issues[idx].assignedTo;
      if (data.assignedTo !== undefined) {
        if (data.assignedTo) {
          const u = memoryStore.users.find(usr => String(usr._id) === String(data.assignedTo));
          assignedUser = u ? { _id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone } : data.assignedTo;
        } else {
          assignedUser = null;
        }
      }
      let wingInfo = memoryStore.issues[idx].wingId;
      if (data.wingId !== undefined) {
        if (data.wingId) {
          const w = memoryStore.wings.find(wing => String(wing._id) === String(data.wingId));
          wingInfo = w ? { _id: w._id, nameEn: w.nameEn, nameBn: w.nameBn, slug: w.slug } : data.wingId;
        } else {
          wingInfo = null;
        }
      }
      memoryStore.issues[idx] = {
        ...memoryStore.issues[idx],
        ...data,
        assignedTo: assignedUser,
        wingId: wingInfo,
        updatedAt: new Date()
      };
      return memoryStore.issues[idx];
    }
    return null;
  },

  async deleteIssue(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Issue.findByIdAndDelete(id) : null;
    }
    const idx = memoryStore.issues.findIndex(i => String(i._id) === String(id));
    if (idx !== -1) {
      const removed = memoryStore.issues.splice(idx, 1);
      return removed[0];
    }
    return null;
  },

  // Event Registrations
  async createEventRegistration({ eventId, userId, registeredAt = new Date(), attended = false }) {
    if (isDatabaseConnected()) {
      const created = await EventRegistration.create({
        eventId,
        userId,
        memberId: userId,
        registeredAt,
        attended
      });
      return await EventRegistration.findById(created._id)
        .populate('userId', 'name email role phone memberId assignedWing')
        .populate('eventId', 'title date location capacity status wingId');
    }

    const user = memoryStore.users.find(u => String(u._id) === String(userId));
    const event = memoryStore.events.find(e => String(e._id) === String(eventId));

    const newReg = {
      _id: 'reg_' + Date.now(),
      eventId: event ? { _id: event._id, title: event.title, date: event.date, location: event.location, capacity: event.capacity, status: event.status, wingId: event.wingId } : eventId,
      userId: user ? { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, memberId: user.memberId, assignedWing: user.assignedWing } : userId,
      memberId: userId,
      registeredAt,
      attended,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.eventRegistrations.unshift(newReg);
    return newReg;
  },

  async getEventRegistration(eventId, userId) {
    if (!eventId || !userId) return null;
    if (isDatabaseConnected()) {
      return await EventRegistration.findOne({ eventId, userId })
        .populate('userId', 'name email role phone memberId assignedWing')
        .populate('eventId', 'title date location capacity status wingId');
    }
    return (
      memoryStore.eventRegistrations.find(
        r =>
          String(r.eventId?._id || r.eventId) === String(eventId) &&
          String(r.userId?._id || r.userId) === String(userId)
      ) || null
    );
  },

  async getEventRegistrations(eventId) {
    if (!eventId) return [];
    if (isDatabaseConnected()) {
      return await EventRegistration.find({ eventId })
        .sort({ registeredAt: 1 })
        .populate('userId', 'name email role phone memberId assignedWing');
    }
    return memoryStore.eventRegistrations.filter(
      r => String(r.eventId?._id || r.eventId) === String(eventId)
    );
  },

  async getEventRegistrationCount(eventId) {
    if (!eventId) return 0;
    if (isDatabaseConnected()) {
      return await EventRegistration.countDocuments({ eventId });
    }
    return memoryStore.eventRegistrations.filter(
      r => String(r.eventId?._id || r.eventId) === String(eventId)
    ).length;
  },

  async updateEventAttendance(eventId, attendees = []) {
    if (!eventId) return [];
    const results = [];
    if (isDatabaseConnected()) {
      for (const item of attendees) {
        const idKey = item.registrationId || item._id;
        const userKey = item.userId;
        const query = { eventId };
        if (idKey) {
          query._id = idKey;
        } else if (userKey) {
          query.$or = [{ userId: userKey }, { memberId: userKey }];
        } else {
          continue;
        }

        const updated = await EventRegistration.findOneAndUpdate(
          query,
          { attended: Boolean(item.attended) },
          { new: true }
        ).populate('userId', 'name email role phone memberId assignedWing');

        if (updated) {
          results.push(updated);
        }
      }
      return results;
    }

    for (const item of attendees) {
      const idKey = item.registrationId || item._id;
      const userKey = item.userId;
      const idx = memoryStore.eventRegistrations.findIndex(r => {
        const matchesEvent = String(r.eventId?._id || r.eventId) === String(eventId);
        if (!matchesEvent) return false;
        if (idKey) return String(r._id) === String(idKey);
        if (userKey) return String(r.userId?._id || r.userId) === String(userKey);
        return false;
      });

      if (idx !== -1) {
        memoryStore.eventRegistrations[idx] = {
          ...memoryStore.eventRegistrations[idx],
          attended: Boolean(item.attended),
          updatedAt: new Date()
        };
        results.push(memoryStore.eventRegistrations[idx]);
      }
    }
    return results;
  },

  // Impact Statistics
  async getImpactStats() {
    if (isDatabaseConnected()) {
      const [totalPrograms, totalVolunteers, resolvedIssues] = await Promise.all([
        Program.countDocuments({}),
        User.countDocuments({ role: 'volunteer' }),
        Issue.countDocuments({ status: 'resolved' })
      ]);
      return {
        totalPrograms,
        totalVolunteers,
        resolvedIssues
      };
    }

    const totalPrograms = memoryStore.programs.length;
    const totalVolunteers = memoryStore.users.filter(u => u.role === 'volunteer').length;
    const resolvedIssues = memoryStore.issues.filter(i => i.status === 'resolved').length;

    return {
      totalPrograms,
      totalVolunteers,
      resolvedIssues
    };
  },

  // Notifications & Role Invitations
  async createNotification(data) {
    if (isDatabaseConnected()) {
      let recipientUserId = data.recipientUserId || null;
      if (!recipientUserId && (data.recipientEmail || data.recipientMemberId)) {
        const u = await User.findOne({
          $or: [
            ...(data.recipientEmail ? [{ email: data.recipientEmail.toLowerCase() }] : []),
            ...(data.recipientMemberId ? [{ memberId: data.recipientMemberId }] : [])
          ]
        });
        if (u) recipientUserId = u._id;
      }

      const notif = new Notification({
        ...data,
        recipientUserId,
        recipientEmail: (data.recipientEmail || '').toLowerCase()
      });
      return await notif.save();
    }

    const newNotif = {
      _id: String(Date.now()),
      ...data,
      recipientEmail: (data.recipientEmail || '').toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.notifications.push(newNotif);
    return newNotif;
  },

  async getMyNotifications({ userId, memberId, email, status }) {
    if (isDatabaseConnected()) {
      const matchCriteria = [];
      if (userId) matchCriteria.push({ recipientUserId: userId });
      if (memberId) matchCriteria.push({ recipientMemberId: memberId });
      if (email) matchCriteria.push({ recipientEmail: email.toLowerCase() });

      if (matchCriteria.length === 0) return [];

      const query = { $or: matchCriteria };
      if (status && status !== 'all') {
        query.status = status;
      }

      return await Notification.find(query).sort({ createdAt: -1 }).limit(50);
    }

    const s = email ? email.toLowerCase() : '';
    return memoryStore.notifications
      .filter(n => {
        const match =
          (userId && String(n.recipientUserId) === String(userId)) ||
          (memberId && n.recipientMemberId === memberId) ||
          (s && n.recipientEmail?.toLowerCase() === s);
        if (!match) return false;
        if (status && status !== 'all') return n.status === status;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async respondToRoleInvitation(id, { action, recipientUser }) {
    if (isDatabaseConnected()) {
      const notif = await Notification.findById(id);
      if (!notif) return { error: 'Notification not found' };

      const userEmail = recipientUser.email?.toLowerCase();
      const userMemberId = recipientUser.memberId;
      const userIdStr = String(recipientUser._id || recipientUser.id || '');
      const notifUserStr = notif.recipientUserId ? String(notif.recipientUserId) : '';

      const isMatch =
        (notifUserStr && notifUserStr === userIdStr) ||
        (userEmail && notif.recipientEmail?.toLowerCase() === userEmail) ||
        (userMemberId && notif.recipientMemberId === userMemberId);

      if (!isMatch && recipientUser.role !== 'admin') {
        return { error: 'Unauthorized to respond to this invitation' };
      }

      if (notif.status !== 'pending') {
        return { error: `Invitation has already been ${notif.status}` };
      }

      if (action === 'accept') {
        notif.status = 'accepted';
        notif.actionTakenAt = new Date();
        await notif.save();

        const updateFields = {
          role: notif.targetRole
        };
        if (notif.targetRole === 'volunteer') {
          if (notif.targetWing) updateFields.volunteerWing = notif.targetWing;
        } else if (notif.targetRole === 'coordinator') {
          if (notif.targetWingId) updateFields.assignedWing = notif.targetWingId;
          if (notif.targetWing) updateFields.volunteerWing = notif.targetWing;
        }

        const updatedUser = await User.findOneAndUpdate(
          {
            $or: [
              ...(userIdStr ? [{ _id: recipientUser._id || recipientUser.id }] : []),
              ...(userEmail ? [{ email: userEmail }] : []),
              ...(userMemberId ? [{ memberId: userMemberId }] : [])
            ]
          },
          { $set: updateFields },
          { new: true }
        ).populate('assignedWing');

        const memberUpdate = {};
        if (notif.targetWing) memberUpdate.wing = notif.targetWing;
        if (notif.targetRole === 'volunteer') memberUpdate.profession = 'Youth Volunteer';

        await Member.findOneAndUpdate(
          {
            $or: [
              ...(userMemberId ? [{ memberId: userMemberId }] : []),
              ...(userEmail ? [{ email: userEmail }] : [])
            ]
          },
          { $set: memberUpdate }
        );

        return { notification: notif, user: updatedUser };
      } else if (action === 'reject') {
        notif.status = 'rejected';
        notif.actionTakenAt = new Date();
        await notif.save();
        return { notification: notif, user: recipientUser };
      }

      return { error: 'Invalid action. Must be accept or reject.' };
    }

    const idx = memoryStore.notifications.findIndex(n => String(n._id) === String(id));
    if (idx === -1) return { error: 'Notification not found' };
    const notif = memoryStore.notifications[idx];
    notif.status = action === 'accept' ? 'accepted' : 'rejected';
    notif.actionTakenAt = new Date();
    return { notification: notif, user: recipientUser };
  },

  async getRoleInvitations({ status, targetRole, limit = 50 }) {
    if (isDatabaseConnected()) {
      const query = { type: 'role_invitation' };
      if (status && status !== 'all') query.status = status;
      if (targetRole && targetRole !== 'all') query.targetRole = targetRole;
      return await Notification.find(query).sort({ createdAt: -1 }).limit(Number(limit));
    }
    return memoryStore.notifications
      .filter(n => {
        if (n.type !== 'role_invitation') return false;
        if (status && status !== 'all' && n.status !== status) return false;
        if (targetRole && targetRole !== 'all' && n.targetRole !== targetRole) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Number(limit));
  },

  async markNotificationRead(id) {
    if (isDatabaseConnected()) {
      return await Notification.findByIdAndUpdate(id, { read: true }, { new: true });
    }
    const notif = memoryStore.notifications.find(n => String(n._id) === String(id));
    if (notif) notif.read = true;
    return notif;
  },

  // =========================================================================
  // EDUCATION WING: FREE COURSES
  // =========================================================================
  async getCourses({ wingSlug = 'education', category, status } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      if (category && category !== 'All') {
        query.category = category;
      }
      return await Course.find(query)
        .populate('wing', 'nameEn nameBn slug')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 });
    }

    let list = [...memoryStore.courses];
    if (status && status !== 'all') {
      list = list.filter(c => c.status === status);
    }
    if (category && category !== 'All') {
      list = list.filter(c => c.category === category);
    }
    return list;
  },

  async getCourseById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Course.findById(id).populate('wing', 'nameEn nameBn slug').populate('enrolledMembers', 'name email memberId')
        : await Course.findOne({ slug: id }).populate('wing', 'nameEn nameBn slug').populate('enrolledMembers', 'name email memberId');
    }
    return memoryStore.courses.find(c => String(c._id) === String(id) || c.slug === id) || null;
  },

  async createCourse(data) {
    if (isDatabaseConnected()) {
      const created = await Course.create(data);
      return await Course.findById(created._id).populate('wing', 'nameEn nameBn slug');
    }
    const newCourse = {
      _id: 'course_' + Date.now(),
      ...data,
      enrolledMembers: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.courses.unshift(newCourse);
    return newCourse;
  },

  async updateCourse(id, data) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Course.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('wing', 'nameEn nameBn slug')
        : null;
    }
    const idx = memoryStore.courses.findIndex(c => String(c._id) === String(id));
    if (idx !== -1) {
      memoryStore.courses[idx] = { ...memoryStore.courses[idx], ...data, updatedAt: new Date() };
      return memoryStore.courses[idx];
    }
    return null;
  },

  async deleteCourse(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Course.findByIdAndDelete(id) : null;
    }
    const idx = memoryStore.courses.findIndex(c => String(c._id) === String(id));
    if (idx !== -1) {
      const removed = memoryStore.courses.splice(idx, 1);
      return removed[0];
    }
    return null;
  },

  async enrollCourse(courseId, userId) {
    if (!courseId || !userId) return null;
    if (isDatabaseConnected()) {
      const course = await Course.findById(courseId);
      if (!course) return { error: 'Course not found' };

      const alreadyEnrolled = course.enrolledMembers.some(uId => String(uId) === String(userId));
      if (!alreadyEnrolled) {
        course.enrolledMembers.push(userId);
        await course.save();
      }
      return { success: true, alreadyEnrolled, course };
    }

    const course = memoryStore.courses.find(c => String(c._id) === String(courseId));
    if (!course) return { error: 'Course not found' };
    course.enrolledMembers = course.enrolledMembers || [];
    const alreadyEnrolled = course.enrolledMembers.some(uId => String(uId) === String(userId));
    if (!alreadyEnrolled) {
      course.enrolledMembers.push(userId);
    }
    return { success: true, alreadyEnrolled, course };
  },

  // =========================================================================
  // EDUCATION WING: BOOK DONATIONS
  // =========================================================================
  async getBooks({ status, category, search } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      if (category && category !== 'All') {
        query.category = category;
      }
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { author: { $regex: search, $options: 'i' } },
          { pickupLocation: { $regex: search, $options: 'i' } }
        ];
      }
      return await Book.find(query).populate('approvedBy', 'name email role').sort({ createdAt: -1 });
    }

    let list = [...memoryStore.books];
    if (status && status !== 'all') {
      list = list.filter(b => b.status === status);
    }
    if (category && category !== 'All') {
      list = list.filter(b => b.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        b =>
          b.title?.toLowerCase().includes(s) ||
          b.author?.toLowerCase().includes(s) ||
          b.pickupLocation?.toLowerCase().includes(s)
      );
    }
    return list;
  },

  async getBookById(id) {
    if (!id) return null;
    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId ? await Book.findById(id).populate('approvedBy', 'name email') : null;
    }
    return memoryStore.books.find(b => String(b._id) === String(id)) || null;
  },

  async createBook(data) {
    if (isDatabaseConnected()) {
      return await Book.create(data);
    }
    const newBook = {
      _id: 'book_' + Date.now(),
      ...data,
      status: data.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.books.unshift(newBook);
    return newBook;
  },

  async getMyBookDonations(userId) {
    if (!userId) return [];
    if (isDatabaseConnected()) {
      return await Book.find({ 'donor.userId': userId }).sort({ createdAt: -1 });
    }
    return memoryStore.books.filter(b => String(b.donor?.userId) === String(userId));
  },

  async updateBookStatus(id, { status, rejectionReason = '', approvedBy = null }) {
    if (!id) return null;
    const updateData = {
      status,
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      approvedBy: status === 'approved' ? approvedBy : null,
      approvedAt: status === 'approved' ? new Date() : null
    };

    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await Book.findByIdAndUpdate(id, { $set: updateData }, { new: true })
        : null;
    }

    const idx = memoryStore.books.findIndex(b => String(b._id) === String(id));
    if (idx !== -1) {
      memoryStore.books[idx] = {
        ...memoryStore.books[idx],
        ...updateData,
        updatedAt: new Date()
      };
      return memoryStore.books[idx];
    }
    return null;
  },

  // =========================================================================
  // EDUCATION WING: BOOK REQUESTS
  // =========================================================================
  async createBookRequest(data) {
    if (isDatabaseConnected()) {
      const created = await BookRequest.create(data);
      return await BookRequest.findById(created._id).populate('book');
    }
    const book = memoryStore.books.find(b => String(b._id) === String(data.book));
    const newReq = {
      _id: 'req_' + Date.now(),
      ...data,
      book: book || data.book,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.bookRequests.unshift(newReq);
    return newReq;
  },

  async getBookRequests({ status } = {}) {
    if (isDatabaseConnected()) {
      const query = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      return await BookRequest.find(query)
        .populate('book')
        .populate('reviewedBy', 'name email role')
        .sort({ createdAt: -1 });
    }

    let list = [...memoryStore.bookRequests];
    if (status && status !== 'all') {
      list = list.filter(r => r.status === status);
    }
    return list;
  },

  async getMyBookRequests(userId) {
    if (!userId) return [];
    if (isDatabaseConnected()) {
      return await BookRequest.find({ 'requester.userId': userId })
        .populate('book')
        .sort({ createdAt: -1 });
    }
    return memoryStore.bookRequests.filter(r => String(r.requester?.userId) === String(userId));
  },

  async updateBookRequestStatus(id, { status, rejectionReason = '', adminNotes = '', reviewedBy = null }) {
    if (!id) return null;
    const updateData = {
      status,
      rejectionReason: status === 'rejected' ? rejectionReason : '',
      adminNotes: adminNotes || '',
      reviewedBy,
      reviewedAt: new Date()
    };

    if (isDatabaseConnected()) {
      const isObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
      return isObjectId
        ? await BookRequest.findByIdAndUpdate(id, { $set: updateData }, { new: true }).populate('book')
        : null;
    }

    const idx = memoryStore.bookRequests.findIndex(r => String(r._id) === String(id));
    if (idx !== -1) {
      memoryStore.bookRequests[idx] = {
        ...memoryStore.bookRequests[idx],
        ...updateData,
        updatedAt: new Date()
      };
      return memoryStore.bookRequests[idx];
    }
    return null;
  }
};



