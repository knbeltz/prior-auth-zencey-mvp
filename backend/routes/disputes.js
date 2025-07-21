const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Anthropic = require('@anthropic-ai/sdk');
const PriorAuthorization = require('../models/PriorAuthorization');
const Patient = require('../models/Patient');
const PatientGroup = require('../models/PatientGroup');
const User = require('../models/User');
const auth = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Simple error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Initialize Anthropic clients
const analyzerClient = new Anthropic({
  apiKey: process.env.ANALYZER_API,
});

const disputerClient = new Anthropic({
  apiKey: process.env.DISPUTER_API,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/denials/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'denial-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Helper function to check user permissions
const checkGroupPermission = async (userId, groupId, requiredPermission = 'view') => {
  const group = await PatientGroup.findOne({
    _id: groupId,
    isActive: true,
  });

  if (!group) return false;

  const member = group.members.find(m => m.user.toString() === userId.toString());
  if (!member) return false;

  if (requiredPermission === 'view') {
    return ['view', 'edit', 'admin'].includes(member.permission);
  } else if (requiredPermission === 'edit') {
    return ['edit', 'admin'].includes(member.permission);
  } else if (requiredPermission === 'admin') {
    return member.permission === 'admin';
  }

  return false;
};

// Helper function to extract text from uploaded files
const extractTextFromFile = async (filePath, mimeType) => {
  try {
    if (mimeType === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8');
    }
    // For other file types, return a placeholder
    // In a real application, you'd use libraries like pdf-parse, mammoth, etc.
    return 'File content extraction not implemented for this file type. Please provide text content manually.';
  } catch (error) {
    console.error('Error extracting text:', error);
    return 'Error extracting text from file.';
  }
};

// @route   GET /api/disputes/patient/:patientId
// @desc    Get all disputes for a patient
// @access  Private
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.patientId,
      isActive: true,
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, patient.patientGroup, 'view');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const disputes = await PriorAuthorization.find({
      patient: req.params.patientId,
      isActive: true,
    })
    .populate('createdBy', 'firstName lastName')
    .populate('patient', 'firstName lastName')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      disputes,
    });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/disputes/:id
