import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ['admin', 'finance_officer', 'coordinator', 'member', 'volunteer'],
      default: 'member'
    },
    phone: {
      type: String,
      trim: true
    },
    memberId: {
      type: String,
      trim: true
    },
    volunteerWing: {
      type: String,
      trim: true
    },
    assignedWing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wing'
    },
    volunteerInterests: {
      type: [String],
      default: []
    },
    totalHours: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
