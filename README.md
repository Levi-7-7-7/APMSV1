# APMS Activity Points Management System (APMS)

A full-stack web application for managing student activity points, certificates, tutors, administrators, batches, branches, support tickets, notifications, profile photos, and related academic activity records.

> **This README describes the project as it exists in this ZIP.**
> It was prepared by reviewing the project structure, backend routes/models/controllers/utilities, frontend routes/pages/components/contexts/hooks/utilities, package manifests, service workers, environment templates, and migration/seed scripts.

---

## 1. Project Overview

APMS is split into two main applications:

```text
APMSV1-main/
├── activity-points-backend/     # Node.js + Express + MongoDB API
├── activity-points-frontend/    # React + Vite web application
├── package.json                 # Root package file (currently empty)
└── README.md                    # This document
```

### Main user roles

- **Student**
  - Logs in
  - Sets/resets password
  - Selects batch, branch, and lateral-entry status during OTP setup
  - Uploads, views, reuploads, and deletes certificates
  - Tracks activity points and certificate progress
  - Manages profile photo
  - Raises support tickets
  - Receives notifications
  - Changes appearance/theme
  - Uses the PWA/offline capabilities

- **Tutor**
  - Logs in
  - Has a role scope: `tutor`, `hod`, or `principal`
  - Views/manages students in the permitted scope
  - Adds students individually or through CSV
  - Views pending/approved certificates
  - Approves/rejects/reassigns/reverts certificates
  - Manages profile photo
  - Handles student support tickets
  - Raises tutor-to-admin tickets
  - Receives notifications
  - Changes appearance/theme

- **Admin**
  - Logs in through the common login entry point
  - Manages students, tutors, batches, branches, categories/subcategories/levels
  - Assigns tutors
  - Uploads tutor CSV data
  - Manages administrator accounts
  - Views/export activity logs
  - Handles support tickets
  - Manages profile photo
  - Receives notifications
  - Uses admin authentication and password-reset flows

---

# 2. Technology Stack

## Backend

- Node.js
- Express 5
- MongoDB
- Mongoose
- JWT authentication
- bcryptjs password hashing
- Multer file handling
- ImageKit for uploaded media
- Firebase Admin SDK for push notifications
- Brevo/Sendinblue SDK for email
- Helmet
- CORS
- Morgan
- Express rate limiting
- CSV parser
- Google APIs

Defined in:

```text
activity-points-backend/package.json
```

## Frontend

- React 19
- Vite
- React Router 6
- Axios
- Firebase Web SDK
- Material UI
- Emotion
- Framer Motion
- Lucide React icons
- ExcelJS / XLSX
- jsPDF / jsPDF-AutoTable
- html2canvas

Defined in:

```text
activity-points-frontend/package.json
```

---

# 3. Development Setup

## Backend

```bash
cd activity-points-backend
npm install
npm run dev
```

Production-style start:

```bash
npm start
```

Backend default port:

```text
5000
```

## Frontend

```bash
cd activity-points-frontend
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

The frontend normally runs on Vite's development server, typically:

```text
http://localhost:5173
```

---

# 4. Environment Variables

## Backend

Copy:

```text
activity-points-backend/.env.example
```

to:

```text
activity-points-backend/.env
```

Important variables:

```env
PORT=5000
MONGO_URI=...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173

BREVO_API_KEY=...
FROM_EMAIL=...
FROM_NAME=Activity Points System

IMAGEKIT_PUBLIC_KEY=...
IMAGEKIT_PRIVATE_KEY=...
IMAGEKIT_URL_ENDPOINT=...

FIREBASE_SERVICE_ACCOUNT_JSON=...
```

### Firebase requirement

The backend Firebase service account and frontend Firebase Web configuration must belong to the **same Firebase project**.

The Firebase service account JSON is used server-side and must remain secret.

---

## Frontend

Copy:

```text
activity-points-frontend/.env.example
```

to:

```text
activity-points-frontend/.env
```

Variables:

```env
VITE_API_URL=http://localhost:5000/api

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

The VAPID key is a public Web Push key and is intentionally usable by the browser.

---

# 5. Authentication