// @desc    Get specific dispute
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const dispute = await PriorAuthorization.findOne({
      _id: req.params.id,
      isActive: true,
    })
    .populate('createdBy', 'firstName lastName')
    .populate('patient')
    .populate('patientGroup');

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup._id, 'view');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    res.json({
      success: true,
      dispute,
    });
  } catch (error) {
    console.error('Get dispute error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/disputes
// @desc    Create new prior authorization dispute
// @access  Private
router.post('/', auth, upload.single('denialDocument'), async (req, res) => {
  try {
    // Parse JSON data from form
    let requestDetails, denial, deadlines;
    try {
      requestDetails = JSON.parse(req.body.requestDetails);
      denial = JSON.parse(req.body.denial);
      if (req.body.deadlines) {
        deadlines = JSON.parse(req.body.deadlines);
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid JSON data' });
    }

    const patient = await Patient.findOne({
      _id: req.body.patientId,
      isActive: true,
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, patient.patientGroup, 'edit');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const disputeData = {
      patient: req.body.patientId,
      patientGroup: patient.patientGroup,
      createdBy: req.user.id,
      requestDetails,
      denial,
    };

    // Add deadline if provided
    if (deadlines) {
      disputeData.deadlines = deadlines;
    }

    // Add denial document if uploaded
    if (req.file) {
      disputeData.denial.denialDocument = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      };
    }

    const dispute = new PriorAuthorization(disputeData);

    // Add initial timeline entry
    dispute.addTimelineEntry('Dispute created', req.user.id, 'Initial dispute submission');

    await dispute.save();

    // Add to patient's prior authorizations
    await Patient.findByIdAndUpdate(req.body.patientId, {
      $push: { priorAuthorizations: dispute._id },
    });

    await dispute.populate('createdBy', 'firstName lastName');
    await dispute.populate('patient', 'firstName lastName');

    res.status(201).json({
      success: true,
      dispute,
    });
  } catch (error) {
    console.error('Create dispute error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/disputes/:id/analyze
// @desc    Analyze denial using Anthropic API
// @access  Private
router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const dispute = await PriorAuthorization.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate('patient');

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'edit');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Extract denial text content
    let denialText = dispute.denial.denialReason;
    if (dispute.denial.denialDocument) {
      const filePath = path.join('uploads/denials/', dispute.denial.denialDocument.filename);
      const extractedText = await extractTextFromFile(filePath, dispute.denial.denialDocument.mimeType);
      denialText += '\n\nDenial Document Content:\n' + extractedText;
    }

    // Prepare analysis prompt
    const analysisPrompt = `
As a medical prior authorization expert, analyze this denial and identify opportunities to dispute it.

Patient Information:
- Name: ${dispute.patient.firstName} ${dispute.patient.lastName}
- Requested Service: ${dispute.requestDetails.requestedService}
- Service Code: ${dispute.requestDetails.serviceCode || 'Not provided'}
- Diagnosis Code: ${dispute.requestDetails.diagnosisCode || 'Not provided'}
- Clinical Justification: ${dispute.requestDetails.clinicalJustification}

Denial Information:
- Denial Date: ${dispute.denial.denialDate}
- Denial Reason: ${dispute.denial.denialReason}
- Denial Code: ${dispute.denial.denialCode || 'Not provided'}

Denial Content:
${denialText}

Please provide a comprehensive analysis including:
1. Dispute opportunities (categorized by strength: strong, moderate, weak)
2. Success probability estimate (0-100%)
3. Recommended approach (peer_review, formal_appeal, expedited_review, external_review)
4. Key arguments to make
5. Supporting evidence needed

Format your response as JSON with the following structure:
{
  "disputeOpportunities": [
    {
      "category": "medical_necessity|policy_interpretation|documentation|precedent|emergency",
      "strength": "strong|moderate|weak",
      "description": "Description of the opportunity",
      "evidence": ["Evidence item 1", "Evidence item 2"],
      "recommendedAction": "Specific action to take"
    }
  ],
  "successProbability": 75,
  "recommendedApproach": "peer_review",
  "keyArguments": ["Argument 1", "Argument 2"],
  "supportingEvidence": ["Evidence 1", "Evidence 2"]
}
`;

    // Call Anthropic API for analysis
    const response = await analyzerClient.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: analysisPrompt,
      }],
    });

    let analysisResult;
    try {
      analysisResult = JSON.parse(response.content[0].text);
    } catch (parseError) {
      console.error('Failed to parse analysis result:', parseError);
      analysisResult = {
        disputeOpportunities: [{
          category: 'documentation',
          strength: 'moderate',
          description: 'Analysis completed but response format needs review',
          evidence: ['Review denial letter for specific requirements'],
          recommendedAction: 'Gather additional documentation',
        }],
        successProbability: 50,
        recommendedApproach: 'formal_appeal',
        keyArguments: ['Review required'],
        supportingEvidence: ['Additional analysis needed'],
      };
    }

    // Update dispute with analysis
    dispute.analysis = {
      analysisDate: new Date(),
      analysisResult: response.content[0].text,
      disputeOpportunities: analysisResult.disputeOpportunities,
      successProbability: analysisResult.successProbability,
      recommendedApproach: analysisResult.recommendedApproach,
      keyArguments: analysisResult.keyArguments,
      supportingEvidence: analysisResult.supportingEvidence,
    };

    dispute.addTimelineEntry('Analysis completed', req.user.id, `AI analysis identified ${analysisResult.disputeOpportunities.length} dispute opportunities`);

    await dispute.save();

    // Send notification
    await notificationService.notifyAnalysisComplete(
      dispute._id,
      req.user.id,
      analysisResult.successProbability
    );

    res.json({
      success: true,
      analysis: dispute.analysis,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ message: 'Analysis failed: ' + error.message });
  }
});

// @route   POST /api/disputes/:id/generate
// @desc    Generate dispute documents using Anthropic API
// @access  Private
router.post('/:id/generate', auth, [
  body('documentType').isIn(['email', 'letter', 'phone_notes', 'peer_review']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentType } = req.body;

    const dispute = await PriorAuthorization.findOne({
      _id: req.params.id,
      isActive: true,
    })
    .populate('patient')
    .populate('createdBy', 'firstName lastName');

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'edit');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    if (!dispute.analysis || !dispute.analysis.analysisResult) {
      return res.status(400).json({ message: 'Please run analysis first before generating documents' });
    }

    // Prepare generation prompt based on document type
    const baseInfo = `
Patient: ${dispute.patient.firstName} ${dispute.patient.lastName}
Requested Service: ${dispute.requestDetails.requestedService}
Clinical Justification: ${dispute.requestDetails.clinicalJustification}
Denial Reason: ${dispute.denial.denialReason}
Key Arguments: ${dispute.analysis.keyArguments.join(', ')}
Supporting Evidence: ${dispute.analysis.supportingEvidence.join(', ')}
Recommended Approach: ${dispute.analysis.recommendedApproach}
`;

    let prompt = '';
    switch (documentType) {
      case 'email':
        prompt = `Generate a professional email to the insurance company disputing this prior authorization denial. Include a clear subject line and professional tone. Base the arguments on the analysis provided.\n\n${baseInfo}`;
        break;
      case 'letter':
        prompt = `Generate a formal business letter to dispute this prior authorization denial. Include proper letterhead format, date, and formal language. Base the arguments on the analysis provided.\n\n${baseInfo}`;
        break;
      case 'phone_notes':
        prompt = `Generate talking points and phone script for a peer-to-peer review call regarding this prior authorization denial. Include key points to emphasize and responses to potential objections.\n\n${baseInfo}`;
        break;
      case 'peer_review':
        prompt = `Generate comprehensive notes for a peer-to-peer review regarding this prior authorization denial. Include medical justification, clinical guidelines, and evidence-based arguments.\n\n${baseInfo}`;
        break;
    }

    // Call Anthropic API for document generation
    const response = await disputerClient.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const generatedContent = response.content[0].text;

    // Save generated document
    const document = {
      type: documentType,
      content: generatedContent,
      generatedBy: req.user.id,
    };

    dispute.dispute.generatedDocuments.push(document);
    dispute.addTimelineEntry(`Generated ${documentType}`, req.user.id, `AI-generated ${documentType} document created`);

    await dispute.save();

    // Send notification
    await notificationService.notifyDocumentGenerated(
      dispute._id,
      req.user.id,
      documentType
    );

    res.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ message: 'Document generation failed: ' + error.message });
  }
});

