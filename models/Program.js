import mongoose from 'mongoose';

const programSchema = new mongoose.Schema(
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
    description: {
      type: String,
      trim: true,
      default: ''
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'completed', 'cancelled'],
      default: 'draft',
      lowercase: true,
      trim: true
    },
    coverImage: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const Program = mongoose.models.Program || mongoose.model('Program', programSchema);
export default Program;
