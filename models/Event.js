import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wing',
      required: true,
      index: true
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      index: true,
      default: null
    },
    date: {
      type: Date,
      required: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    capacity: {
      type: Number,
      min: 1
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    coverImage: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'completed', 'cancelled'],
      default: 'draft',
      lowercase: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
export default Event;