There are separate authentication tokens for the three roles:

```text
Student  -> localStorage: token
Tutor    -> localStorage: tutorToken
Admin    -> localStorage: adminToken
```

The role is stored as:

```text
localStorage: role
```

Authentication protection is implemented by:

```text
src/components/PrivateRoute.jsx
src/components/TutorPrivateRoute.jsx
src/components/AdminPrivateRoute.jsx
```

The backend has corresponding middleware:

```text
middleware/auth.js
middleware/tutorAuth.js
middleware/adminAuth.js
```

Passwords are hashed with bcryptjs.

JWT is used for authenticated API requests.

---

# 6. Frontend Routes

The main router is:

```text
activity-points-frontend/src/App.jsx
```

## Public routes

```text
/
  Common login page

/forgot-password
  Student password recovery

/reset-password
  Student password reset

/tutor/forgot-password
  Tutor password recovery

/admin/forgot-password
  Admin password recovery
```

## Student routes

Protected by `PrivateRoute` and `StudentLayout`:

```text
/student
/student/upload-certificate
/student/certificates
/student/tickets
/student/profile
/student/appearance
```

Legacy redirects are also defined for old student URLs.

## Tutor routes

Protected by `TutorPrivateRoute`:

```text
/tutor/dashboard
/tutor/dashboard/students
/tutor/dashboard/students/:studentId
/tutor/dashboard/upload
/tutor/dashboard/pending
/tutor/dashboard/approved
/tutor/dashboard/tickets
/tutor/dashboard/profile
/tutor/dashboard/appearance
```

## Admin

```text
/admin
```

Protected by `AdminPrivateRoute`.

---

# 7. Backend API Structure

The Express application is:

```text
activity-points-backend/index.js
```

Base API prefix:

```text
/api
```

Main route groups:

```text
/api/auth
/api/students
/api/tutors
/api/meta
/api/categories
/api/certificates
/api/admin/auth
/api/admin
/api/tickets
```

---

# 8. Student API

File:

```text
routes/studentRoutes.js
```

Endpoints include:

```text
GET    /api/students/dropdown-data
GET    /api/students/me
PATCH  /api/students/fcm-token
PATCH  /api/students/profile-photo
DELETE /api/students/profile-photo
GET    /api/students/my-tutor
GET    /api/students/my-staff
```

Student authentication routes are in:

```text
routes/authRoutes.js
```

They include:

```text
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/change-password
```

---

# 9. Certificate System

Certificate routes:

```text
routes/certificateRoutes.js
```

Current operations:

```text
POST   /api/certificates/upload
PUT    /api/certificates/:id/reupload
GET    /api/certificates/my
DELETE /api/certificates/:id
```

Certificates contain:

- Student
- Category
- Subcategory
- Optional level
- Prize type
- Event name
- Date range
- Uploaded file URL and ImageKit file ID
- Potential points
- Awarded points
- Status
- Rejection reason
- "Others" flag

Certificate status:

```text
pending
approved
rejected
```

Points are calculated through:

```text
backend/utils/calcPoints.js
frontend/src/utils/calcPoints.js
```

---

# 10. Certificate Approval Flow

Typical flow:

```text
Student
   |
   | uploads certificate
   v
Pending certificate
   |
   +--> Tutor approves
   |       |
   |       +--> points awarded
   |
   +--> Tutor rejects
   |       |
   |       +--> rejection reason
   |
   +--> Tutor reassigns
   |
   +--> Tutor reverts to pending
```

Tutor certificate routes:

```text
GET  /api/tutors/certificates/pending
GET  /api/tutors/certificates
POST /api/tutors/certificates/:id/approve
POST /api/tutors/certificates/:id/reject
PATCH /api/tutors/certificates/:id/reassign
POST /api/tutors/certificates/:id/revert-to-pending
```

Frontend pages:

```text
PendingCertificates.jsx
ApprovedCertificates.jsx
CertificatesPage.jsx
UploadCertificates.jsx
```

---

# 11. Student Management

Students can be managed by permitted tutors and admins.

Admin endpoints:

