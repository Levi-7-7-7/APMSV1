# APMS — Activity Points Management System
## Local Setup & User Manual

This guide walks you through setting up the **APMS** project on your own computer from scratch — cloning the repo, creating the required third‑party accounts (database, OTP email, file storage), configuring environment variables, seeding data, and running both the backend and frontend.

APMS is a full‑stack web app for managing SBTE Kerala student activity points: students upload certificates, tutors review/approve them, and admins manage the whole institution — with automatic point calculation.

**Stack:** React 19 + Vite (frontend) · Node.js + Express 5 + MongoDB (backend) · Brevo for OTP emails · ImageKit for certificate file storage.

---

## 1. Prerequisites

Install these before you start:

| Tool | Why you need it | Link |
|---|---|---|
| Node.js ≥ 18 (+ npm) | Runs both frontend and backend | https://nodejs.org |
| Git | To clone/manage the repo | https://git-scm.com |
| A code editor (VS Code recommended) | Editing `.env` files, code | https://code.visualstudio.com |
| MongoDB | The database | Either install locally, **or** use a free MongoDB Atlas cluster (recommended) — https://www.mongodb.com/cloud/atlas |

You'll also need to create two free third-party accounts before the app will actually work end-to-end:

- **Brevo** (formerly Sendinblue) — sends the OTP login emails and password-reset emails
- **ImageKit** — stores uploaded certificate images/PDFs in the cloud

Both instructions are below.

---

## 2. Project Structure

```
APMSV1-main/
├── activity-points-backend/    # Node.js + Express REST API
└── activity-points-frontend/   # React + Vite web app (PWA)
```

You will run **two servers** during development: the backend API (port 5000) and the frontend dev server (port 5173). They run in two separate terminal windows.

---

## 3. Setting up MongoDB

Pick one:

**Option A — MongoDB Atlas (recommended, no local install needed)**
1. Go to https://www.mongodb.com/cloud/atlas and create a free account.
2. Create a free "M0" cluster.
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add your IP (or `0.0.0.0/0` to allow access from anywhere while developing).
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/apms?retryWrites=true&w=majority`
6. Replace `<username>` and `<password>` with your database user's credentials — this full string is your `MONGO_URI`.

**Option B — Local MongoDB**
1. Install MongoDB Community Server for your OS.
2. Start the `mongod` service.
3. Your `MONGO_URI` will simply be: `mongodb://localhost:27017/apms`

---

## 4. Setting up Brevo (for OTP / password-reset emails)

Students normally log in with **register number + password**. Brevo is used for the two OTP-based flows: **first-time account setup** (one-time, per student) and **password reset** — both go through Brevo's transactional email API.

1. Go to https://www.brevo.com and create a free account (the free tier includes 300 emails/day, plenty for local dev/testing).
2. Verify your email address to activate the account.
3. In the Brevo dashboard, go to **SMTP & API → API Keys** and generate a new API key. Copy it — this is your `BREVO_API_KEY`.
4. Go to **Senders & IP → Senders** and add/verify a sender email address (e.g. your Gmail, or a college email). Brevo will send a verification email to that address — confirm it. This becomes your `FROM_EMAIL`. Until a sender is verified, OTP emails will fail to send.
5. Pick any display name for `FROM_NAME` (e.g. `Activity Points System`) — this is just the "from" name shown in the recipient's inbox, no extra setup needed.

You do **not** need to configure Gmail SMTP or an app password — the app sends emails through Brevo's API (via `sib-api-v3-sdk`), not through a raw email account.

---

## 5. Setting up ImageKit (for certificate file storage)

Uploaded certificates (images/PDFs) are stored on ImageKit rather than on your server disk.

1. Go to https://imagekit.io and create a free account.
2. After signing up, go to **Developer Options** in the dashboard.
3. Copy the **Public Key**, **Private Key**, and **URL-endpoint** shown there — these map directly to:
   - `IMAGEKIT_PUBLIC_KEY`
   - `IMAGEKIT_PRIVATE_KEY`
   - `IMAGEKIT_URL_ENDPOINT` (looks like `https://ik.imagekit.io/your_imagekit_id`)

No further configuration is required — the free tier is enough for development.

---

## 6. Backend Setup

```bash
cd activity-points-backend
npm install
```

Create your environment file from the example:

```bash
cp .env.example .env
```

Open `.env` and fill in the values you gathered above:

```env
# Server
PORT=5000

# MongoDB
MONGO_URI=your_mongodb_connection_string

# JWT — use a long random string (auth tokens are signed with this)
JWT_SECRET=your_strong_jwt_secret_here
JWT_EXPIRES_IN=7d

# Frontend URL — used to build links in password-reset emails
FRONTEND_URL=http://localhost:5173

# Brevo — OTP & password-reset emails
BREVO_API_KEY=your_brevo_api_key
FROM_EMAIL=your_verified_sender_email
FROM_NAME=Activity Points System

# ImageKit — certificate file storage
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

> A quick way to generate a strong `JWT_SECRET` is running `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### Seed activity categories

The points engine needs the SBTE activity categories/subcategories in the database before anything else works:

