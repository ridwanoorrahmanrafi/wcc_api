import mongoose from 'mongoose';

const reimbursementSchema = new mongoose.Schema(
  {
    reimbursementId: {
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
    expenseId: {
      type: String,
      trim: true
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
    requestDate: {
      type: String,
      required: true
    },
    approvalStatus: {
      type: String,
      enum: ['Submitted', 'Verified', 'Approved', 'Paid', 'Rejected'],
      default: 'Submitted'
    },
    paymentDate: {
      type: String,
      trim: true
    },
    paymentMethod: {
      type: String,
      trim: true
    },
    paymentAccountId: {
      type: String,
      trim: true
    },
    paymentReference: {
      type: String,
      trim: true
    },
    billUrl: {
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

const Reimbursement = mongoose.models.Reimbursement || mongoose.model('Reimbursement', reimbursementSchema);
export default Reimbursement;
