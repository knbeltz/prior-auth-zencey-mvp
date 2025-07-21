const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const PatientGroup = require('../models/PatientGroup');
const auth = require('../middleware/auth');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls/;
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

// @route   GET /api/patients/group/:groupId
// @desc    Get all patients in a group
// @access  Private
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const hasPermission = await checkGroupPermission(req.user.id, req.params.groupId, 'view');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const patients = await Patient.find({
      patientGroup: req.params.groupId,
      isActive: true,
    })
    .populate('createdBy', 'firstName lastName')
    .populate('priorAuthorizations')
    .sort({ lastName: 1, firstName: 1 });

    res.json({
      success: true,
      patients,
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/patients/:id
// @desc    Get specific patient
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.id,
      isActive: true,
    })
    .populate('createdBy', 'firstName lastName')
    .populate('patientGroup')
    .populate({
      path: 'priorAuthorizations',
      populate: {
        path: 'createdBy',
        select: 'firstName lastName',
      },
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, patient.patientGroup._id, 'view');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    res.json({
      success: true,
      patient,
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patients
// @desc    Create new patient
// @access  Private
router.post('/', auth, [
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('dateOfBirth').isISO8601(),
  body('patientGroup').isMongoId(),
  body('insuranceInfo.provider').notEmpty(),
  body('insuranceInfo.policyNumber').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { patientGroup: groupId } = req.body;

    // Check permissions
    const hasPermission = await checkGroupPermission(req.user.id, groupId, 'edit');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const patient = new Patient({
      ...req.body,
      createdBy: req.user.id,
    });

    await patient.save();

    // Add patient to group
    await PatientGroup.findByIdAndUpdate(groupId, {
      $push: { patients: patient._id },
    });

    await patient.populate('createdBy', 'firstName lastName');
    await patient.populate('patientGroup');

    res.status(201).json({
      success: true,
      patient,
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/patients/:id
// @desc    Update patient
// @access  Private
router.put('/:id', auth, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('dateOfBirth').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findOne({
      _id: req.params.id,
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

    // Update patient fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'patientGroup' && key !== 'createdBy') {
        patient[key] = req.body[key];
      }
    });

    await patient.save();

    await patient.populate('createdBy', 'firstName lastName');
    await patient.populate('patientGroup');

    res.json({
      success: true,
      patient,
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patients/:id/documents
// @desc    Upload document for patient
// @access  Private
router.post('/:id/documents', auth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const patient = await Patient.findOne({
      _id: req.params.id,
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

    const document = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id,
      documentType: req.body.documentType || 'other',
      description: req.body.description || '',
    };

    patient.documents.push(document);
    await patient.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document,
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/patients/:id/documents/:documentId
// @desc    Delete patient document
// @access  Private
router.delete('/:id/documents/:documentId', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.id,
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

    // Find and remove document
    const documentIndex = patient.documents.findIndex(
      doc => doc._id.toString() === req.params.documentId
    );

    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }

    patient.documents.splice(documentIndex, 1);
    await patient.save();

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patients/:id/notes
// @desc    Add note to patient
// @access  Private
router.post('/:id/notes', auth, [
  body('content').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findOne({
      _id: req.params.id,
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

    const note = {
      content: req.body.content,
      createdBy: req.user.id,
    };

    patient.notes.push(note);
    await patient.save();

    await patient.populate('notes.createdBy', 'firstName lastName');

    res.json({
      success: true,
      note: patient.notes[patient.notes.length - 1],
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/patients/:id
// @desc    Delete patient
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.id,
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

    // Soft delete
    patient.isActive = false;
    await patient.save();

    // Remove from patient group
    await PatientGroup.findByIdAndUpdate(patient.patientGroup, {
      $pull: { patients: patient._id },
    });

    res.json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;