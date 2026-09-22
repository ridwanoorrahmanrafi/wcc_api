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
    photoUrl: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved'],
      default: 'pending',
      lowercase: true,
      trim: true,
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wing',
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const Issue = mongoose.models.Issue || mongoose.model('Issue', issueSchema);
export default Issue;