```text
GET    /api/admin/students
POST   /api/admin/students
PATCH  /api/admin/students/:id
DELETE /api/admin/students/:id
```

Tutor endpoints include:

```text
GET    /api/tutors/students
POST   /api/tutors/students
POST   /api/tutors/students/upload
DELETE /api/tutors/students/:id
```

Tutor student pages:

```text
StudentList.jsx
StudentDetails.jsx
TutorStudentsList.jsx
UploadCSV.jsx
```

The CSV upload functionality is supported by:

```text
UploadCSV.jsx
```

and Excel-related frontend utilities.

---

# 12. Tutor Management

Admin tutor routes include:

```text
POST   /api/admin/tutors
GET    /api/admin/tutors
DELETE /api/admin/tutors/:id
PATCH  /api/admin/tutors/:id/assign
POST   /api/admin/tutors/upload
```

Tutor roles supported by the model:

```text
tutor
hod
principal
```

Scope:

- `tutor`: assigned batch + branch
- `hod`: all batches within assigned branch
- `principal`: all batches and branches

Role rules are centralized in:

```text
utils/tutorRoleRules.js
```

---

# 13. Batch and Branch Management

Batch endpoints:

```text
POST   /api/admin/batches
GET    /api/admin/batches
DELETE /api/admin/batches/:id
DELETE /api/admin/batches/:id/students
```

Branch endpoints:

```text
POST   /api/admin/branches
GET    /api/admin/branches
DELETE /api/admin/branches/:id
```

Models:

```text
models/Batch.js
models/Branch.js
```

---

# 14. Activity Categories

Categories are hierarchical:

```text
Category
  └── Subcategory
        └── Level
              └── Prize
```

A subcategory can have:

- fixed points
- achievement levels
- optional maximum points

Categories can also have a maximum point cap.

Admin category routes support creating, editing and deleting:

- Categories
- Subcategories
- Levels

Routes:

```text
GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/:id
DELETE /api/admin/categories/:id

POST   /api/admin/categories/:id/subcategory
PUT    /api/admin/categories/:categoryId/subcategory/:subId
DELETE /api/admin/categories/:categoryId/subcategory/:subId

POST   /api/admin/categories/:categoryId/subcategory/:subId/level
PUT    /api/admin/categories/:categoryId/subcategory/:subId/level/:levelName
DELETE /api/admin/categories/:categoryId/subcategory/:subId/level/:levelName
```

Public/student lookup routes:

```text
GET /api/categories
GET /api/categories/:id
```

---

# 15. Profile Photos

Students, tutors, and admins have profile-photo support.

The models store:

```text
profilePhoto
profilePhotoFileId
```

The actual media is stored on ImageKit.

## Student

```text
PATCH  /api/students/profile-photo
DELETE /api/students/profile-photo
```

## Tutor

```text
PATCH  /api/tutors/profile-photo
DELETE /api/tutors/profile-photo
```

## Admin

```text
PATCH  /api/admin/auth/profile-photo
DELETE /api/admin/auth/profile-photo
```

The photo system supports:

- Add photo
- Replace photo
- Delete photo
- ImageKit file cleanup
- Rectangular crop
- Dragging
- Zooming
- Corner resizing
- Upload progress state
- Automatic modal closing after successful upload

Frontend crop-related components:

```text
PhotoCropModal.jsx
ImageCropModal.jsx
CertCropModal.jsx
```

The profile-specific photo modal is:

```text
PhotoCropModal.jsx
```

---

# 16. Profile Completion

The application contains profile-completion rings and hints.

Components:

```text
ProfileCompletionRing.jsx
ProfileCompletionHint.jsx
```

Student completion is based on independent 25% milestones:

```text
25%  Login
25%  First-time password setup
25%  Profile photo
25%  First certificate
```

The milestones are independent rather than sequential.

For example, deleting a photo removes **25 percentage points from the current completion**, rather than forcing a fixed percentage.

Tutor/admin completion uses the activity-based completion logic implemented in the current project.

The completion UI is displayed in dashboard/profile areas and is designed to refresh after relevant changes.

---

# 17. Push Notifications

Push functionality uses:

