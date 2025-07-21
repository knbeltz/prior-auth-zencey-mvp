const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  patientId: {
    type: String,
    unique: true,
    sparse: true,
  },
  insuranceInfo: {
    provider: {
      type: String,
      required: true,
    },
    policyNumber: {
      type: String,
      required: true,
    },
    groupNumber: {
      type: String,
    },
    subscriberId: {
      type: String,
    },
    planName: {
      type: String,
    },
    effectiveDate: {
      type: Date,
    },
    expirationDate: {
      type: Date,
    },
  },
  contactInfo: {
    phone: {
      type: String,
    },
    email: {
      type: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
  },
  medicalInfo: {
    diagnosis: [{
      code: String,
      description: String,
      date: Date,
    }],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      prescribedDate: Date,
    }],
    allergies: [String],
    primaryPhysician: String,
  },
  documents: [{
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    documentType: {
      type: String,
      enum: ['ehr', 'insurance', 'lab_results', 'imaging', 'referral', 'other'],
      default: 'other',
    },
    description: String,
  }],
  priorAuthorizations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PriorAuthorization',
  }],
  patientGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientGroup',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  notes: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Index for efficient queries
patientSchema.index({ patientGroup: 1, isActive: 1 });
patientSchema.index({ 'insuranceInfo.provider': 1 });
patientSchema.index({ lastName: 1, firstName: 1 });

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

module.exports = mongoose.model('Patient', patientSchema);