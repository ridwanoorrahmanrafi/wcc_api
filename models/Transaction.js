import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
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
    type: {
      type: String,
      enum: ['Income', 'Expense', 'Member Reimbursement', 'Member Advance', 'Advance Settlement', 'Adjustment'],
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
    receivedFrom: {
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
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Verified', 'Approved', 'Paid', 'Cancelled'],
      default: 'Paid'
    },
    attachmentUrl: {
      type: String,
      trim: true
    },
    createdBy: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default Transaction;