```text
Firebase Cloud Messaging (FCM)
```

Frontend utility:

```text
src/utils/pushNotifications.js
```

Firebase configuration:

```text
src/utils/firebase.js
public/firebase-messaging-sw.js
```

The application supports:

- Permission request
- Web FCM token registration
- Silent token synchronization when permission is already granted
- Foreground messages
- Background messages
- Notification click handling
- Service-worker based notifications

## Single-device notification model

Students and tutors intentionally store **one FCM token**.

Student model:

```text
fcmToken.token
fcmToken.platform
fcmToken.updatedAt
```

When the same student registers push on another device, the new token replaces the old one.

Therefore:

```text
Device A -> active notification device

Student logs into Device B
        |
        v
Device B token replaces Device A token
        |
        v
Device B -> active notification device
Device A -> no longer receives pushes
```

This is intentional. The project does **not** use a multi-device token array for students/tutors.

The current frontend push utility explicitly refreshes the Firebase token before syncing it, which helps avoid stale web-push tokens.

### Push endpoints

Student:

```text
PATCH /api/students/fcm-token
```

Tutor:

```text
PATCH /api/tutors/fcm-token
```

Admin:

```text
PATCH /api/admin/auth/fcm-token
```

Admin notifications can be sent to admin accounts according to the backend FCM implementation.

---

# 18. Notification Types

The backend FCM utility is:

```text
utils/fcm.js
```

Push notifications are used for application events such as:

- Certificate uploaded
- Certificate approved
- Certificate rejected
- Ticket-related events
- Other application notification events implemented by the backend

In-app ticket notification badges are handled separately from browser/device push notifications.

---

# 19. Support Ticket System

The ticket system is unified in:

```text
models/Ticket.js
routes/ticketRoutes.js
```

## Student flow

```text
Student creates ticket
        ↓
Assigned tutor receives it
        ↓
Tutor resolves
       OR
Tutor forwards to admin
```

## Tutor flow

A tutor can also create a request directly for admin.

Ticket ownership:

```text
currentOwner = tutor
currentOwner = admin
```

Ticket status:

```text
open
resolved
```

Tickets can contain an optional ImageKit issue photo.

The model stores a timeline of:

```text
created
forwarded
resolved
reopened
```

There are also seen/unseen flags for the relevant user roles.

---

# 20. Ticket API

Student:

```text
POST  /api/tickets/student
GET   /api/tickets/student/my
PATCH /api/tickets/student/:id/seen
GET   /api/tickets/student/unread-count
```

Tutor:

```text
GET   /api/tickets/tutor
POST  /api/tickets/tutor
PATCH /api/tickets/tutor/:id/resolve
PATCH /api/tickets/tutor/:id/forward
PATCH /api/tickets/tutor/:id/seen
GET   /api/tickets/tutor/unread-count
GET   /api/tickets/tutor/new-count
GET   /api/tickets/tutor/notifications
PATCH /api/tickets/tutor/:id/seen-new
```

Admin:

```text
GET   /api/tickets/admin
GET   /api/tickets/admin/unread-count
GET   /api/tickets/admin/notifications
PATCH /api/tickets/admin/:id/seen
PATCH /api/tickets/admin/:id/resolve
```

---

# 21. Activity Audit Log

The audit model is:

```text
models/ActivityLog.js
```

The log is intentionally append-only.

There are no update/delete routes for activity-log records.

The log records:

- actor type
- actor ID
- actor name/email
- action code
- description
- target type/ID/name
- structured metadata
- IP address
- creation timestamp

Admin log endpoints:

```text
GET /api/admin/logs
GET /api/admin/logs/export
```

The frontend Admin panel can view/export the audit information.

---

# 22. Image/File Storage

ImageKit utilities:

```text
utils/imagekit.js
utils/imagekitPaths.js
```

Used for:

- Profile photos
- Certificate images/files
- Ticket issue images

Uploaded files have their ImageKit file IDs retained when deletion/replacement is supported, allowing the application to clean up old media.

There are also local backend upload artifacts in:

```text
activity-points-backend/uploads/
```

These are part of the supplied project archive and should be reviewed before production deployment if they are intended to remain as tracked project data.

