import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema(
  {
    advanceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    memberId: {
      type: String,
      required: true,
      trim: true
    },
    memberName: {
      type: String,
      required: true,
      trim: true
    },
    activityId: {
      type: String,
      required: true,
      trim: true
    },
    activityName: {
      type: String,
      required: true,
      trim: true
    },
    purpose: {
      type: String,
      required: true,
      trim: true
    },
    advanceAmount: {
      type: Number,
      required: true
    },
    disbursementDate: {
      type: String,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Rocket'],
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
    paymentReference: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Issued', 'Settled', 'Closed'],
      default: 'Issued'
    },
    actualExpenseSubmitted: {
      type: Number,
      default: 0
    },
    settlementBalance: {
      type: Number,
      default: 0
    },
    settlementType: {
      type: String,
      enum: ['Refund Received', 'Additional Reimbursement', 'Fully Settled', 'Pending'],
      default: 'Pending'
    },
    settlementId: {
      type: String,
      trim: true
    },
    approvedBy: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Advance = mongoose.models.Advance || mongoose.model('Advance', advanceSchema);
export default Advance;
