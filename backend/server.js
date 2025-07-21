const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create upload directories if they don't exist
const uploadDirs = ['uploads', 'uploads/denials'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Database connection
const connectDB = require('./config/db');
connectDB();

// Initialize deadline monitoring service after DB connection
let deadlineMonitoringService;
try {
  deadlineMonitoringService = require('./services/deadlineMonitoringService');
} catch (error) {
  console.log('Deadline monitoring service not found, will run without it');
}

// Start deadline monitoring service when MongoDB connects
mongoose.connection.once('open', () => {
  console.log('MongoDB Connected');
  if (deadlineMonitoringService) {
    console.log('Starting deadline monitoring service...');
    deadlineMonitoringService.start();
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  if (deadlineMonitoringService) {
    deadlineMonitoringService.stop();
  }
  mongoose.connection.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patient-groups', require('./routes/patientGroups'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/disputes', require('./routes/disputes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});