---

# 23. Email System

Email helpers:

```text
utils/sendOTPEmail.js
utils/sendWelcomeEmail.js
```

Brevo/Sendinblue configuration is supplied through the backend `.env`.

Used for flows such as:

- OTP
- Password recovery/reset
- Student welcome/account email

---

# 24. Password Setup and Recovery

Student:

```text
/auth/forgot-password
/auth/reset-password
/auth/change-password
```

Tutor:

```text
/tutors/forgot-password
/tutors/reset-password
```

Admin:

```text
/admin/auth/forgot-password
/admin/auth/reset-password
```

The student/tutor models also contain:

```text
firstTimePasswordSet
```

which is used by the frontend to determine whether the password setup/completion prompt should continue appearing.

---

# 25. Student Activity Points

The student point calculation logic exists in both frontend and backend:

```text
backend/utils/calcPoints.js
frontend/src/utils/calcPoints.js
```

The certificate model stores:

```text
potentialPoints
pointsAwarded
```

The backend therefore has a record of the points calculated at upload time and the points ultimately awarded during approval.

The Student dashboard also presents progress information, including regular/lateral-entry activity requirements where applicable.

---

# 26. Lateral Entry

Student records contain:

```text
isLateralEntry
```

The OTP/account setup flow allows a student to identify as a lateral-entry student.

The application uses this information for the different activity-point requirement.

The current UI logic distinguishes:

```text
Regular student -> 60 point requirement
Lateral-entry student -> 40 point requirement
```

The corresponding setup control is in:

```text
pages/VerifyOtp.jsx
```

---

# 27. Theme and Appearance

Theme infrastructure:

```text
context/ThemeContext.jsx
pages/AppearanceSettings.jsx
components/ThemeSwitcher.jsx
utils/colorTheme.js
css/theme.css
```

The application supports light/dark/system appearance behavior.

The project also contains theme-specific CSS for dashboard, profile, tutor, admin, tickets, certificate and modal interfaces.

When modifying theme colors, prefer the application's CSS variables/theme system instead of adding hard-coded black/white text. This prevents dark-mode contrast problems.

---

# 28. Navigation and Layout

Student shared layout:

```text
layouts/StudentLayout.jsx
```

Navigation:

```text
components/BottomNav.jsx
components/TutorBottomNav.jsx
```

The application supports responsive navigation.

On mobile, the bottom navigation is fixed and the content layout reserves only the required safe space so the final page content is not hidden.

On desktop, navigation uses the desktop layout rather than leaving an unnecessary bottom reservation.

---

# 29. PWA and Offline Support

Public files include:

```text
public/manifest.json
public/sw.js
public/firebase-messaging-sw.js
public/_redirects
public/icon-192.png
public/icon-512.png
public/icons/*
```

Components/utilities include:

```text
InstallAppBanner.jsx
OfflineBanner.jsx
hooks/useOnlineStatus.js
utils/installPrompt.js
```

The service-worker setup also supports the application's web push integration.

---

# 30. Frontend Component Reference

```text
AdminPrivateRoute.jsx
  Protects admin routes.

BootLoader.jsx
  Startup/loading UI.

BottomNav.jsx
  Student responsive navigation.

CertCropModal.jsx
  Certificate image cropping.

CertModal.jsx
  Certificate-related modal UI.

ImageCropModal.jsx
  General image crop functionality.

InstallAppBanner.jsx
  PWA installation prompt/banner.

NotificationPermissionBanner.jsx
  Notification permission UI.

OfflineBanner.jsx
  Offline status banner.

PasswordSetupPrompt.jsx
  Password setup reminder.

PhotoCropModal.jsx
  Profile-photo crop/upload workflow.

PrivateRoute.jsx
  Student route protection.

ProfileCompletionHint.jsx
  Completion-step explanation.

ProfileCompletionRing.jsx
  Circular completion indicator.

ThemeSwitcher.jsx
  Theme switching UI.

TutorBottomNav.jsx
  Tutor navigation.

TutorPrivateRoute.jsx
  Tutor route protection.
```

---

