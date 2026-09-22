import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    user: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: 'admin'
    },
    action: {
      type: String,
      required: true
    },
    module: {
      type: String,
      required: true
    },
    recordId: {
      type: String,
      trim: true
    },
    details: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