```bash
node seedCategories.js
```

### Create the first admin account

The app has no public admin sign-up — you create the first admin via a script.

1. Open `createAdmin.js` in the backend folder.
2. Edit the two constants near the top with **your own** email and a password (8+ characters):
   ```js
   const ADMIN_EMAIL    = 'your-admin-email@example.com';
   const ADMIN_PASSWORD = 'your-secure-password';
   ```
3. Run it:
   ```bash
   node createAdmin.js
   ```
4. **Security note:** don't leave real credentials sitting in this file — reset the constants to placeholder values (or delete/comment out the script) once you're done, especially before committing to git or sharing the repo.

### Start the backend server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

The API will be running at `http://localhost:5000`. Visiting it in a browser should show:
```json
{ "message": "Activity Points API is running" }
```

---

## 7. Frontend Setup

Open a **second terminal**:

```bash
cd activity-points-frontend
npm install
```

The frontend talks to the backend via `VITE_API_URL`. By default (if unset) it falls back to `http://localhost:5000/api`, so for local development you usually don't need to create a frontend `.env` file at all. If you want to be explicit, or if your backend runs on a different host/port, create `activity-points-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the dev server:

```bash
npm run dev
```

The app will be running at `http://localhost:5173`.

For a production build:

```bash
npm run build
```

This outputs static files to `dist/`, which can be served by any static host (or copied into the backend's `frontend-build` folder for a single combined deployment).

---

## 8. First Run Checklist

1. ✅ MongoDB reachable (Atlas cluster or local `mongod` running)
2. ✅ Backend `.env` filled in completely
3. ✅ `node seedCategories.js` run once
4. ✅ `node createAdmin.js` run once, credentials noted somewhere safe
5. ✅ Backend running: `npm run dev` in `activity-points-backend`
6. ✅ Frontend running: `npm run dev` in `activity-points-frontend`
7. ✅ Open `http://localhost:5173` in your browser
8. ✅ Log in as admin at `/admin/login` using the credentials from step 4
9. ✅ As admin, create tutors and set up batches/branches so students can be assigned
10. ✅ Test the student flow: check "First-time user", enter a registered student's register number → OTP should arrive at their registered email via Brevo within a few seconds (check spam folder if not)
11. ✅ Complete first-time setup once, then try it again with the same register number — you should now get the "already completed" message instead of a new OTP

---

## 9. Roles & How Login Works

| Role | Login Method | What they can do |
|---|---|---|
| **Student** | Register number + password | View dashboard, upload certificates, track points |
| **Tutor** | Email + password | Review assigned students, approve/reject certificates, bulk-upload students via CSV |
| **Admin** | Email + password | Manage tutors, batches, branches, categories — full system oversight |

All protected routes use a JWT to authenticate requests.

### Student first-time setup vs. normal login

A student's account is created by an admin/tutor without a password. The **first time** a student accesses the system, they check "First-time user" on the login screen and go through a short setup instead of a normal login:

1. Enter **register number** → an OTP is emailed to the student's registered email (`POST /api/auth/start-login`).
2. Enter the **OTP**, choose a **password**, and pick batch/branch/lateral-entry status → this verifies the account and sets `firstLoginCompleted = true` on the student's record (`POST /api/auth/verify-otp`).

After that, the student logs in normally with **register number + password** (`POST /api/auth/login`) every time — no OTP involved.

**Guard against repeating first-time setup:** once `firstLoginCompleted` is `true` in the database, both `/start-login` and `/verify-otp` refuse to run again — they return a 400 with the message *"First-time login has already been completed for this account. Please sign in with your register number and password. If you need further changes, contact your tutor."* This stops the OTP flow from being used later as a backdoor to silently reset a student's password or change their batch/branch (that's what `/forgot-password` + `/reset-password` are for instead, which go through a separate OTP explicitly for password resets).

---

## 10. Common Issues

| Problem | Likely Cause |
|---|---|
| OTP email never arrives | Sender email not verified in Brevo, or `BREVO_API_KEY` / `FROM_EMAIL` wrong in `.env` |
| "MongoDB connection failed" on startup | `MONGO_URI` incorrect, IP not whitelisted in Atlas Network Access, or local `mongod` not running |
| Certificate upload fails | ImageKit keys missing/incorrect in `.env` |
| Frontend can't reach backend (network errors in console) | Backend not running, or `VITE_API_URL` pointing to the wrong port |
| "No categories found" on upload form | Forgot to run `node seedCategories.js` |
| Can't log in as admin | `createAdmin.js` was never run, or was run with different credentials than you're trying |

---

## 11. Deployment Notes

- Set all the same environment variables on your hosting platform (Render/Railway/VPS for backend; Vercel/Netlify or the backend's static hosting for frontend).
- Update `FRONTEND_URL` in the backend `.env` to your deployed frontend URL (used in password-reset email links).
- Update `VITE_API_URL` in the frontend build to point to your deployed backend URL.
- Use a MongoDB Atlas cluster (not local) for production.
- Never commit a real `.env` file — only `.env.example` should be in version control.