# 31. Frontend Contexts

```text
AuthContext.jsx
  Authentication/user/role state.

StudentTabContext.js
  Student tab/navigation state.

TutorTabContext.js
  Tutor tab/navigation state.

ThemeContext.jsx
  Global appearance/theme state.
```

---

# 32. Frontend API Helpers

```text
api/axiosInstance.js
  Student/general authenticated API client.

api/tutorAxios.js
  Tutor API client.

api/adminAxios.js
  Admin API client.

utils/api.js
  General API-related helpers.

utils/ticketApi.js
  Ticket API helpers.
```

---

# 33. Frontend Utilities

```text
calcPoints.js
  Activity-point calculations.

colorTheme.js
  Theme/color helpers.

compressCertImage.js
  Certificate image compression.

constants.js
  Shared constants.

firebase.js
  Firebase Web SDK configuration/initialization.

installPrompt.js
  PWA installation handling.

noImgCallout.js
  Missing-image/callout helper.

pageDataCache.js
  Page data caching.

pushNotifications.js
  FCM/web push registration and notification handling.

tutorExcelExport.js
  Tutor/student Excel export.

tutorPdfExport.js
  Tutor/student PDF export.
```

---

# 34. Frontend Pages

## Student

```text
Login.jsx
Dashboard.jsx
UploadCertificates.jsx
CertificatesPage.jsx
Tickets.jsx
Profile.jsx
AppearanceSettings.jsx
ForgotPassword.jsx
ResetPassword.jsx
VerifyOtp.jsx
```

## Tutor

```text
TutorLogin.jsx
TutorDashboard.jsx
TutorProfile.jsx
TutorStudentsList.jsx
StudentList.jsx
StudentDetails.jsx
UploadCSV.jsx
PendingCertificates.jsx
ApprovedCertificates.jsx
TutorTickets.jsx
TutorForgotPassword.jsx
```

## Admin

```text
AdminLogin.jsx
AdminPanel.jsx
AdminTickets.jsx
AdminForgotPassword.jsx
```

The common login route is `/`; the separate TutorLogin/AdminLogin components remain in the source project even though `App.jsx` currently routes the primary login entry through the common `Login.jsx`.

---

# 35. Backend Controllers

```text
controllers/authController.js
  Student authentication-related controller logic.

controllers/certificateController.js
  Certificate processing/controller logic.

controllers/uploadController.js
  Upload handling/controller logic.
```

Most role-specific business operations are also implemented directly in the route modules in this project.

---

# 36. Backend Models

```text
ActivityLog.js
  Immutable audit trail.

Admin.js
  Admin account, password, profile photo and push token.

Batch.js
  Academic batch.

Branch.js
  Academic branch.

Category.js
  Activity categories, subcategories, levels and prize points.

Certificate.js
  Student activity certificate.

Student.js
  Student account, academic assignment, points, push token and photo.

Ticket.js
  Support-ticket lifecycle.

Tutor.js
  Tutor/HOD/Principal account, scope, push token and photo.
```

---

# 37. Backend Utilities

```text
activityLog.js
  Central activity-log helper.

calcPoints.js
  Server-side point calculation.

defaultPassword.js
  Default/random password-related helper.

deleteBatchCascade.js
  Cascading batch deletion support.

deleteStudentCascade.js
  Cascading student deletion support.

fcm.js
  Firebase Cloud Messaging send/notification helpers.

imagekit.js
  ImageKit client/upload/delete helpers.

imagekitPaths.js
  ImageKit path organization.

sendOTPEmail.js
  OTP email.

sendWelcomeEmail.js
  Welcome email.

syncStudentCertFolder.js
  Student certificate-folder synchronization.

tutorRoleRules.js
  Tutor/HOD/Principal scope rules.
```

---

# 38. Database Scripts and Seed Files

```text
createAdmin.js
  Creates an administrator account.

seedCategories.js
  Seeds activity categories.

seedData.js
  Seeds application data.

scripts/backfillFirstTimePasswordSet.js
  Backfills the first-time password flag.

scripts/migrateFcmTokensToArray.js
  Historical FCM-token migration utility.

scripts/removeAndroidTokens.js
  Historical token cleanup utility.
```

