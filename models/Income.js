import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema(
  {
    incomeId: {
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
    incomeType: {
      type: String,
      enum: ['Donation', 'Project Grant', 'Sponsorship', 'Membership Fee', 'Event Contribution', 'Other Income'],
      default: 'Donation'
    },
    sourceOrDonor: {
      type: String,
      required: true,
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
    referenceNo: {
      type: String,
      trim: true
    },
    supportingDocUrl: {
      type: String,
      trim: true
    },
    remarks: {
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

const Income = mongoose.models.Income || mongoose.model('Income', incomeSchema);
export default Income;
