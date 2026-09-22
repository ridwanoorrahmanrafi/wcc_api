import mongoose from 'mongoose';

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    userName: {
      type: String,
      trim: true,
      default: ''
    },
    userEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    userMemberId: {
      type: String,
      trim: true,
      default: ''
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    attended: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: one registration per user per event
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const EventRegistration = mongoose.models.EventRegistration || mongoose.model('EventRegistration', eventRegistrationSchema);
export default EventRegistration;