> The current Student/Tutor models use a **single FCM token object**, not an array. The migration scripts are retained historical/maintenance utilities and should not be run blindly against a production database without checking their intended migration state.

---

# 39. Backend Middleware

```text
middleware/auth.js
  Student/general authentication.

middleware/tutorAuth.js
  Tutor authentication.

middleware/adminAuth.js
  Admin authentication.
```

---

# 40. CSS Organization

Important CSS groups include:

```text
AdminPanel.css
AdminTickets.css
AppearanceSettings.css
ApprovedCertificates.css
BootLoader.css
CertCropModal.css
CertModal.css
ImageCropModal.css
Login.css
NotificationPermissionBanner.css
OfflineBanner.css
OtpVerificationPage.css
PasswordSetupPrompt.css
PendingCertificates.css
PhotoCropModal.css
Profile.css
ProfileCompletionHint.css
ProfileCompletionRing.css
StudentDashboard.css
StudentDetails.css
StudentList.css
Tickets.css
TutorDashboard.css
TutorProfile.css
TutorTickets.css
UploadCSV.css
certificatespage.css
modern.css
theme.css
upload.css
```

`theme.css` is especially important for global theme variables and dark/light behavior.

---

# 41. Security and Reliability Features

The backend currently includes:

- JWT authentication
- bcrypt password hashing
- Role-specific authentication middleware
- Helmet security headers
- CORS
- Express rate limiting
- Multer file validation/size handling
- Global JSON error handling
- Immutable activity logging
- ImageKit file IDs for media cleanup
- Password reset expiration fields
- Firebase service-account separation from frontend configuration

The backend also converts common Multer/file-filter errors into JSON responses instead of allowing Express to return an HTML error page.

---

# 42. Important Data Relationships

High-level relationship:

```text
Batch ─────────────┐
                   │
Branch ────────────┼──> Student
                   │       │
                   │       ├── Certificates
                   │       ├── Tickets
                   │       └── Profile Photo
                   │
                   └──> Tutor
                           │
                           ├── Students
                           ├── Certificates
                           └── Tickets

Category
  └── Subcategory
        └── Level
              └── Prize points
```

Tickets snapshot batch/branch information when created so historical ticket routing information remains meaningful even if a student is later reassigned.

---

# 43. Current Profile-Photo Flow

```text
Choose image
     ↓
PhotoCropModal
     ↓
Rectangular crop
     ↓
Drag / zoom / resize corners
     ↓
Use this crop
     ↓
Uploading... + spinner
     ↓
ImageKit upload
     ↓
Old ImageKit file cleanup when replacing
     ↓
Database profilePhoto/profilePhotoFileId update
     ↓
Modal closes automatically
     ↓
Profile/dashboard refreshes
```

Delete flow:

```text
Delete photo
     ↓
Confirmation
     ↓
ImageKit file deletion
     ↓
Database fields cleared
     ↓
Profile refreshed
```

---

# 44. Current Push Notification Flow

```text
Authenticated user
      ↓
Notification permission granted
      ↓
Firebase service worker registered
      ↓
Current FCM token obtained/refreshed
      ↓
PATCH token to backend
      ↓
Backend stores ONE token
      ↓
Application event occurs
      ↓
FCM sends push to stored token
```

For students/tutors:

```text
New device registers
      ↓
Previous token is replaced
      ↓
Only newest registered device receives push
```

Foreground notifications use the service worker registration's `showNotification()` mechanism.

Background notification handling is in:

```text
public/firebase-messaging-sw.js
```

---

# 45. Root-Level and Static Files

```text
.gitignore
  Git ignore rules.

package.json
  Root package manifest; currently contains an empty object.

activity-points-backend/.env.example
  Backend environment template.

activity-points-frontend/.env.example
  Frontend environment template.

activity-points-frontend/index.html
  Vite HTML entry point.

activity-points-frontend/public/manifest.json
  PWA manifest.

activity-points-frontend/public/_redirects
  Deployment redirect configuration.

activity-points-frontend/public/sw.js
  General application service worker.

activity-points-frontend/public/firebase-messaging-sw.js
  Firebase messaging/background push service worker.

activity-points-frontend/public/icons/*
  PWA icons.

activity-points-frontend/public/icon-192.png
activity-points-frontend/public/icon-512.png
  PWA/application icons.
```

