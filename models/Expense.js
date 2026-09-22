import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    expenseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    date: {
      type: String,
      required: true
    },
    activityId: {
      type: String,
      trim: true
    },
    activityName: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'bKash', 'Nagad', 'Rocket'],
      default: 'Cash'
    },
    accountId: {
      type: String,
      trim: true
    },
    accountName: {
      type: String,
      trim: true
    },
    paidBy: {
      type: String,
      trim: true
    },
    vendorOrMember: {
      type: String,
      trim: true
    },
    referenceNo: {
      type: String,
      trim: true
    },
    attachmentUrl: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Verified', 'Approved', 'Pending Reimbursement', 'Paid'],
      default: 'Paid'
    },
    isPersonalExpense: {
      type: Boolean,
      default: false
    },
    reimbursementId: {
      type: String,
      trim: true
    },
    settledFromAdvanceId: {
      type: String,
      trim: true
    },
    createdBy: {
      type: String,
      trim: true
    },
    remarks: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
export default Expense;
