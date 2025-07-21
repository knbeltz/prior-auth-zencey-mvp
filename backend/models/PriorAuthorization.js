const mongoose = require('mongoose');

const priorAuthorizationSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
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
  requestDetails: {
    requestedService: {
      type: String,
      required: true,
    },
    serviceCode: {
      type: String,
    },
    diagnosisCode: {
      type: String,
    },
    requestedDate: {
      type: Date,
      required: true,
    },
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'emergent'],
      default: 'routine',
    },
    clinicalJustification: {
      type: String,
      required: true,
    },
  },
  denial: {
    denialDate: {
      type: Date,
      required: true,
    },
    denialReason: {
      type: String,
      required: true,
    },
    denialCode: {
      type: String,
    },
    denialDocument: {
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
    insuranceReviewer: {
      type: String,
    },
    denialType: {
      type: String,
      enum: ['medical_necessity', 'experimental', 'not_covered', 'documentation', 'other'],
      default: 'other',
    },
  },
  analysis: {
    analysisDate: {
      type: Date,
    },
    analysisResult: {
      type: String,
    },
    disputeOpportunities: [{
      category: {
        type: String,
        enum: ['medical_necessity', 'policy_interpretation', 'documentation', 'precedent', 'emergency'],
      },
      strength: {
        type: String,
        enum: ['weak', 'moderate', 'strong'],
      },
      description: String,
      evidence: [String],
      recommendedAction: String,
    }],
    successProbability: {
      type: Number,
      min: 0,
      max: 100,
    },
    recommendedApproach: {
      type: String,
      enum: ['peer_review', 'formal_appeal', 'expedited_review', 'external_review'],
    },
    keyArguments: [String],
    supportingEvidence: [String],
  },
  dispute: {
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'submitted', 'under_review', 'approved', 'denied', 'withdrawn'],
      default: 'pending',
    },
    submittedDate: {
      type: Date,
    },
    generatedDocuments: [{
      type: {
        type: String,
        enum: ['email', 'letter', 'phone_notes', 'peer_review'],
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      generatedAt: {
        type: Date,
        default: Date.now,
      },
      generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    }],
    followUpDate: {
      type: Date,
    },
    resolution: {
      outcome: {
        type: String,
        enum: ['approved', 'denied', 'partial_approval', 'withdrawn'],
      },
      resolutionDate: {
        type: Date,
      },
      notes: String,
    },
  },
  deadlines: {
    responseDeadline: {
      type: Date,
      required: true,
      default: function() {
        // Default to 30 days from denial date for standard appeals
        const denialDate = this.denial?.denialDate || new Date();
        return new Date(denialDate.getTime() + (30 * 24 * 60 * 60 * 1000));
      }
    },
    urgentResponseDeadline: {
      type: Date,
      // Set if urgent/expedited review is needed
    },
    externalReviewDeadline: {
      type: Date,
      // Set if external review is required
    },
    deadlineFlags: [{
      type: {
        type: String,
        enum: ['warning', 'urgent', 'overdue'],
        required: true
      },
      daysRemaining: {
        type: Number,
        required: true
      },
      flaggedAt: {
        type: Date,
        default: Date.now
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }]
  },
  validation: {
    preSubmissionChecks: [{
      checkType: {
        type: String,
        enum: [
          'cpt_code_validation',
          'icd_code_validation', 
          'patient_demographics',
          'insurance_verification',
          'medical_necessity',
          'documentation_completeness',
          'prior_authorization_history'
        ],
        required: true
      },
      status: {
        type: String,
        enum: ['pending', 'passed', 'failed', 'warning'],
        default: 'pending'
      },
      message: String,
      details: mongoose.Schema.Types.Mixed,
      checkedAt: {
        type: Date,
        default: Date.now
      }
    }],
    overallValidationStatus: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'warning'],
      default: 'pending'
    },
    canSubmit: {
      type: Boolean,
      default: false
    },
    lastValidated: Date
  },
  timeline: [{
    action: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    documentType: {
      type: String,
      enum: ['medical_records', 'lab_results', 'imaging', 'correspondence', 'other'],
      default: 'other',
    },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
priorAuthorizationSchema.index({ patient: 1, createdAt: -1 });
priorAuthorizationSchema.index({ patientGroup: 1, 'dispute.status': 1 });
priorAuthorizationSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for dispute age in days
priorAuthorizationSchema.virtual('disputeAge').get(function() {
  if (!this.dispute.submittedDate) return null;
  const today = new Date();
  const submittedDate = new Date(this.dispute.submittedDate);
  const diffTime = Math.abs(today - submittedDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to add timeline entry
priorAuthorizationSchema.methods.addTimelineEntry = function(action, performedBy, notes) {
  this.timeline.push({
    action,
    performedBy,
    notes,
    date: new Date(),
  });
};

// Method to check and update deadline flags
priorAuthorizationSchema.methods.updateDeadlineFlags = function() {
  const now = new Date();
  const responseDeadline = this.deadlines.responseDeadline;
  
  if (!responseDeadline) return;
  
  const daysRemaining = Math.ceil((responseDeadline - now) / (1000 * 60 * 60 * 24));
  
  // Clear existing unresolved flags
  this.deadlines.deadlineFlags = this.deadlines.deadlineFlags.filter(flag => flag.resolved);
  
  if (daysRemaining < 0) {
    // Overdue
    this.deadlines.deadlineFlags.push({
      type: 'overdue',
      daysRemaining: Math.abs(daysRemaining),
      flaggedAt: new Date()
    });
  } else if (daysRemaining <= 3) {
    // Urgent - 3 days or less
    this.deadlines.deadlineFlags.push({
      type: 'urgent',
      daysRemaining,
      flaggedAt: new Date()
    });
  } else if (daysRemaining <= 7) {
    // Warning - 7 days or less
    this.deadlines.deadlineFlags.push({
      type: 'warning',
      daysRemaining,
      flaggedAt: new Date()
    });
  }
};

// Method to run pre-submission validation
priorAuthorizationSchema.methods.runPreSubmissionValidation = async function() {
  const validationResults = [];
  
  // CPT Code Validation
  const cptValidation = await this.validateCPTCode();
  validationResults.push(cptValidation);
  
  // ICD Code Validation  
  const icdValidation = await this.validateICDCode();
  validationResults.push(icdValidation);
  
  // Patient Demographics
  const demographicsValidation = await this.validatePatientDemographics();
  validationResults.push(demographicsValidation);
  
  // Insurance Verification
  const insuranceValidation = await this.validateInsurance();
  validationResults.push(insuranceValidation);
  
  // Medical Necessity Documentation
  const medicalNecessityValidation = await this.validateMedicalNecessity();
  validationResults.push(medicalNecessityValidation);
  
  // Documentation Completeness
  const documentationValidation = await this.validateDocumentation();
  validationResults.push(documentationValidation);
  
  // Prior Authorization History
  const historyValidation = await this.validatePriorAuthHistory();
  validationResults.push(historyValidation);
  
  // Update validation status
  this.validation.preSubmissionChecks = validationResults;
  this.validation.lastValidated = new Date();
  
  // Determine overall status
  const hasErrors = validationResults.some(result => result.status === 'failed');
  const hasWarnings = validationResults.some(result => result.status === 'warning');
  
  if (hasErrors) {
    this.validation.overallValidationStatus = 'failed';
    this.validation.canSubmit = false;
  } else if (hasWarnings) {
    this.validation.overallValidationStatus = 'warning';
    this.validation.canSubmit = true; // Allow submission with warnings
  } else {
    this.validation.overallValidationStatus = 'passed';
    this.validation.canSubmit = true;
  }
  
  return this.validation;
};

// Individual validation methods
priorAuthorizationSchema.methods.validateCPTCode = async function() {
  const serviceCode = this.requestDetails.serviceCode;
  
  if (!serviceCode) {
    return {
      checkType: 'cpt_code_validation',
      status: 'failed',
      message: 'CPT/Service code is required',
      details: { missingCode: true }
    };
  }
  
  // Basic CPT code format validation (5 digits or 5 digits + 2 character modifier)
  const cptPattern = /^\d{5}(-[A-Z0-9]{2})?$/;
  if (!cptPattern.test(serviceCode)) {
    return {
      checkType: 'cpt_code_validation',
      status: 'failed',
      message: 'Invalid CPT code format. Should be 5 digits (e.g., 99213) or 5 digits with modifier (e.g., 99213-25)',
      details: { invalidFormat: true, providedCode: serviceCode }
    };
  }
  
  const codeNumber = parseInt(serviceCode.split('-')[0]);
  
  if (codeNumber < 10000 || codeNumber > 99999) {
    return {
      checkType: 'cpt_code_validation',
      status: 'failed',
      message: 'CPT code out of valid range',
      details: { outOfRange: true, providedCode: serviceCode }
    };
  }
  
  return {
    checkType: 'cpt_code_validation',
    status: 'passed',
    message: 'CPT code format is valid',
    details: { validatedCode: serviceCode }
  };
};

priorAuthorizationSchema.methods.validateICDCode = async function() {
  const diagnosisCode = this.requestDetails.diagnosisCode;
  
  if (!diagnosisCode) {
    return {
      checkType: 'icd_code_validation',
      status: 'warning',
      message: 'ICD diagnosis code is recommended for stronger medical necessity',
      details: { missingCode: true }
    };
  }
  
  // ICD-10 format validation (basic)
  const icd10Pattern = /^[A-Z]\d{2}(\.\d{1,4})?$/;
  if (!icd10Pattern.test(diagnosisCode)) {
    return {
      checkType: 'icd_code_validation',
      status: 'failed',
      message: 'Invalid ICD-10 code format. Should be like A12.34 or Z12',
      details: { invalidFormat: true, providedCode: diagnosisCode }
    };
  }
  
  return {
    checkType: 'icd_code_validation',
    status: 'passed',
    message: 'ICD code format is valid',
    details: { validatedCode: diagnosisCode }
  };
};

priorAuthorizationSchema.methods.validatePatientDemographics = async function() {
  await this.populate('patient');
  const patient = this.patient;
  
  const issues = [];
  
  if (!patient.firstName || patient.firstName.trim().length < 2) {
    issues.push('Patient first name is missing or too short');
  }
  
  if (!patient.lastName || patient.lastName.trim().length < 2) {
    issues.push('Patient last name is missing or too short');
  }
  
  if (!patient.dateOfBirth) {
    issues.push('Patient date of birth is required');
  } else {
    const age = (new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 0 || age > 150) {
      issues.push('Patient date of birth appears to be invalid');
    }
  }
  
  if (!patient.insuranceInfo?.provider) {
    issues.push('Insurance provider information is missing');
  }
  
  if (!patient.insuranceInfo?.policyNumber) {
    issues.push('Insurance policy number is missing');
  }
  
  if (issues.length > 0) {
    return {
      checkType: 'patient_demographics',
      status: 'failed',
      message: 'Patient demographic information is incomplete',
      details: { issues }
    };
  }
  
  return {
    checkType: 'patient_demographics',
    status: 'passed',
    message: 'Patient demographic information is complete',
    details: { validated: true }
  };
};

priorAuthorizationSchema.methods.validateInsurance = async function() {
  await this.populate('patient');
  const insurance = this.patient.insuranceInfo;
  
  const issues = [];
  
  if (!insurance.provider || insurance.provider.trim().length < 3) {
    issues.push('Insurance provider name is required');
  }
  
  if (!insurance.policyNumber || insurance.policyNumber.trim().length < 5) {
    issues.push('Valid insurance policy number is required');
  }
  
  // Check if insurance might be expired
  if (insurance.expirationDate && new Date(insurance.expirationDate) < new Date()) {
    issues.push('Insurance policy appears to be expired');
  }
  
  if (issues.length > 0) {
    return {
      checkType: 'insurance_verification',
      status: 'failed',
      message: 'Insurance information needs verification',
      details: { issues }
    };
  }
  
  // Warning if no group number (common requirement)
  if (!insurance.groupNumber) {
    return {
      checkType: 'insurance_verification',
      status: 'warning',
      message: 'Insurance group number is missing - may be required by some payers',
      details: { missingGroupNumber: true }
    };
  }
  
  return {
    checkType: 'insurance_verification',
    status: 'passed',
    message: 'Insurance information appears complete',
    details: { validated: true }
  };
};

priorAuthorizationSchema.methods.validateMedicalNecessity = async function() {
  const justification = this.requestDetails.clinicalJustification;
  
  if (!justification || justification.trim().length < 50) {
    return {
      checkType: 'medical_necessity',
      status: 'failed',
      message: 'Clinical justification must be at least 50 characters and provide detailed medical necessity',
      details: { 
        currentLength: justification?.length || 0,
        minimumRequired: 50
      }
    };
  }
  
  // Check for key medical necessity components
  const hasSymptoms = /symptom|pain|dysfunction|impair|limit|restrict/i.test(justification);
  const hasTreatment = /treat|therapy|intervention|procedure|medication/i.test(justification);
  const hasOutcome = /improve|resolve|prevent|manage|control/i.test(justification);
  
  const missingComponents = [];
  if (!hasSymptoms) missingComponents.push('patient symptoms/condition description');
  if (!hasTreatment) missingComponents.push('proposed treatment description');
  if (!hasOutcome) missingComponents.push('expected outcomes/benefits');
  
  if (missingComponents.length > 1) {
    return {
      checkType: 'medical_necessity',
      status: 'warning',
      message: 'Clinical justification could be strengthened',
      details: { 
        suggestedAdditions: missingComponents,
        tip: 'Include patient symptoms, proposed treatment, and expected outcomes'
      }
    };
  }
  
  return {
    checkType: 'medical_necessity',
    status: 'passed',
    message: 'Clinical justification appears comprehensive',
    details: { validated: true }
  };
};

priorAuthorizationSchema.methods.validateDocumentation = async function() {
  await this.populate('patient');
  const patient = this.patient;
  
  const issues = [];
  const warnings = [];
  
  // Check for denial documentation
  if (!this.denial.denialDocument && !this.denial.denialReason) {
    issues.push('Denial letter or documentation is missing');
  }
  
  // Check patient medical documentation
  if (!patient.medicalInfo?.diagnosis || patient.medicalInfo.diagnosis.length === 0) {
    warnings.push('Patient diagnosis information is missing from medical records');
  }
  
  if (!patient.documents || patient.documents.length === 0) {
    warnings.push('No supporting medical documents uploaded');
  }
  
  // Check for recent relevant documentation
  const sixMonthsAgo = new Date(Date.now() - (6 * 30 * 24 * 60 * 60 * 1000));
  const recentDocs = patient.documents?.filter(doc => 
    new Date(doc.uploadedAt) > sixMonthsAgo && 
    ['ehr', 'lab_results', 'imaging'].includes(doc.documentType)
  ) || [];
  
  if (recentDocs.length === 0) {
    warnings.push('No recent medical documentation (within 6 months) found');
  }
  
  if (issues.length > 0) {
    return {
      checkType: 'documentation_completeness',
      status: 'failed',
      message: 'Critical documentation is missing',
      details: { issues, warnings }
    };
  }
  
  if (warnings.length > 0) {
    return {
      checkType: 'documentation_completeness',
      status: 'warning',
      message: 'Documentation could be more complete',
      details: { warnings }
    };
  }
  
  return {
    checkType: 'documentation_completeness',
    status: 'passed',
    message: 'Documentation appears complete',
    details: { validated: true }
  };
};

priorAuthorizationSchema.methods.validatePriorAuthHistory = async function() {
  await this.populate('patient');
  const patient = this.patient;
  
  // Check for duplicate or recent similar requests
  const PriorAuthorization = this.constructor;
  const similarRequests = await PriorAuthorization.find({
    patient: patient._id,
    'requestDetails.serviceCode': this.requestDetails.serviceCode,
    _id: { $ne: this._id },
    createdAt: { $gte: new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)) } // Last 90 days
  });
  
  if (similarRequests.length > 0) {
    const approvedRequests = similarRequests.filter(req => 
      req.dispute?.resolution?.outcome === 'approved'
    );
    
    if (approvedRequests.length > 0) {
      return {
        checkType: 'prior_authorization_history',
        status: 'warning',
        message: 'Similar service was recently approved - verify if new request is needed',
        details: { 
          recentApprovals: approvedRequests.length,
          lastApproval: approvedRequests[0].dispute.resolution.resolutionDate
        }
      };
    }
    
    const deniedRequests = similarRequests.filter(req => 
      req.dispute?.resolution?.outcome === 'denied'
    );
    
    if (deniedRequests.length > 0) {
      return {
        checkType: 'prior_authorization_history',
        status: 'warning',
        message: 'Similar service was recently denied - ensure new information supports this request',
        details: { 
          recentDenials: deniedRequests.length,
          lastDenial: deniedRequests[0].dispute.resolution.resolutionDate
        }
      };
    }
  }
  
  return {
    checkType: 'prior_authorization_history',
    status: 'passed',
    message: 'No conflicting prior authorization history found',
    details: { validated: true }
  };
};

module.exports = mongoose.model('PriorAuthorization', priorAuthorizationSchema);