---

# 46. Build and Deployment Notes

Before deployment:

1. Configure MongoDB.
2. Configure backend `.env`.
3. Configure frontend `.env`.
4. Configure Firebase Web Messaging.
5. Configure Firebase Admin service credentials.
6. Configure ImageKit.
7. Configure Brevo email.
8. Run backend.
9. Build frontend.
10. Serve the Vite build from the chosen hosting provider.
11. Ensure the deployed frontend URL matches `FRONTEND_URL`.
12. Ensure Firebase web push/service-worker files are served from the correct origin.

For web push, the application needs a secure deployed origin (HTTPS), except for localhost development.

---

# 47. Maintenance Rules

When modifying the project:

### Preserve role boundaries

Do not bypass:

```text
PrivateRoute
TutorPrivateRoute
AdminPrivateRoute
```

or their backend middleware equivalents.

### Preserve the single-device push model

Do not convert:

```text
fcmToken
```

into multiple active device tokens unless the desired product behavior changes.

### Preserve ImageKit cleanup

When replacing/deleting profile photos, keep the `profilePhotoFileId` cleanup logic so unused media does not accumulate.

### Preserve audit logging

Activity logs are intentionally append-only.

Do not add UI routes that modify or delete existing activity-log records.

### Prefer theme variables

For UI text/colors, use the global theme variables rather than hard-coded dark colors. This is especially important for dark mode.

### Preserve responsive navigation

Do not add an unnecessary desktop bottom-space reservation. Mobile content must retain only enough bottom padding to avoid being hidden behind the fixed navigation.

---

# 48. Troubleshooting

## Student receives no push notification

Check:

1. Browser notification permission is `granted`.
2. Firebase frontend variables are correct.
3. Firebase backend service-account JSON is correct.
4. Frontend and backend use the same Firebase project.
5. Service worker is registered.
6. Student has a current `fcmToken` in MongoDB.
7. The stored token belongs to the currently active device.
8. Browser/PWA notification permissions are not blocked.

Remember: only the **latest registered student device** receives push notifications.

## Dark-mode text is unreadable

Check:

```text
src/css/theme.css
```

and the relevant page CSS for hard-coded colors such as black/dark slate text. Prefer the theme variables.

## Profile photo upload does not finish

Check:

- ImageKit environment variables
- Browser network request
- ImageKit upload response
- `profilePhotoFileId`
- Crop modal upload state

## Password prompt keeps returning

Check:

```text
firstTimePasswordSet
```

and confirm the password-reset/change endpoint updates it to `true`.

---

# 49. Current File Inventory

The ZIP contains the following main source groups.

## Backend

```text
config/
controllers/
middleware/
models/
routes/
scripts/
utils/
uploads/
```

## Frontend

```text
src/api/
src/assets/
src/components/
src/context/
src/css/
src/hooks/
src/layouts/
src/pages/
src/utils/
public/
```

The supplied archive contains approximately 200 filesystem entries, including source files, package manifests, configuration files, public assets, service workers, and backend upload artifacts.

---

# 50. Important Final Notes

- The root `package.json` is currently `{}`; backend and frontend have their own independent package manifests and npm commands.
- Do not commit real `.env` files or Firebase private service-account credentials.
- The current project intentionally uses **one active push device per Student/Tutor account**.
- The current project includes profile-photo management for Student, Tutor, and Admin.
- The profile-photo cropper is rectangular.
- Certificate cropping is separate from profile-photo cropping.
- The audit log is append-only.
- Tickets use a role-based ownership workflow.
- Student/Tutor/Admin authentication is separated by role and token storage.
- Theme handling is shared across the application.
- The current project contains historical FCM migration scripts; inspect migration state before running them on an existing production database.
- The project should be treated as a single full-stack system: frontend and backend configuration must agree on API, Firebase, email, and media-storage settings.
