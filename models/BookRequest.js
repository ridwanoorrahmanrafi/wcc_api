import mongoose from 'mongoose';

const bookRequestSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    requester: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      memberId: { type: String, default: '' }
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    deliveryAddress: {
      type: String,
      required: true,
      trim: true
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: ''
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ''
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const BookRequest = mongoose.models.BookRequest || mongoose.model('BookRequest', bookRequestSchema);
export default BookRequest;
