import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';

import Wing from '../models/Wing.js';
import Account from '../models/Account.js';
import Activity from '../models/Activity.js';
import Vendor from '../models/Vendor.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Transaction from '../models/Transaction.js';
import Advance from '../models/Advance.js';
import Reimbursement from '../models/Reimbursement.js';
import User from '../models/User.js';
import Member from '../models/Member.js';
import VolunteerLog from '../models/VolunteerLog.js';
import MemberRequest from '../models/MemberRequest.js';
import Program from '../models/Program.js';
import Event from '../models/Event.js';
import Issue from '../models/Issue.js';

import { initialMembers, initialUsers } from '../data/seedData.js';

export const runComprehensiveSeed = async () => {
  console.log('====================================================');
  console.log('🚀 WCC MASTER DATABASE SEEDER (Pure Database Mode)');
  console.log('====================================================');

  await connectDB();

  // -----------------------------------------------------------------
  // 1. WINGS (5 Core Organizational Wings)
  // -----------------------------------------------------------------
  console.log('\n[1/12] Seeding Organizational Wings...');
  const wingsData = [
    {
      nameEn: 'Education',
      nameBn: 'শিক্ষা উইং',
      slug: 'education',
      description: 'মেধাবী ও অসচ্ছল শিক্ষার্থীদের শিক্ষাবৃত্তি, ডিজিটাল সাক্ষরতা ও ক্যারিয়ার মেন্টরশিপ।',
      missionPoints: ['Quality Education for All', 'Student Scholarships', 'Digital Literacy Camps'],
      coverImage: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Health',
      nameBn: 'স্বাস্থ্য উইং',
      slug: 'health',
      description: 'বিনামূল্যে স্বাস্থ্য ও চক্ষু ক্যাম্প, স্বেচ্ছায় রক্তদান নেটওয়ার্ক এবং জরুরি টেলিমেডিসিন সেবা।',
      missionPoints: ['Voluntary Blood Drives', 'Medical Health Camps', 'Hygiene & Mental Health Awareness'],
      coverImage: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Sports',
      nameBn: 'খেলাধুলা উইং',
      slug: 'sports',
      description: 'মাদক ও ডিজিটাল আসক্তি মুক্ত সমাজ গঠনে তৃণমূল ফুটবল, ক্রিকেট ও যুব অ্যাথলেটিক্স প্রতিযোগিতা।',
      missionPoints: ['Community Sports Tournaments', 'Youth Physical Fitness', 'Athletics Training Support'],
      coverImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Culture',
      nameBn: 'সংস্কৃতি উইং',
      slug: 'culture',
      description: 'বাঙালি সংস্কৃতি, ভাষা আন্দোলন ও মুক্তিযুদ্ধের সঠিক ইতিহাস চর্চা, সাহিত্য সম্মেলন ও সৃজনশীল নাট্যকর্ম।',
      missionPoints: ['Cultural Festivals & Exhibitions', 'Creative Arts Workshops', 'Youth Literary Circles'],
      coverImage: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Heritage',
      nameBn: 'ঐতিহ্য উইং',
      slug: 'heritage',
      description: 'সুগন্ধা নদী বিধৌত ঝালকাঠির ঐতিহ্যবাহী প্রত্নতাত্ত্বিক নিদর্শন সংরক্ষণ, বৃক্ষরোপণ ও পরিবেশ সুরক্ষা।',
      missionPoints: ['Historical Site Preservation', 'Oral History Archiving', 'Community Heritage Walks'],
      coverImage: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?auto=format&fit=crop&q=80&w=800'
    }
  ];

  const wingDocs = {};
  for (const w of wingsData) {
    const doc = await Wing.findOneAndUpdate(
      { slug: w.slug },
      { $set: w },
      { upsert: true, new: true }
    );
    wingDocs[w.slug] = doc;
    console.log(`  ✓ Wing: ${doc.nameBn} (${doc.slug}) [ID: ${doc._id}]`);
  }

  // -----------------------------------------------------------------
  // 2. ACCOUNTS (Cash, Bank, MFS Vaults)
  // -----------------------------------------------------------------
  console.log('\n[2/12] Seeding Financial Vaults & Accounts...');
  const accountsData = [
    {
      accountId: 'WCC-ACC-000001',
      name: 'Cash in Hand (Main Vault)',
      accountType: 'Cash',
      openingBalance: 50000,
      currentBalance: 85500,
      status: 'Active',
      notes: 'ঝালকাঠি সদর কেন্দ্রীয় ভল্ট ক্যাশ ব্যালেন্স'
    },
    {
      accountId: 'WCC-ACC-000002',
      name: 'Main Bank Account (BRAC Bank PLC)',
      accountType: 'Bank Account',
      accountNumber: '15012048931001',
      bankName: 'BRAC Bank PLC',
      branchName: 'Jhalokathi Branch',
      routingNumber: '060261144',
      openingBalance: 250000,
      currentBalance: 375000,
      status: 'Active',
      notes: 'প্রাতিষ্ঠানিক অনুদান ও বড় প্রকল্পের প্রধান ব্যাংক হিসাব'
    },
    {
      accountId: 'WCC-ACC-000003',
      name: 'bKash Merchant / Donation Wallet',
      accountType: 'bKash',
      accountNumber: '01711-000000',
      bankName: 'bKash Limited',
      openingBalance: 20000,
      currentBalance: 62400,
      status: 'Active',
      notes: 'সাধারণ সদস্য চাঁদা ও ডিজিটাল গণচাঁদা গ্রহণ ওয়ালেট'
    },
    {
      accountId: 'WCC-ACC-000004',
      name: 'Secondary Reserve (DBBL)',
      accountType: 'Bank Account',
      accountNumber: '115120034982',
      bankName: 'Dutch-Bangla Bank PLC',
      branchName: 'Barishal Main Branch',
      routingNumber: '090261122',
      openingBalance: 100000,
      currentBalance: 145000,
      status: 'Active',
      notes: 'জরুরি দুর্যোগ ও ভবিষ্যৎ ত্রাণ তহবিল রিজার্ভ'
    }
  ];

  for (const acc of accountsData) {
    await Account.findOneAndUpdate({ accountId: acc.accountId }, { $set: acc }, { upsert: true, new: true });
    console.log(`  ✓ Account: ${acc.name} — Balance: ৳ ${acc.currentBalance.toLocaleString()}`);
  }

  // -----------------------------------------------------------------
  // 3. ACTIVITIES (Community Initiatives)
  // -----------------------------------------------------------------
  console.log('\n[3/12] Seeding Community Activities...');
  const activitiesData = [
    {
      activityId: 'WCC-ACT-2026-000012',
      name: 'WCC Free Health Camp – Jhalokathi',
      type: 'Health Camp',
      startDate: '2026-02-15',
      endDate: '2026-02-16',
      location: 'ঝালকাঠি সরকারি উচ্চ বিদ্যালয় প্রাঙ্গণ',
      description: 'বিনামূল্যে ১,২০০+ অসহায় মানুষকে বিশেষজ্ঞ চিকিৎসা পরামর্শ ও জরুরি ঔষধ বিতরণ ক্যাম্প।',
      budget: 150000,
      actualExpense: 132450,
      responsiblePerson: 'ডাঃ মোস্তাফিজুর রহমান',
      status: 'Completed',
      notes: 'সফলভাবে সম্পন্ন। ৩টি ওষুধ কোম্পানির স্পনসরশিপ ও স্থানীয় চিকিৎসকদের সহযোগিতা পাওয়া গেছে।'
    },
    {
      activityId: 'WCC-ACT-2026-000015',
      name: 'Winter Warm Clothes & Blanket Distribution Drive',
      type: 'Campaign',
      startDate: '2026-01-05',
      endDate: '2026-01-12',
      location: 'নলছিটি ও রাজাপুর উপজেলা',
      description: 'শীতবস্ত্র ও কম্বল ৮০০+ দুস্থ পরিবারের মাঝে সরাসরি বিতরণ।',
      budget: 95000,
      actualExpense: 88500,
      responsiblePerson: 'তানভীর আহমেদ চৌধুরী',
      status: 'Completed',
      notes: 'উভয় উপজেলার স্থানীয় প্রশাসনের উপস্থিতিতে স্বচ্ছতার সাথে বিতরণ করা হয়েছে।'
    },
    {
      activityId: 'WCC-ACT-2026-000018',
      name: 'Youth IT Skills & Freelancing Bootcamp 2026',
      type: 'Training',
      startDate: '2026-03-01',
      endDate: '2026-03-15',
      location: 'ঝালকাঠি প্রেসক্লাব মিলনায়তন',
      description: '৫০ জন তরুণ-তরুণীকে ওয়েব ডিজাইন ও ডিজিটাল মার্কেটিংয়ে বিনামূল্যে ১৫ দিনের নিবিড় প্রশিক্ষণ।',
      budget: 65000,
      actualExpense: 42000,
      responsiblePerson: 'ফারহানা ইসলাম প্রীতি',
      status: 'Active',
      notes: 'বর্তমানে ক্লাস ও প্র্যাকটিক্যাল ল্যাব সেশন চলমান।'
    },
    {
      activityId: 'WCC-ACT-2026-000022',
      name: 'WCC Annual General Meeting & Executive Council 2026',
      type: 'Meeting',
      startDate: '2026-04-10',
      endDate: '2026-04-10',
      location: 'সার্কিট হাউস সম্মেলন কক্ষ, ঝালকাঠি',
      description: 'বাৎসরিক অডিট রিপোর্ট অনুমোদন, নতুন বাজেট পেশ এবং কার্যনির্বাহী পর্ষদ পর্যালোচনা।',
      budget: 45000,
      actualExpense: 0,
      responsiblePerson: 'মোঃ নাজমুল হাসান',
      status: 'Active',
      notes: 'ভোট ও ডেলিগেট রেজিস্ট্রেশন প্রস্তুতি চলছে।'
    },
    {
      activityId: 'WCC-ACT-2026-000025',
      name: 'Green Jhalokathi Tree Plantation & Climate Drive',
      type: 'Campaign',
      startDate: '2026-05-01',
      endDate: '2026-05-20',
      location: 'সুগন্ধা নদী তীর, রাজাপুর ও কাঠালিয়া',
      description: 'সুগন্ধা নদীর ভাঙন প্রতিরোধে ও সবুজায়নে ৫,০০০ ফলদ ও বনজ বৃক্ষরোপণ কর্মসূচি।',
      budget: 80000,
      actualExpense: 35000,
      responsiblePerson: 'আহসান হাবিব',
      status: 'Active',
      notes: 'উপজেলা বন বিভাগের চারা নার্সারি থেকে সংগ্রহ শুরু হয়েছে।'
    }
  ];

  for (const act of activitiesData) {
    await Activity.findOneAndUpdate({ activityId: act.activityId }, { $set: act }, { upsert: true, new: true });
    console.log(`  ✓ Activity: ${act.name} (${act.status})`);
  }

  // -----------------------------------------------------------------
  // 4. VENDORS (Local Partners)
  // -----------------------------------------------------------------
  console.log('\n[4/12] Seeding Commercial Vendors...');
  const vendorsData = [
    {
      vendorId: 'WCC-VND-000001',
      name: 'আল-মদিনা টেক্সটাইল মিলস',
      serviceType: 'টেক্সটাইল ও কম্বল সরবরাহকারী',
      contactPerson: 'আলহাজ্ব রফিকুল ইসলাম',
      phone: '01711-334455',
      email: 'info@almadinatex.com',
      address: 'ইসলামপুর রোড, ঢাকা',
      totalTransactions: 3,
      totalPaid: 240000,
      outstandingBalance: 0
    },
    {
      vendorId: 'WCC-VND-000002',
      name: 'পপুলার ফার্মা ডিস্ট্রিবিউটর্স',
      serviceType: 'মেডিকেল সরবরাহ ও ঔষধ',
      contactPerson: 'মোঃ কামরুল হাসান',
      phone: '01819-445566',
      email: 'popularpharma.barishal@gmail.com',
      address: 'মেডিকেল কলেজ রোড, বরিশাল',
      totalTransactions: 4,
      totalPaid: 195000,
      outstandingBalance: 0
    },
    {
      vendorId: 'WCC-VND-000003',
      name: 'বর্ণালী অফসেট প্রেস',
      serviceType: 'প্রিন্টিং ও প্রকাশনা',
      contactPerson: 'সুমন চন্দ্র শীল',
      phone: '01715-778899',
      address: 'সদর রোড, ঝালকাঠি',
      totalTransactions: 6,
      totalPaid: 45000,
      outstandingBalance: 0
    },
    {
      vendorId: 'WCC-VND-000004',
      name: 'ঝালকাঠি পরিবহন সংস্থা',
      serviceType: 'পরিবহন ও লজিস্টিকস',
      contactPerson: 'মোঃ কবির হোসেন',
      phone: '01712-889900',
      address: 'বাস টার্মিনাল, ঝালকাঠি',
      totalTransactions: 2,
      totalPaid: 17000,
      outstandingBalance: 0
    }
  ];

  for (const v of vendorsData) {
    await Vendor.findOneAndUpdate({ vendorId: v.vendorId }, { $set: v }, { upsert: true, new: true });
    console.log(`  ✓ Vendor: ${v.name} (${v.serviceType})`);
  }

  // -----------------------------------------------------------------
  // 5. INCOME RECORDS
  // -----------------------------------------------------------------
  console.log('\n[5/12] Seeding Financial Incomes...');
  const incomeData = [
    {
      incomeId: 'WCC-INC-2026-000001',
      date: '2026-01-08',
      incomeType: 'Donation',
      sourceOrDonor: 'ড. জামিলুর রেজা (ইউকে প্রবাসী)',
      activityId: 'WCC-ACT-2026-000015',
      activityName: 'Winter Warm Clothes & Blanket Distribution Drive',
      amount: 100000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      referenceNo: 'TXN-BRAC-9921',
      remarks: 'শীতবস্ত্র তহবিলে সরাসরি সাহায্য।',
      createdBy: 'admin@wecanchange.org'
    },
    {
      incomeId: 'WCC-INC-2026-000002',
      date: '2026-02-01',
      incomeType: 'Project Grant',
      sourceOrDonor: 'সোস্যাল হেলথ এইড ট্রাস্ট',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      amount: 150000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      referenceNo: 'GRT-2026-SH-09',
      remarks: 'বিনামূল্যে স্বাস্থ্য ক্যাম্পের জন্য বরাদ্দকৃত অনুদান।',
      createdBy: 'admin@wecanchange.org'
    },
    {
      incomeId: 'WCC-INC-2026-000003',
      date: '2026-02-20',
      incomeType: 'Membership Fee',
      sourceOrDonor: 'সাধারণ ও আজীবন সদস্যবৃন্দের বার্ষিক চাঁদা সংগ্রহ',
      amount: 45000,
      paymentMethod: 'bKash',
      accountId: 'WCC-ACC-000003',
      accountName: 'bKash Merchant / Donation Wallet',
      referenceNo: 'BKASH-BULK-0220',
      remarks: 'ফেব্রুয়ারি মাসের সংগৃহীত সদস্য চাঁদা।',
      createdBy: 'finance@wecanchange.org'
    },
    {
      incomeId: 'WCC-INC-2026-000004',
      date: '2026-03-02',
      incomeType: 'Sponsorship',
      sourceOrDonor: 'টেকনোলজি সল্যুশনস লিমিটেড',
      activityId: 'WCC-ACT-2026-000018',
      activityName: 'Youth IT Skills & Freelancing Bootcamp 2026',
      amount: 50000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      referenceNo: 'TS-SPON-2026-01',
      remarks: 'আইটি বুটক্যাম্পের স্পনসরশিপ।',
      createdBy: 'admin@wecanchange.org'
    }
  ];

  for (const inc of incomeData) {
    await Income.findOneAndUpdate({ incomeId: inc.incomeId }, { $set: inc }, { upsert: true, new: true });
    console.log(`  ✓ Income: ${inc.incomeId} — ৳ ${inc.amount.toLocaleString()} from ${inc.sourceOrDonor}`);
  }

  // -----------------------------------------------------------------
  // 6. EXPENSE RECORDS
  // -----------------------------------------------------------------
  console.log('\n[6/12] Seeding Financial Expenses...');
  const expenseData = [
    {
      expenseId: 'WCC-EXP-2026-000001',
      date: '2026-01-10',
      activityId: 'WCC-ACT-2026-000015',
      activityName: 'Winter Warm Clothes & Blanket Distribution Drive',
      category: 'Purchase',
      description: 'উন্নত মানের ৮০০ পিস কম্বল সরাসরি কারখানা থেকে পাইকারি ক্রয়',
      amount: 80000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      paidBy: 'Md. Tanvir Ahmed',
      vendorOrMember: 'আল-মদিনা টেক্সটাইল মিলস, ঢাকা',
      referenceNo: 'INV-TEX-2026-44',
      status: 'Paid',
      isPersonalExpense: false,
      createdBy: 'finance@wecanchange.org'
    },
    {
      expenseId: 'WCC-EXP-2026-000002',
      date: '2026-01-12',
      activityId: 'WCC-ACT-2026-000015',
      activityName: 'Winter Warm Clothes & Blanket Distribution Drive',
      category: 'Transportation',
      description: 'ট্রাক ভাড়া ঢাকা টু ঝালকাঠি ও স্থানীয় ভ্যান পরিবহন',
      amount: 8500,
      paymentMethod: 'Cash',
      accountId: 'WCC-ACC-000001',
      accountName: 'Cash in Hand (Main Vault)',
      paidBy: 'Ahsan Habib',
      vendorOrMember: 'ঝালকাঠি পরিবহন সংস্থা',
      referenceNo: 'VCH-TRP-0012',
      status: 'Paid',
      isPersonalExpense: false,
      createdBy: 'finance@wecanchange.org'
    },
    {
      expenseId: 'WCC-EXP-2026-000003',
      date: '2026-02-14',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Medical Supplies',
      description: 'জরুরি প্রেসক্রিপশন ও ডায়াবেটিস/ব্লাড প্রেশার টেস্ট কিট ও ঔষধ ক্রয়',
      amount: 82500,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      paidBy: 'Dr. Mostafizur Rahman',
      vendorOrMember: 'পপুলার ফার্মা ডিস্ট্রিবিউটর্স, বরিশাল',
      referenceNo: 'INV-MED-8819',
      status: 'Paid',
      isPersonalExpense: false,
      createdBy: 'finance@wecanchange.org'
    },
    {
      expenseId: 'WCC-EXP-2026-000004',
      date: '2026-02-15',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Food & Refreshment',
      description: 'ক্যাম্পে কর্মরত ২৫ জন চিকিৎসক ও সেচ্ছাসেবীদের খাবার ও নাস্তা',
      amount: 12500,
      paymentMethod: 'Cash',
      accountId: 'WCC-ACC-000001',
      accountName: 'Cash in Hand (Main Vault)',
      paidBy: 'Md. Tanvir Ahmed',
      vendorOrMember: 'রয়েল ডাইনিং রেস্তোরাঁ, ঝালকাঠি',
      referenceNo: 'FD-RC-044',
      status: 'Paid',
      isPersonalExpense: false,
      createdBy: 'finance@wecanchange.org'
    },
    {
      expenseId: 'WCC-EXP-2026-000005',
      date: '2026-02-16',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Printing & Stationery',
      description: 'প্রেসক্রিপশন প্যাড, ক্যাম্প ব্যানার ও দিকনির্দেশক সাইনবোর্ড প্রিন্ট',
      amount: 6400,
      paymentMethod: 'Cash',
      accountId: 'WCC-ACC-000001',
      accountName: 'Cash in Hand (Main Vault)',
      paidBy: 'তানভীর আহমেদ চৌধুরী',
      vendorOrMember: 'বর্ণালী অফসেট প্রেস, ঝালকাঠি',
      referenceNo: 'BILL-PR-901',
      status: 'Approved',
      isPersonalExpense: true,
      reimbursementId: 'WCC-REIM-2026-000001',
      createdBy: 'tanvir.chowdhury@example.com'
    }
  ];

  for (const exp of expenseData) {
    await Expense.findOneAndUpdate({ expenseId: exp.expenseId }, { $set: exp }, { upsert: true, new: true });
    console.log(`  ✓ Expense: ${exp.expenseId} — ৳ ${exp.amount.toLocaleString()} (${exp.category})`);
  }

  // -----------------------------------------------------------------
  // 7. TRANSACTIONS (Master Ledger)
  // -----------------------------------------------------------------
  console.log('\n[7/12] Seeding Master Ledger Transactions...');
  const transactionsData = [
    {
      transactionId: 'WCC-TXN-2026-000001',
      date: '2026-01-08',
      type: 'Income',
      activityId: 'WCC-ACT-2026-000015',
      activityName: 'Winter Warm Clothes & Blanket Distribution Drive',
      category: 'Donation',
      description: 'প্রবাসী শুভানুধ্যায়ী কর্তৃক শীতবস্ত্র তহবিলে সাধারণ অনুদান',
      amount: 100000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      receivedFrom: 'ড. জামিলুর রেজা (ইউকে প্রবাসী)',
      referenceNo: 'TXN-BRAC-9921',
      status: 'Paid',
      createdBy: 'admin@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000002',
      date: '2026-01-10',
      type: 'Expense',
      activityId: 'WCC-ACT-2026-000015',
      activityName: 'Winter Warm Clothes & Blanket Distribution Drive',
      category: 'Purchase',
      description: 'উন্নত মানের ৮০০ পিস কম্বল সরাসরি কারখানা থেকে পাইকারি ক্রয়',
      amount: 80000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      paidBy: 'Md. Tanvir Ahmed',
      vendorOrMember: 'আল-মদিনা টেক্সটাইল মিলস, ঢাকা',
      referenceNo: 'INV-TEX-2026-44',
      status: 'Paid',
      createdBy: 'finance@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000003',
      date: '2026-01-12',
      type: 'Expense',
      activityId: 'WCC-ACT-2026-000015',
      activityName: 'Winter Warm Clothes & Blanket Distribution Drive',
      category: 'Transportation',
      description: 'ট্রাক ভাড়া ঢাকা টু ঝালকাঠি ও স্থানীয় ভ্যান পরিবহন',
      amount: 8500,
      paymentMethod: 'Cash',
      accountId: 'WCC-ACC-000001',
      accountName: 'Cash in Hand (Main Vault)',
      paidBy: 'Ahsan Habib',
      vendorOrMember: 'ঝালকাঠি পরিবহন সংস্থা',
      referenceNo: 'VCH-TRP-0012',
      status: 'Paid',
      createdBy: 'finance@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000004',
      date: '2026-02-01',
      type: 'Income',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Project Grant',
      description: 'কমিউনিটি হেলথ ইনিশিয়েটিভ বিশেষ স্বাস্থ্য সহায়তা অনুদান',
      amount: 150000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      receivedFrom: 'সোস্যাল হেলথ এইড ট্রাস্ট',
      referenceNo: 'GRT-2026-SH-09',
      status: 'Paid',
      createdBy: 'admin@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000005',
      date: '2026-02-14',
      type: 'Expense',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Medical Supplies',
      description: 'জরুরি প্রেসক্রিপশন ও ডায়াবেটিস/ব্লাড প্রেশার টেস্ট কিট ও ঔষধ ক্রয়',
      amount: 82500,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      paidBy: 'Dr. Mostafizur Rahman',
      vendorOrMember: 'পপুলার ফার্মা ডিস্ট্রিবিউটর্স, বরিশাল',
      referenceNo: 'INV-MED-8819',
      status: 'Paid',
      createdBy: 'finance@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000006',
      date: '2026-02-15',
      type: 'Expense',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Food & Refreshment',
      description: 'ক্যাম্পে কর্মরত ২৫ জন চিকিৎসক ও সেচ্ছাসেবীদের দুপুরের খাবার ও নাস্তা',
      amount: 12500,
      paymentMethod: 'Cash',
      accountId: 'WCC-ACC-000001',
      accountName: 'Cash in Hand (Main Vault)',
      paidBy: 'Md. Tanvir Ahmed',
      vendorOrMember: 'রয়েল ডাইনিং রেস্তোরাঁ, ঝালকাঠি',
      referenceNo: 'FD-RC-044',
      status: 'Paid',
      createdBy: 'finance@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000007',
      date: '2026-02-20',
      type: 'Income',
      category: 'Membership Fee',
      description: 'ফেব্রুয়ারি মাসের সাধারণ ও আজীবন সদস্য চাঁদা সংগ্রহ',
      amount: 45000,
      paymentMethod: 'bKash',
      accountId: 'WCC-ACC-000003',
      accountName: 'bKash Merchant / Donation Wallet',
      receivedFrom: 'সদস্যবৃন্দ',
      referenceNo: 'BKASH-BULK-0220',
      status: 'Paid',
      createdBy: 'finance@wecanchange.org'
    },
    {
      transactionId: 'WCC-TXN-2026-000008',
      date: '2026-03-02',
      type: 'Income',
      activityId: 'WCC-ACT-2026-000018',
      activityName: 'Youth IT Skills & Freelancing Bootcamp 2026',
      category: 'Sponsorship',
      description: 'আইটি বুটক্যাম্পের স্পনসরশিপ ও প্রশিক্ষণ সহায়তা',
      amount: 50000,
      paymentMethod: 'Bank Transfer',
      accountId: 'WCC-ACC-000002',
      accountName: 'Main Bank Account (BRAC Bank PLC)',
      receivedFrom: 'টেকনোলজি সল্যুশনস লিমিটেড',
      referenceNo: 'TS-SPON-2026-01',
      status: 'Paid',
      createdBy: 'admin@wecanchange.org'
    }
  ];

  for (const txn of transactionsData) {
    await Transaction.findOneAndUpdate({ transactionId: txn.transactionId }, { $set: txn }, { upsert: true, new: true });
    console.log(`  ✓ Transaction: ${txn.transactionId} [${txn.type}] — ৳ ${txn.amount.toLocaleString()}`);
  }

  // -----------------------------------------------------------------
  // 8. ADVANCES & REIMBURSEMENTS
  // -----------------------------------------------------------------
  console.log('\n[8/12] Seeding Advances and Reimbursements...');
  const advancesData = [
    {
      advanceId: 'WCC-ADV-2026-000001',
      memberId: 'WCC-2026-0001',
      memberName: 'তানভীর আহমেদ চৌধুরী',
      activityId: 'WCC-ACT-2026-000018',
      activityName: 'Youth IT Skills & Freelancing Bootcamp 2026',
      purpose: 'বুটক্যাম্পের ল্যাব সেটআপ, ইন্টারনেট সংযোগ ও মাল্টিমিডিয়া প্রজেক্টর ভাড়া',
      advanceAmount: 25000,
      disbursementDate: '2026-02-28',
      paymentMethod: 'bKash',
      accountId: 'WCC-ACC-000003',
      accountName: 'bKash Merchant / Donation Wallet',
      paymentReference: 'ADV-BK-0091',
      status: 'Issued',
      actualExpenseSubmitted: 18500,
      settlementBalance: 6500,
      settlementType: 'Refund Received',
      approvedBy: 'admin@wecanchange.org',
      notes: 'প্রশিক্ষণ সমাপ্তির পর হিসাব চূড়ান্ত হবে।'
    }
  ];

  for (const adv of advancesData) {
    await Advance.findOneAndUpdate({ advanceId: adv.advanceId }, { $set: adv }, { upsert: true, new: true });
    console.log(`  ✓ Advance: ${adv.advanceId} for ${adv.memberName} (৳ ${adv.advanceAmount.toLocaleString()})`);
  }

  const reimbursementsData = [
    {
      reimbursementId: 'WCC-REIM-2026-000001',
      memberId: 'WCC-2026-0001',
      memberName: 'তানভীর আহমেদ চৌধুরী',
      expenseId: 'WCC-EXP-2026-000005',
      activityId: 'WCC-ACT-2026-000012',
      activityName: 'WCC Free Health Camp – Jhalokathi',
      category: 'Printing & Stationery',
      description: 'প্রেসক্রিপশন প্যাড ও ক্যাম্পের ব্যানার ব্যক্তিগত তহবিল থেকে অগ্রিম পরিশোধ',
      amount: 6400,
      requestDate: '2026-02-16',
      approvalStatus: 'Approved',
      paymentDate: '2026-02-18',
      paymentMethod: 'bKash',
      paymentAccountId: 'WCC-ACC-000003',
      notes: 'ভাউচার ও রসিদ যাচাইকৃত ও অনুমোদিত।'
    },
    {
      reimbursementId: 'WCC-REIM-2026-000002',
      memberId: 'WCC-2026-0003',
      memberName: 'মোঃ নাজমুল হাসান',
      activityId: 'WCC-ACT-2026-000018',
      activityName: 'Youth IT Skills & Freelancing Bootcamp 2026',
      category: 'Transportation',
      description: 'ঢাকা থেকে রিসোর্স পার্সনদের যাতায়াত বিমান ও এসি বাস ভাড়া পরিশোধ',
      amount: 8200,
      requestDate: '2026-03-03',
      approvalStatus: 'Verified',
      notes: 'টিকিট কপি সংযুক্ত রয়েছে।'
    }
  ];

  for (const r of reimbursementsData) {
    await Reimbursement.findOneAndUpdate({ reimbursementId: r.reimbursementId }, { $set: r }, { upsert: true, new: true });
    console.log(`  ✓ Reimbursement: ${r.reimbursementId} for ${r.memberName} (৳ ${r.amount.toLocaleString()})`);
  }

  // -----------------------------------------------------------------
  // 9. MEMBERS (All 31 Verified Local Members)
  // -----------------------------------------------------------------
  console.log('\n[9/12] Seeding All 31 Verified Members...');
  for (const m of initialMembers) {
    await Member.findOneAndUpdate({ memberId: m.memberId }, { $set: m }, { upsert: true, new: true });
  }
  console.log(`  ✓ Successfully synchronized ${initialMembers.length} member profiles.`);

  // -----------------------------------------------------------------
  // 10. AUTH USERS (Leadership, Wing Coordinators, Volunteers)
  // -----------------------------------------------------------------
  console.log('\n[10/12] Seeding Role-Based Users & Wing Coordinators...');
  const salt = await bcrypt.genSalt(10);

  const usersData = [
    {
      name: 'WCC Administrator',
      email: 'admin@wecanchange.org',
      password: 'password123',
      role: 'admin',
      phone: '+880 1711-000000',
      memberId: 'WCC-ADM-0001',
      status: 'active'
    },
    {
      name: 'Finance Officer',
      email: 'finance@wecanchange.org',
      password: 'password123',
      role: 'finance_officer',
      phone: '+880 1711-000002',
      memberId: 'WCC-FIN-0001',
      status: 'active'
    },
    // Wing Coordinators for each of the 5 wings
    {
      name: 'Education Coordinator (Nayeem)',
      email: 'coordinator.education@wecanchange.org',
      password: 'password123',
      role: 'coordinator',
      assignedWing: wingDocs['education']?._id,
      phone: '+880 1711-111222',
      memberId: 'WCC-COORD-0001',
      volunteerWing: 'শিক্ষা উইং',
      status: 'active'
    },
    {
      name: 'Dr. Mostafizur Rahman',
      email: 'coordinator.health@wecanchange.org',
      password: 'password123',
      role: 'coordinator',
      assignedWing: wingDocs['health']?._id,
      phone: '+880 1715-678901',
      memberId: 'WCC-2026-0005',
      volunteerWing: 'স্বাস্থ্য উইং',
      status: 'active'
    },
    {
      name: 'Sports Coordinator (Tariqul)',
      email: 'coordinator.sports@wecanchange.org',
      password: 'password123',
      role: 'coordinator',
      assignedWing: wingDocs['sports']?._id,
      phone: '+880 1711-444555',
      memberId: 'WCC-COORD-0003',
      volunteerWing: 'খেলাধুলা উইং',
      status: 'active'
    },
    {
      name: 'Culture Coordinator (Nadia)',
      email: 'coordinator.culture@wecanchange.org',
      password: 'password123',
      role: 'coordinator',
      assignedWing: wingDocs['culture']?._id,
      phone: '+880 1711-666777',
      memberId: 'WCC-COORD-0004',
      volunteerWing: 'সংস্কৃতি উইং',
      status: 'active'
    },
    {
      name: 'Heritage Coordinator (Kamrul)',
      email: 'coordinator.heritage@wecanchange.org',
      password: 'password123',
      role: 'coordinator',
      assignedWing: wingDocs['heritage']?._id,
      phone: '+880 1711-888999',
      memberId: 'WCC-COORD-0005',
      volunteerWing: 'ঐতিহ্য উইং',
      status: 'active'
    },
    // Active Volunteers
    {
      name: 'Sumaiya Akter',
      email: 'volunteer@wecanchange.org',
      password: 'password123',
      role: 'volunteer',
      phone: '+880 1711-999888',
      memberId: 'WCC-VOL-0001',
      volunteerWing: 'স্বাস্থ্য উইং',
      volunteerInterests: ['জরুরি রক্তদান ও ব্লাড ডোনেশন ক্যাম্প', 'ফ্রি স্বাস্থ্য ও চক্ষু ক্যাম্প সহায়তা'],
      totalHours: 36,
      upazila: 'ঝালকাঠি সদর',
      district: 'ঝালকাঠি',
      status: 'active'
    },
    {
      name: 'Sadia Akter Rima',
      email: 'sadia.rima@example.com',
      password: 'password123',
      role: 'volunteer',
      phone: '01816789012',
      memberId: 'WCC-2026-0006',
      volunteerWing: 'শিক্ষা উইং',
      volunteerInterests: ['আইটি, ওয়েব ও সোশ্যাল মিডিয়া', 'যুব সম্মেলন ও সমাজ সচেতনতামূলক কাজ'],
      totalHours: 24,
      upazila: 'কাঠালিয়া',
      district: 'ঝালকাঠি',
      status: 'active'
    },
    {
      name: 'Md. Ariful Islam',
      email: 'ariful.islam@example.com',
      password: 'password123',
      role: 'volunteer',
      phone: '01917890123',
      memberId: 'WCC-2026-0007',
      volunteerWing: 'খেলাধুলা উইং',
      volunteerInterests: ['বন্যা ও দুর্যোগে জরুরি ত্রাণ বিতরণ'],
      totalHours: 18,
      upazila: 'ঝালকাঠি সদর',
      district: 'ঝালকাঠি',
      status: 'active'
    },
    // Registered General Member
    {
      name: 'Tanvir Ahmed Chowdhury',
      email: 'tanvir.chowdhury@example.com',
      password: 'password123',
      role: 'member',
      phone: '01711234567',
      memberId: 'WCC-2026-0001',
      status: 'active'
    }
  ];

  const userDocs = {};
  for (const u of usersData) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(u.password, salt);
      const created = await User.create({ ...u, password: hashedPassword });
      userDocs[u.email] = created;
      console.log(`  ✓ Created user: ${u.name} (${u.role}) — ${u.email}`);
    } else {
      if (u.assignedWing) existing.assignedWing = u.assignedWing;
      if (u.role) existing.role = u.role;
      if (u.totalHours) existing.totalHours = u.totalHours;
      if (u.volunteerWing) existing.volunteerWing = u.volunteerWing;
      if (u.volunteerInterests) existing.volunteerInterests = u.volunteerInterests;
      await existing.save();
      userDocs[u.email] = existing;
      console.log(`  ✓ Updated user: ${existing.name} (${existing.role}) — ${existing.email}`);
    }
  }

  // -----------------------------------------------------------------
  // 11. VOLUNTEER SERVICE LOGS
  // -----------------------------------------------------------------
  console.log('\n[11/12] Seeding Volunteer Service Logs...');
  const volunteerUser = userDocs['volunteer@wecanchange.org'] || (await User.findOne({ email: 'volunteer@wecanchange.org' }));
  if (volunteerUser) {
    const logsData = [
      {
        userId: volunteerUser._id,
        userEmail: volunteerUser.email,
        volunteerName: volunteerUser.name,
        driveName: 'WCC Free Health Camp – Jhalokathi',
        hours: 12,
        notes: 'প্রেসক্রিপশন বিতরণ ও ক্যাম্পের আগত রোগীদের রেজিস্ট্রেশন সহায়তা প্রদান করেছি।',
        date: new Date('2026-02-15')
      },
      {
        userId: volunteerUser._id,
        userEmail: volunteerUser.email,
        volunteerName: volunteerUser.name,
        driveName: 'Winter Warm Clothes & Blanket Distribution Drive',
        hours: 14,
        notes: 'নলছিটি উপজেলার প্রান্তিক গ্রামে শীতবস্ত্র প্যাকেট তৈরি ও বিতরণ করেছি।',
        date: new Date('2026-01-10')
      },
      {
        userId: volunteerUser._id,
        userEmail: volunteerUser.email,
        volunteerName: volunteerUser.name,
        driveName: 'Emergency Voluntary Blood Donation Campaign',
        hours: 10,
        notes: 'ঝালকাঠি সদর হাসপাতালে জরুরি রক্তের গ্রুপ নির্ণয় ও রক্তদাতাদের ডেটাবেজ আপডেট করেছি।',
        date: new Date('2026-03-05')
      }
    ];

    for (const log of logsData) {
      const exists = await VolunteerLog.findOne({ userId: log.userId, driveName: log.driveName });
      if (!exists) {
        await VolunteerLog.create(log);
        console.log(`  ✓ Volunteer log: ${log.driveName} (${log.hours} hrs)`);
      }
    }
  }

  // -----------------------------------------------------------------
  // 12. MEMBER REQUESTS (Wing Transfers & Volunteer Applications)
  // -----------------------------------------------------------------
  console.log('\n[12/12] Seeding Member Applications & Requests...');
  const memberRequestsData = [
    {
      memberId: 'WCC-2026-0001',
      memberName: 'তানভীর আহমেদ চৌধুরী',
      memberEmail: 'tanvir.chowdhury@example.com',
      type: 'wing_change',
      currentWing: 'সাধারণ উইং',
      requestedWing: 'শিক্ষা উইং',
      reason: 'ঝালকাঠির প্রত্যন্ত অঞ্চলের শিক্ষার্থীদের জন্য লাইব্রেরি ও শিক্ষাবৃত্তি কার্যক্রমে সরাসরি অংশ নিতে চাই।',
      status: 'pending'
    },
    {
      memberId: 'WCC-2026-0006',
      memberName: 'সাদিয়া আক্তার রিমা',
      memberEmail: 'sadia.rima@example.com',
      type: 'become_volunteer',
      volunteerInterests: ['জরুরি রক্তদান ও ব্লাড ডোনেশন ক্যাম্প', 'আইটি, ওয়েব ও সোশ্যাল মিডিয়া'],
      reason: 'আমি একজন একনিষ্ঠ সমাজকর্মী হিসেবে নিয়মিত মাঠপর্যায়ে সময় ও শ্রম দিতে ইচ্ছুক।',
      status: 'pending'
    },
    {
      memberId: 'WCC-2026-0007',
      memberName: 'মোঃ আরিফুল ইসলাম',
      memberEmail: 'ariful.islam@example.com',
      type: 'become_volunteer',
      volunteerInterests: ['বন্যা ও দুর্যোগে জরুরি ত্রাণ বিতরণ', 'পরিবেশ রক্ষা ও বৃক্ষরোপণ কর্মসূচি'],
      reason: 'দুর্যোগ ব্যবস্থাপনায় কাজ করার পূর্ব অভিজ্ঞতা আছে।',
      status: 'approved',
      reviewedBy: 'admin@wecanchange.org',
      reviewedAt: new Date('2026-02-01')
    }
  ];

  for (const req of memberRequestsData) {
    const existing = await MemberRequest.findOne({ memberId: req.memberId, type: req.type });
    if (!existing) {
      await MemberRequest.create(req);
      console.log(`  ✓ Request: ${req.memberName} (${req.type} — ${req.status})`);
    }
  }

  console.log('\n====================================================');
  console.log('✅ COMPREHENSIVE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('comprehensiveSeed.js')) {
  runComprehensiveSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
