import mongoose from 'mongoose';

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: function () {
        return this.userId;
      }
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

// Compound index to guarantee unique registration per user per event
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const EventRegistration =
  mongoose.models.EventRegistration ||
  mongoose.model('EventRegistration', eventRegistrationSchema);

export default EventRegistration;