// @route   PUT /api/disputes/:id/status
// @desc    Update dispute status
// @access  Private
router.put('/:id/status', auth, [
  body('status').isIn(['pending', 'in_progress', 'submitted', 'under_review', 'approved', 'denied', 'withdrawn']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;

    const dispute = await PriorAuthorization.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'edit');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const oldStatus = dispute.dispute.status;
    dispute.dispute.status = status;

    if (status === 'submitted' && !dispute.dispute.submittedDate) {
      dispute.dispute.submittedDate = new Date();
    }

    dispute.addTimelineEntry(`Status changed from ${oldStatus} to ${status}`, req.user.id, notes);

    await dispute.save();

    // Send notification
    await notificationService.notifyStatusUpdate(
      dispute._id,
      req.user.id,
      oldStatus,
      status
    );

    res.json({
      success: true,
      dispute,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/disputes/:id/validate
// @desc    Run pre-submission validation checks
// @access  Private
router.post('/:id/validate', auth, catchAsync(async (req, res) => {
  const dispute = await PriorAuthorization.findOne({
    _id: req.params.id,
    isActive: true,
  }).populate('patient');

  if (!dispute) {
    return res.status(404).json({ message: 'Dispute not found' });
  }

  // Check permissions
  const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'edit');
  if (!hasPermission) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  try {
    // Run validation
    const validationResults = await dispute.runPreSubmissionValidation();
    
    // Save the dispute with updated validation
    await dispute.save();
    
    // Add timeline entry
    dispute.addTimelineEntry(
      'Pre-submission validation completed', 
      req.user.id, 
      `Validation status: ${validationResults.overallValidationStatus}`
    );
    await dispute.save();

    res.json({
      success: true,
      validation: validationResults,
      message: `Validation completed with status: ${validationResults.overallValidationStatus}`
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ message: 'Validation failed: ' + error.message });
  }
}));

// @route   GET /api/disputes/:id/validation-status
// @desc    Get current validation status
// @access  Private
router.get('/:id/validation-status', auth, catchAsync(async (req, res) => {
  const dispute = await PriorAuthorization.findOne({
    _id: req.params.id,
    isActive: true,
  }).select('validation deadlines');

  if (!dispute) {
    return res.status(404).json({ message: 'Dispute not found' });
  }

  // Check permissions
  const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'view');
  if (!hasPermission) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  res.json({
    success: true,
    validation: dispute.validation,
    deadlines: dispute.deadlines
  });
}));

// @route   PUT /api/disputes/:id/deadline
// @desc    Update dispute deadline
// @access  Private
router.put('/:id/deadline', auth, [
  body('newDeadline').isISO8601().withMessage('Valid deadline date required'),
  body('deadlineType').optional().isIn(['responseDeadline', 'urgentResponseDeadline', 'externalReviewDeadline'])
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation error' });
  }

  const { newDeadline, deadlineType = 'responseDeadline' } = req.body;

  const dispute = await PriorAuthorization.findOne({
    _id: req.params.id,
    isActive: true,
  });

  if (!dispute) {
    return res.status(404).json({ message: 'Dispute not found' });
  }

  // Check permissions
  const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'edit');
  if (!hasPermission) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  try {
    // Try to load deadline monitoring service
    let deadlineMonitoringService;
    try {
      deadlineMonitoringService = require('../services/deadlineMonitoringService');
    } catch (error) {
      // If service doesn't exist, update manually
      dispute.deadlines[deadlineType] = new Date(newDeadline);
      
      // Clear existing flags as deadline changed
      dispute.deadlines.deadlineFlags.forEach(flag => {
        flag.resolved = true;
      });

      // Update flags with new deadline
      dispute.updateDeadlineFlags();
      
      await dispute.save();

      // Add timeline entry
      dispute.addTimelineEntry(
        `${deadlineType} updated`, 
        req.user.id, 
        `New deadline: ${new Date(newDeadline).toLocaleDateString()}`
      );
      await dispute.save();

      return res.json({
        success: true,
        message: 'Deadline updated successfully',
        deadlines: dispute.deadlines
      });
    }

    const updatedDispute = await deadlineMonitoringService.updateDisputeDeadline(
      req.params.id, 
      newDeadline, 
      deadlineType
    );

    // Add timeline entry
    updatedDispute.addTimelineEntry(
      `${deadlineType} updated`, 
      req.user.id, 
      `New deadline: ${new Date(newDeadline).toLocaleDateString()}`
    );
    await updatedDispute.save();

    res.json({
      success: true,
      message: 'Deadline updated successfully',
      deadlines: updatedDispute.deadlines
    });

  } catch (error) {
    console.error('Update deadline error:', error);
    res.status(500).json({ message: 'Failed to update deadline: ' + error.message });
  }
}));

