import mongoose from 'mongoose';

const memberRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: ''
    },
    memberId: {
      type: String,
      required: true,
      index: true
    },
    memberName: {
      type: String,
      required: true
    },
    memberEmail: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      enum: ['wing_change', 'become_volunteer'],
      required: true,
      index: true
    },
    currentWing: {
      type: String,
      default: 'সাধারণ উইং'
    },
    requestedWing: {
      type: String,
      default: ''
    },
    volunteerInterests: {
      type: [String],
      default: []
    },
    reason: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    adminNotes: {
      type: String,
      default: ''
    },
    reviewedBy: {
      type: String,
      default: ''
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const MemberRequest = mongoose.models.MemberRequest || mongoose.model('MemberRequest', memberRequestSchema);
export default MemberRequest;
