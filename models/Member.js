import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    nameBn: {
      type: String,
      required: true,
      trim: true
    },
    nameEn: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    dob: {
      type: String,
      trim: true
    },
    father: {
      type: String,
      trim: true
    },
    mother: {
      type: String,
      trim: true
    },
    nidBrn: {
      type: String,
      trim: true
    },
    blood: {
      type: String,
      trim: true
    },
    mobile: {
      type: String,
      default: '',
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    presentAddress: {
      type: String,
      trim: true
    },
    permanentAddress: {
      type: String,
      trim: true
    },
    district: {
      type: String,
      default: 'ঝালকাঠি',
      trim: true
    },
    upazila: {
      type: String,
      default: 'ঝালকাঠি সদর',
      trim: true
    },
    currentlyStudying: {
      type: String,
      default: 'না',
      trim: true
    },
    classYear: {
      type: String,
      trim: true
    },
    currentInstitution: {
      type: String,
      trim: true
    },
    lastPublicExam: {
      type: String,
      trim: true
    },
    publicExamResult: {
      type: String,
      trim: true
    },
    lastQualification: {
      type: String,
      trim: true
    },
    lastResult: {
      type: String,
      trim: true
    },
    lastInstitution: {
      type: String,
      trim: true
    },
    profession: {
      type: String,
      trim: true
    },
    workplace: {
      type: String,
      trim: true
    },
    membership: {
      type: String,
      enum: ['General', 'Lifetime', 'Executive', 'Donor', 'Honorary'],
      default: 'General'
    },
    wing: {
      type: String,
      default: 'সাধারণ উইং',
      trim: true
    },
    reason: {
      type: String,
      trim: true
    },
    photoUrl: {
      type: String,
      trim: true,
      default: '/default-avatar.svg'
    },
    status: {
      type: String,
      enum: ['Active', 'Pending', 'Inactive', 'Suspended'],
      default: 'Active',
      index: true
    },
    joinedDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Text index for search across common fields
memberSchema.index({
  nameEn: 'text',
  nameBn: 'text',
  memberId: 'text',
  mobile: 'text',
  email: 'text',
  profession: 'text'
});

const Member = mongoose.models.Member || mongoose.model('Member', memberSchema);
export default Member;
