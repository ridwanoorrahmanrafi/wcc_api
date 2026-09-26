import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    author: {
      type: String,
      required: true,
      trim: true
    },
    edition: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      trim: true,
      default: 'Academic'
    },
    condition: {
      type: String,
      enum: ['New', 'Like New', 'Good', 'Fair'],
      default: 'Good'
    },
    language: {
      type: String,
      trim: true,
      default: 'বাংলা'
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    coverImage: {
      type: String,
      trim: true,
      default: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600'
    },
    pickupLocation: {
      type: String,
      trim: true,
      default: 'ঝালকাঠি সদর'
    },
    donor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      name: { type: String, required: true },
      phone: { type: String, default: '' },
      email: { type: String, default: '' }
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'requested', 'donated'],
      default: 'pending',
      index: true
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: ''
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Book = mongoose.models.Book || mongoose.model('Book', bookSchema);
export default Book;
