# APMS — Activity Points Management System

A full-stack web application for managing SBTE Kerala student activity points. Students submit certificates, tutors review and approve them, and admins oversee the entire institution — all with automatic point calculation based on official SBTE rules.

---

## 🏗️ Project Structure

```
APMSV1-main/
├── activity-points-backend/    # Node.js + Express REST API
└── activity-points-frontend/   # React + Vite web app (PWA)
```

---

## ✨ Features

### 👤 Student Portal
- OTP-based login and email verification
- Forgot password / reset password flow
- Dashboard with live activity points summary
- Upload certificates with category & subcategory selection
- View all submitted and approved certificates

### 🧑‍🏫 Tutor Portal
- View and manage assigned students
- Review pending certificate submissions
- Approve or reject certificates with remarks
- View approved certificates per student
- Bulk student upload via CSV

### 🛠️ Admin Panel
- Manage tutors (create, assign batch/branch, delete)
- Manage batches, branches, and activity categories
- Full visibility across the institution

### 📐 Points Engine
- Implements **SBTE Kerala Annexure 1** rules precisely
- Handles regular vs. lateral entry thresholds (60 pts / 40 pts)
- Per-segment caps with category-specific overrides (NCC/NSS → 50, Sports/Arts → 30)
- Pass/fail determination per student

---

## 🛠️ Tech Stack

### Backend
| Package | Purpose |
|---|---|
| Express 5 | REST API framework |
| MongoDB + Mongoose | Database & ODM |
| JSON Web Token | Auth tokens (httpOnly cookies) |
| bcryptjs | Password hashing |
| Multer | Certificate file uploads |
| ImageKit | Cloud storage for certificate images |
| Brevo (Sendinblue) | OTP & password reset emails |
| Helmet + express-rate-limit | Security hardening |
| csv-parser | Bulk student CSV import |

### Frontend
| Package | Purpose |
|---|---|
| React 19 + Vite 7 | UI framework & build tool |
| React Router v6 | Client-side routing |
| Axios | API communication |
| jsPDF + jspdf-autotable | PDF report generation |
| xlsx | Excel export |
| lucide-react | Icons |
| vite-plugin-pwa | Progressive Web App support |

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- ImageKit account
- Brevo account (for email OTPs)

---

### Backend Setup

```bash
cd activity-points-backend
npm install
```

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_jwt_secret_here
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173

# Brevo (email OTPs)
BREVO_API_KEY=your_brevo_api_key
FROM_EMAIL=noreply@yourcollege.edu
FROM_NAME=Activity Points System

# ImageKit (certificate storage)
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

Seed the database with activity categories:

```bash
node seedCategories.js
```

Create the first admin account:

```bash
node createAdmin.js
```

Start the server:

```bash
# Development
npm run dev

# Production
npm start
```

API runs at `http://localhost:5000`

---

### Frontend Setup

```bash
cd activity-points-frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`

For production build:

```bash
npm run build
```

---

## 📡 API Overview

| Prefix | Description |
|---|---|
| `POST /api/auth/*` | Student login, OTP verify, password reset |
| `GET /api/students/*` | Student profile & dropdown data |
| `GET/POST /api/certificates/*` | Certificate upload & retrieval |
| `GET /api/categories` | Activity categories (public) |
| `GET /api/meta` | Batch & branch lookups |
| `POST /api/tutors/*` | Tutor login & student management |
| `POST /api/tutor/students` | Bulk student CSV upload |
| `POST /api/admin/auth/*` | Admin login |
| `GET/POST /api/admin/*` | Admin management (tutors, batches, branches, categories) |

---

## 📁 Backend Structure

```
activity-points-backend/
├── config/         # MongoDB connection
├── controllers/    # Route handler logic
├── middleware/     # JWT auth guards (student, tutor, admin)
├── models/         # Mongoose schemas
│   ├── Student.js
│   ├── Tutor.js
│   ├── Admin.js
│   ├── Certificate.js
│   ├── Category.js
│   ├── Batch.js
│   └── Branch.js
├── routes/         # Express routers
├── utils/
│   ├── calcPoints.js   # SBTE points engine
│   ├── imagekit.js     # ImageKit client
│   └── sendOTPEmail.js # Brevo email sender
├── createAdmin.js  # One-time admin seed script
├── seedCategories.js
└── index.js        # App entry point
```

---

## 📁 Frontend Structure

```
activity-points-frontend/src/
├── api/            # Axios instances (student, tutor, admin)
├── components/     # PrivateRoute guards, nav, modals
├── context/        # AuthContext
├── layouts/        # StudentLayout (shared shell)
├── pages/
│   ├── Login / VerifyOtp / ForgotPassword / ResetPassword
│   ├── Dashboard / UploadCertificates / CertificatesPage
│   ├── TutorDashboard / StudentList / StudentDetails
│   ├── PendingCertificates / ApprovedCertificates / UploadCSV
│   └── AdminPanel
└── utils/
    ├── calcPoints.js   # Mirrored points engine (client-side preview)
    └── constants.js
```

---

## 🔐 Roles & Access

| Role | Login | Access |
|---|---|---|
| Student | Email + OTP | Own dashboard, upload & view certificates |
| Tutor | Email + password | Assigned students, certificate approval |
| Admin | Email + password | Full system management |

All protected routes use JWT stored in httpOnly cookies.

---

## 📱 PWA Support

The frontend is a Progressive Web App. On mobile browsers, users can **Add to Home Screen** for an app-like experience with offline shell caching via Workbox.

---

## 📄 License

This project is for internal institutional use only.