// @route   GET /api/disputes/deadlines/summary
// @desc    Get deadline summary for dashboard
// @access  Private
router.get('/deadlines/summary', auth, catchAsync(async (req, res) => {
  try {
    let deadlineMonitoringService;
    try {
      deadlineMonitoringService = require('../services/deadlineMonitoringService');
    } catch (error) {
      // If service doesn't exist, return empty summary
      return res.json({
        success: true,
        summary: {
          overdue: 0,
          urgent: 0,
          warning: 0,
          total: 0,
          details: []
        }
      });
    }
    
    // Get user's patient groups
    const user = await User.findById(req.user.id).populate('patientGroups.group');
    const patientGroupIds = user.patientGroups.map(pg => pg.group._id);

    const summary = await deadlineMonitoringService.getDeadlineSummary(
      req.user.id, 
      patientGroupIds
    );

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Get deadline summary error:', error);
    res.status(500).json({ message: 'Failed to get deadline summary: ' + error.message });
  }
}));

// @route   POST /api/disputes/:id/resolve-deadline-flag/:flagId
// @desc    Resolve/acknowledge a deadline flag
// @access  Private
router.post('/:id/resolve-deadline-flag/:flagId', auth, catchAsync(async (req, res) => {
  const dispute = await PriorAuthorization.findOne({
    _id: req.params.id,
    isActive: true,
  });

  if (!dispute) {
    return res.status(404).json({ message: 'Dispute not found' });
  }

  // Check permissions
  const hasPermission = await checkGroupPermission(req.user.id, dispute.patientGroup, 'edit');
  if (!hasPermission) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  try {
    let deadlineMonitoringService;
    try {
      deadlineMonitoringService = require('../services/deadlineMonitoringService');
    } catch (error) {
      // If service doesn't exist, resolve flag manually
      const flag = dispute.deadlines.deadlineFlags.id(req.params.flagId);
      if (flag) {
        flag.resolved = true;
        await dispute.save();
      }

      // Add timeline entry
      dispute.addTimelineEntry(
        'Deadline flag resolved', 
        req.user.id, 
        'Deadline reminder acknowledged'
      );
      await dispute.save();

      return res.json({
        success: true,
        message: 'Deadline flag resolved',
        deadlines: dispute.deadlines
      });
    }

    const updatedDispute = await deadlineMonitoringService.resolveDeadlineFlag(
      req.params.id, 
      req.params.flagId
    );

    // Add timeline entry
    updatedDispute.addTimelineEntry(
      'Deadline flag resolved', 
      req.user.id, 
      'Deadline reminder acknowledged'
    );
    await updatedDispute.save();

    res.json({
      success: true,
      message: 'Deadline flag resolved',
      deadlines: updatedDispute.deadlines
    });

  } catch (error) {
    console.error('Resolve deadline flag error:', error);
    res.status(500).json({ message: 'Failed to resolve deadline flag: ' + error.message });
  }
}));

// @route   POST /api/disputes/validate-codes
// @desc    Validate CPT/ICD codes independently
// @access  Private
router.post('/validate-codes', auth, [
  body('cptCode').optional(),
  body('icdCode').optional()
], catchAsync(async (req, res) => {
  const { cptCode, icdCode } = req.body;
  const results = {};

  try {
    // Create temporary dispute object for validation
    const tempDispute = new PriorAuthorization({
      requestDetails: {
        serviceCode: cptCode,
        diagnosisCode: icdCode
      }
    });

    if (cptCode) {
      results.cptValidation = await tempDispute.validateCPTCode();
    }

    if (icdCode) {
      results.icdValidation = await tempDispute.validateICDCode();
    }

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Code validation error:', error);
    res.status(500).json({ message: 'Code validation failed: ' + error.message });
  }
}));

module.exports = router;