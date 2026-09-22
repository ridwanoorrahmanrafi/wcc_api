import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    issueCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    wingId: {
      type: String,
      trim: true,
      default: ''
    },
    photoUrl: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved'],
      default: 'pending',
      index: true
    },
    reporterName: {
      type: String,
      required: true,
      trim: true
    },
    reporterContact: {
      type: String,
      required: true,
      trim: true
    },
    assignedTo: {
      type: String,
      trim: true,
      default: ''
    },
    assignedToId: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const Issue = mongoose.models.Issue || mongoose.model('Issue', issueSchema);
export default Issue;
