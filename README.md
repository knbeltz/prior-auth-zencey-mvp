# Prior Authorization Dispute System MVP

A comprehensive MERN stack application for healthcare providers to manage and dispute prior authorization denials using AI-powered analysis and document generation.

## Features

### 🔐 Authentication & User Management
- JWT-based authentication
- User registration and login
- Password reset functionality
- User preferences and theme management

### 👥 Patient Group Management
- Create and manage patient groups (folder-like structure)
- Invite team members with different permission levels (view/edit/admin)
- Collaborative patient management

### 🏥 Patient Management
- Add patients with comprehensive information
- Insurance details and contact information
- Document upload for EHR and supporting files
- Patient notes and medical history

### 🤖 AI-Powered Dispute Analysis
- Upload denial letters for analysis
- Anthropic AI identifies dispute opportunities
- Success probability estimation
- Strategic recommendations

### 📄 Document Generation
- AI-generated dispute documents:
  - Professional emails to insurance companies
  - Formal appeal letters
  - Phone call scripts and talking points
  - Peer-to-peer review notes

### 📊 Dashboard & Analytics
- Overview of patient groups and disputes
- Status tracking and timeline management
- Statistics and success metrics

## Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Multer** for file uploads
- **Anthropic AI** for analysis and document generation

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Mantine UI** for components
- **React Router** for navigation
- **Axios** for API communication

## Project Structure

```
├── Backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   ├── models/
│   │   ├── User.js
│   │   ├── PatientGroup.js
│   │   ├── Patient.js
│   │   └── PriorAuthorization.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── patientGroups.js
│   │   ├── patients.js
│   │   └── disputes.js
│   ├── middleware/
│   │   └── auth.js
│   └── server.js
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account or local MongoDB
- Anthropic API keys

### Backend Setup

1. Navigate to the Backend folder:
```bash
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
ANALYZER_API=your_anthropic_analyzer_api_key
DISPUTER_API=your_anthropic_disputer_api_key
```

4. Create uploads directories:
```bash
mkdir uploads
mkdir uploads/denials
```

5. Start the development server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to the Frontend folder:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## Key Features Walkthrough

### 1. User Registration and Login
- Users can create accounts and log in securely
- JWT tokens for session management
- Password reset functionality

### 2. Patient Group Management
- Create groups to organize patients
- Invite colleagues with specific permissions
- Collaborative workspace for healthcare teams

### 3. Patient Addition
- Multi-step form for comprehensive patient data
- Insurance information collection
- Document upload for medical records

### 4. AI-Powered Dispute Process
1. **Upload Denial**: Upload the prior authorization denial letter
2. **AI Analysis**: Anthropic AI analyzes the denial and identifies:
   - Dispute opportunities categorized by strength
   - Success probability percentage
   - Recommended approach (peer review, formal appeal, etc.)
   - Key arguments and supporting evidence needed
3. **Document Generation**: Generate professional documents:
   - Emails to insurance companies
   - Formal appeal letters
   - Phone scripts for peer-to-peer reviews
   - Comprehensive review notes

### 5. Collaboration Features
- Team members can view and edit based on permissions
- Notification system for invitations and updates
- Shared access to patient groups and disputes

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset
- `GET /api/auth/me` - Get current user

### Patient Groups
- `GET /api/patient-groups` - Get user's patient groups
- `POST /api/patient-groups` - Create new patient group
- `GET /api/patient-groups/:id` - Get specific patient group
- `PUT /api/patient-groups/:id` - Update patient group
- `DELETE /api/patient-groups/:id` - Delete patient group
- `POST /api/patient-groups/:id/invite` - Invite user to group

### Patients
- `GET /api/patients/group/:groupId` - Get patients in group
- `POST /api/patients` - Create new patient
- `GET /api/patients/:id` - Get specific patient
- `PUT /api/patients/:id` - Update patient
- `POST /api/patients/:id/documents` - Upload patient documents

### Disputes
- `GET /api/disputes/patient/:patientId` - Get patient's disputes
- `POST /api/disputes` - Create new dispute
- `GET /api/disputes/:id` - Get specific dispute
- `POST /api/disputes/:id/analyze` - Run AI analysis
- `POST /api/disputes/:id/generate` - Generate dispute documents

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- File upload restrictions
- Permission-based access control

## Future Enhancements

- Real-time notifications
- Advanced analytics and reporting
- Integration with EHR systems
- Mobile app development
- Advanced AI features for outcome prediction
- Automated follow-up scheduling

## Contributing

This is an MVP (Minimum Viable Product) designed to demonstrate the core functionality of a prior authorization dispute system. The codebase provides a solid foundation for further development and customization.

## License

This project is licensed under the MIT License."# prior-auth-mvp" 
"# prior-auth-mvp" 
"# prior-auth-zencey-mvp" 
"# prior-auth-zencey-mvp" 
"# prior-auth-zencey-mvp" 
