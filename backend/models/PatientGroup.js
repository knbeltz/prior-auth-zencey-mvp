const mongoose = require('mongoose');

const patientGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  pendingInvitations: [{
    email: {
      type: String,
      required: true,
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    token: {
      type: String,
      required: true,
    },
  }],
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true,
    },
    autoApproveJoinRequests: {
      type: Boolean,
      default: false,
    },
  },
}, {
  timestamps: true,
});

// Index for efficient queries
patientGroupSchema.index({ owner: 1, isActive: 1 });
patientGroupSchema.index({ 'members.user': 1 });

// Virtual for member count
patientGroupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for patient count
patientGroupSchema.virtual('patientCount').get(function() {
  return this.patients.length;
});

module.exports = mongoose.model('PatientGroup', patientGroupSchema);