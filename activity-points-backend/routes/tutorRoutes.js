const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const multer    = require('multer');
const fs        = require('fs');
const csv       = require('csv-parser');
const tutorAuth = require('../middleware/tutorAuth');

const Tutor       = require('../models/Tutor');
const Student     = require('../models/Student');
const Certificate = require('../models/Certificate');
const Category    = require('../models/Category');

const generateDefaultPassword = require('../utils/defaultPassword');
const deleteStudentCascade = require('../utils/deleteStudentCascade');
const { validateTutorRoleConfig } = require('../utils/tutorRoleRules');

const { sendPushNotification } = require('../utils/fcm');


const { calcCappedPoints, syncStudentTotalPoints } = require('../utils/calcPoints');
const logActivity = require('../utils/activityLog');

const path    = require('path');
const ImageKit = require('imagekit');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// ── Memory-storage upload for profile photos (kept separate) ──────────────────
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── ImageKit instance ─────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});
const SibApiV3Sdk = require('sib-api-v3-sdk');

// ─── BREVO EMAIL CLIENT ───────────────────────────────────────────────────────
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendTutorResetOTPEmail(toEmail, tutorName, otp) {
  await emailApi.sendTransacEmail({
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'Activity Points System',
    },
    to: [{ email: toEmail }],
    subject: 'Password Reset OTP - Activity Points System',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e3a8a; margin-bottom: 8px;">Password Reset</h2>
        <p style="color: #374151;">Hi <strong>${tutorName}</strong>,</p>
        <p style="color: #374151;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background: #eff6ff; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
      </div>
    `,
  });
}



// ─── Fetch the requesting tutor-side account and make sure it's actually ──────
// configured correctly for its role (see utils/tutorRoleRules.js). An account
// stuck between "created" and "assigned" by an admin — or any account that
// somehow ends up in an invalid state — is refused everywhere, not just on
// writes, so it can never accidentally behave like a principal (blank
// batch/branch = sees/acts on everything) before it's actually meant to.
// Sends the response itself and returns null on failure.
async function fetchConfiguredTutor(req, res) {
  const tutor = await Tutor.findById(req.tutor.id);
  if (!tutor) { res.status(404).json({ error: 'Tutor not found' }); return null; }

  const configError = validateTutorRoleConfig(tutor.role, tutor.batch, tutor.branch);
  if (configError) {
    res.status(403).json({ error: `Your account isn't fully set up yet (${configError}) — contact an admin.` });
    return null;
  }
  return tutor;
}

// ─── Gate for actions that MODIFY data (approve/reject/reassign/revert, ───────
// add/delete student, bulk-upload students). Only role 'tutor' — the account
// actually assigned to one specific batch+branch — may do these. HOD and
// Principal accounts are view-only, regardless of what their batch/branch
// scope would otherwise allow. Sends the response itself and returns false
// on failure.
function requireFullTutor(tutor, res) {
  if (tutor.role !== 'tutor') {
    res.status(403).json({ error: 'HOD and Principal accounts have view-only access and cannot modify records.' });
    return false;
  }
  return true;
}

// ─── SCOPE CHECK: tutor may only act on certificates belonging to students ────
// in their own assigned batch/branch — mirrors the same check already used by
// DELETE /students/:id. Returns { tutor, cert, student } on success, or sends
// the appropriate error response itself and returns null.
async function authorizeCertificateAccess(req, res) {
  const tutor = await fetchConfiguredTutor(req, res);
  if (!tutor) return null; // response already sent
  if (!requireFullTutor(tutor, res)) return null;

  const cert = await Certificate.findById(req.params.id);
  if (!cert) { res.status(404).json({ error: 'Certificate not found' }); return null; }

  const student = await Student.findById(cert.student);
  if (!student) { res.status(404).json({ error: 'Student not found' }); return null; }

  if (tutor.batch && student.batch && student.batch.toString() !== tutor.batch.toString()) {
    res.status(403).json({ error: 'Student not in your assigned batch' });
    return null;
  }
  if (tutor.branch && student.branch && student.branch.toString() !== tutor.branch.toString()) {
    res.status(403).json({ error: 'Student not in your assigned branch' });
    return null;
  }

  return { tutor, cert, student };
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const tutor = await Tutor.findOne({ email })
      .populate('batch',  'name')
      .populate('branch', 'name');
    if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

    const isMatch = await bcrypt.compare(password, tutor.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign(
      { id: tutor._id, role: 'tutor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'tutor_login',
      description: `${tutor.name} (${tutor.role || 'tutor'}) logged in`,
      targetType: 'Tutor',
      targetId: tutor._id,
      targetName: tutor.name,
    });

    res.json({
      message: 'Login successful',
      token,
      tutor: {
        id:     tutor._id,
        name:   tutor.name,
        email:  tutor.email,
        role:   tutor.role || 'tutor',
        batch:  tutor.batch  ? { _id: tutor.batch._id,  name: tutor.batch.name  } : null,
        branch: tutor.branch ? { _id: tutor.branch._id, name: tutor.branch.name } : null,
        firstTimePasswordSet: tutor.firstTimePasswordSet,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REGISTER / UPDATE TUTOR FCM TOKEN ───────────────────────────────────────
// Called by the native app after the tutor logs in so we can push
// "new certificate uploaded" alerts to their device.
router.patch('/fcm-token', tutorAuth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken is required' });
    await Tutor.findByIdAndUpdate(req.tutor.id, { fcmToken });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET STUDENTS (filtered to tutor's batch + branch) ───────────────────────
router.get('/students', tutorAuth, async (req, res) => {
  try {
    // Fetch the tutor so we know their assigned batch/branch. HOD/Principal
    // may view here (read-only) — fetchConfiguredTutor only blocks accounts
    // that aren't properly configured yet for their role.
    const tutor = await fetchConfiguredTutor(req, res);
    if (!tutor) return;

    // Build query — only filter if the tutor has an assignment
    const query = {};
    if (tutor.batch)  query.batch  = tutor.batch;
    if (tutor.branch) query.branch = tutor.branch;

    const students = await Student.find(query)
      .populate('batch',  'name')
      .populate('branch', 'name')
      .sort({ name: 1 }); // alphabetical order

    const categories = await Category.find();

    const studentsWithPoints = await Promise.all(students.map(async (student) => {
      const approvedCerts = await Certificate.find({ student: student._id, status: 'approved' })
        .populate('category', 'name maxPoints');
      const totalPoints = calcCappedPoints(approvedCerts, categories, student.isLateralEntry);
      return { ...student.toObject(), totalPoints };
    }));

    res.json({ success: true, students: studentsWithPoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE STUDENT ───────────────────────────────────────────────────────────
router.delete('/students/:id', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchConfiguredTutor(req, res);
    if (!tutor) return;
    if (!requireFullTutor(tutor, res)) return;

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Safety: tutor can only delete students in their own batch/branch
    if (tutor.batch  && student.batch  && student.batch.toString()  !== tutor.batch.toString())
      return res.status(403).json({ error: 'Student not in your assigned batch' });
    if (tutor.branch && student.branch && student.branch.toString() !== tutor.branch.toString())
      return res.status(403).json({ error: 'Student not in your assigned branch' });

    // Cascade delete: removes the student's certificate files and profile
    // photo from ImageKit too, not just the database records.
    await deleteStudentCascade(req.params.id);

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'student_deleted',
      description: `${tutor.name} deleted student ${student.name} (${student.registerNumber})`,
      targetType: 'Student',
      targetId: student._id,
      targetName: student.name,
    });

    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADD SINGLE STUDENT ────────────────────────────────────────────────────
// Creates one student under the tutor's own batch/branch, with a default
// password of firstName + "12345". Returns that password once so the
// tutor can pass it on to the student.
router.post('/students', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchConfiguredTutor(req, res);
    if (!tutor) return;
    if (!requireFullTutor(tutor, res)) return;

    const { name, registerNumber, email, isLateralEntry } = req.body;
    if (!name || !registerNumber || !email) {
      return res.status(400).json({ error: 'name, registerNumber and email are required' });
    }

    const defaultPassword = generateDefaultPassword(name);
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10);

    const student = await Student.create({
      name:           name.trim(),
      registerNumber: registerNumber.trim(),
      email:          email.trim(),
      isLateralEntry: !!isLateralEntry,
      batch:          tutor.batch  || undefined,
      branch:         tutor.branch || undefined,
      password:       hashedPassword,
    });

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'student_created',
      description: `${tutor.name} added student ${student.name} (${student.registerNumber})`,
      targetType: 'Student',
      targetId: student._id,
      targetName: student.name,
    });

    res.json({
      message: 'Student added successfully',
      defaultPassword, // show this to the tutor once — share it with the student
      student: {
        id: student._id,
        name: student.name,
        registerNumber: student.registerNumber,
        email: student.email,
        isLateralEntry: student.isLateralEntry,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A student with that register number or email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── UPLOAD STUDENTS via CSV ──────────────────────────────────────────────────
// CSV columns: name, registerNumber, email, isLateralEntry (true/false)
// Each student is created with a default password of firstName + "12345".
router.post('/students/upload', tutorAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const tutor = await fetchConfiguredTutor(req, res);
  if (!tutor) { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); return; }
  if (!requireFullTutor(tutor, res)) { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); return; }

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const studentsToInsert = await Promise.all(results.map(async (s) => {
          const defaultPassword = generateDefaultPassword(s.name);
          const hashedPassword  = await bcrypt.hash(defaultPassword, 10);

          return {
            name:               s.name?.trim(),
            registerNumber:     s.registerNumber?.trim(),
            email:              s.email?.trim(),
            isLateralEntry:     /^(true|yes|1)$/i.test((s.isLateralEntry || '').trim()),
            batch:              tutor?.batch  || undefined,
            branch:             tutor?.branch || undefined,
            password:           hashedPassword,
          };
        }));

        const inserted = await Student.insertMany(studentsToInsert, { ordered: false });
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        logActivity({
          req,
          actorType: 'tutor',
          actorId: tutor._id,
          actorName: tutor.name,
          actorEmail: tutor.email,
          action: 'students_bulk_uploaded',
          description: `${tutor.name} uploaded ${inserted.length} student(s) via CSV`,
          meta: { count: inserted.length },
        });

        res.json({
          message: `${inserted.length} students uploaded successfully`,
          note: "Each student's default password is their first name (lowercase) + \"12345\", e.g. \"arjun12345\". They can change it via Reset / Forgot Password.",
        });
      } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: err.message });
      }
    });
});

// ─── PENDING CERTIFICATES (tutor's batch+branch students only) ───────────────
router.get('/certificates/pending', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchConfiguredTutor(req, res);
    if (!tutor) return;
    const query = {};
    if (tutor.batch)  query.batch  = tutor.batch;
    if (tutor.branch) query.branch = tutor.branch;

    // Get student IDs in this tutor's scope
    const students = await Student.find(query).select('_id');
    const studentIds = students.map(s => s._id);

    const certs = await Certificate.find({ status: 'pending', student: { $in: studentIds } })
      .populate('student', 'name registerNumber email batch branch')
      .populate('category')
      .sort({ createdAt: 1 });

    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ALL CERTIFICATES (tutor's scope) ────────────────────────────────────────
router.get('/certificates', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchConfiguredTutor(req, res);
    if (!tutor) return;
    const query = {};
    if (tutor.batch)  query.batch  = tutor.batch;
    if (tutor.branch) query.branch = tutor.branch;

    const students   = await Student.find(query).select('_id');
    const studentIds = students.map(s => s._id);

    const certs = await Certificate.find({ student: { $in: studentIds } })
      .populate('student',  'name registerNumber email batch branch totalPoints')
      .populate('category', 'name subcategories maxPoints');

    res.json({ success: true, certificates: certs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── APPROVE CERTIFICATE ──────────────────────────────────────────────────────
router.post('/certificates/:id/approve', tutorAuth, async (req, res) => {
  try {
    const authz = await authorizeCertificateAccess(req, res);
    if (!authz) return; // response already sent
    const { cert } = authz;

    const category = await Category.findById(cert.category);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const isOthers = cert.subcategory?.toLowerCase() === 'others';
    if (isOthers) {
      return res.status(400).json({ error: 'Please reassign this certificate to a proper category/subcategory before approving.' });
    }

    const sub = category.subcategories.find(
      s => s.name.toLowerCase() === cert.subcategory.toLowerCase()
    );
    if (!sub) return res.status(404).json({ error: 'Subcategory not found in category' });

    let pointsToAward = 0;

    if (sub.fixedPoints !== null && sub.fixedPoints !== undefined) {
      pointsToAward = sub.fixedPoints;
    } else if (sub.levels?.length) {
      if (!cert.level || !cert.prizeType) {
        return res.status(400).json({ error: 'Certificate is missing level or prize type. Please reassign it first.' });
      }
      const levelObj = sub.levels.find(l => l.name.toLowerCase() === cert.level.toLowerCase());
      if (!levelObj) return res.status(400).json({ error: 'Invalid competition level on certificate' });
      const prizeObj = levelObj.prizes.find(p => p.type === cert.prizeType);
      if (!prizeObj) return res.status(400).json({ error: 'Invalid prize type on certificate' });
      pointsToAward = prizeObj.points;
    }

    if (sub.maxPoints !== null && sub.maxPoints !== undefined) {
      pointsToAward = Math.min(pointsToAward, sub.maxPoints);
    }

    cert.status        = 'approved';
    cert.pointsAwarded = pointsToAward;
    await cert.save();

    const categories = await Category.find();
    const newTotal   = await syncStudentTotalPoints(cert.student, Certificate, Student, categories);

    logActivity({
      req,
      actorType: 'tutor',
      actorId: authz.tutor._id,
      actorName: authz.tutor.name,
      actorEmail: authz.tutor.email,
      action: 'certificate_approved',
      description: `${authz.tutor.name} approved "${cert.eventName || cert.subcategory}" for ${authz.student.name} (+${pointsToAward} pts)`,
      targetType: 'Certificate',
      targetId: cert._id,
      targetName: cert.eventName || cert.subcategory,
      meta: { pointsAwarded: pointsToAward, student: authz.student.name },
    });

    // ── Push notification (non-blocking) ─────────────────────────────────────
    const student = await Student.findById(cert.student).select('fcmToken');
    if (student?.fcmToken) {
      const certName = cert.eventName || cert.subcategory || 'Your certificate';
      sendPushNotification(
        student.fcmToken,
        '🎉 Certificate Approved!',
        `"${certName}" has been approved. ${pointsToAward} points have been added to your account.`,
        { status: 'approved', certId: cert._id.toString() }
      ); // intentionally NOT awaited — don't block the response
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.json({
      message: 'Certificate approved',
      pointsAwarded: pointsToAward,
      studentTotalPoints: newTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REJECT CERTIFICATE ───────────────────────────────────────────────────────
router.post('/certificates/:id/reject', tutorAuth, async (req, res) => {
  try {
    const authz = await authorizeCertificateAccess(req, res);
    if (!authz) return;
    const { cert } = authz;

    cert.status          = 'rejected';
    cert.pointsAwarded   = 0;
    cert.rejectionReason = req.body.reason || '';
    await cert.save();

    const categories = await Category.find();
    await syncStudentTotalPoints(cert.student, Certificate, Student, categories);

    logActivity({
      req,
      actorType: 'tutor',
      actorId: authz.tutor._id,
      actorName: authz.tutor.name,
      actorEmail: authz.tutor.email,
      action: 'certificate_rejected',
      description: `${authz.tutor.name} rejected "${cert.eventName || cert.subcategory}" for ${authz.student.name}${cert.rejectionReason ? ` (${cert.rejectionReason})` : ''}`,
      targetType: 'Certificate',
      targetId: cert._id,
      targetName: cert.eventName || cert.subcategory,
      meta: { reason: cert.rejectionReason, student: authz.student.name },
    });

    // ── Push notification (non-blocking) ─────────────────────────────────────
    const student = await Student.findById(cert.student).select('fcmToken');
    if (student?.fcmToken) {
      const certName = cert.eventName || cert.subcategory || 'Your certificate';
      const reason   = cert.rejectionReason
        ? `: ${cert.rejectionReason}`
        : '. Please check the app for details.';
      sendPushNotification(
        student.fcmToken,
        '❌ Certificate Rejected',
        `"${certName}" was rejected${reason}`,
        { status: 'rejected', certId: cert._id.toString() }
      ); // intentionally NOT awaited
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.json({ message: 'Certificate rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── REASSIGN CERTIFICATE (change category / subcategory / level / prizeType) ─
router.patch('/certificates/:id/reassign', tutorAuth, async (req, res) => {
  try {
    const { categoryId, subcategoryName, level, prizeType } = req.body;

    if (!categoryId || !subcategoryName) {
      return res.status(400).json({ error: 'categoryId and subcategoryName are required' });
    }

    const authz = await authorizeCertificateAccess(req, res);
    if (!authz) return;
    const { cert } = authz;

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // Verify subcategory exists within that category
    const sub = category.subcategories.find(
      s => s.name.toLowerCase() === subcategoryName.toLowerCase()
    );
    if (!sub) return res.status(404).json({ error: 'Subcategory not found in selected category' });

    // Calculate new potential points
    let potentialPoints = 0;
    if (sub.fixedPoints != null) {
      potentialPoints = sub.fixedPoints;
    } else if (sub.levels?.length && level && prizeType) {
      const lvl   = sub.levels.find(l => l.name.toLowerCase() === level.toLowerCase());
      const prize = lvl?.prizes.find(p => p.type === prizeType);
      potentialPoints = prize?.points ?? 0;
    }

    cert.category        = categoryId;
    cert.subcategory     = subcategoryName;
    cert.level           = level   || null;
    cert.prizeType       = prizeType || null;
    cert.potentialPoints = potentialPoints;
    // Keep status as pending so tutor still needs to approve after reassigning
    cert.status          = 'pending';
    cert.pointsAwarded   = 0;
    await cert.save();

    // Recalculate total in case cert was previously approved
    const allCategories = await Category.find();
    await syncStudentTotalPoints(cert.student, Certificate, Student, allCategories);

    logActivity({
      req,
      actorType: 'tutor',
      actorId: authz.tutor._id,
      actorName: authz.tutor.name,
      actorEmail: authz.tutor.email,
      action: 'certificate_reassigned',
      description: `${authz.tutor.name} reassigned a certificate for ${authz.student.name} to "${subcategoryName}"`,
      targetType: 'Certificate',
      targetId: cert._id,
      targetName: cert.eventName || subcategoryName,
      meta: { category: category.name, subcategory: subcategoryName, level, prizeType, student: authz.student.name },
    });

    res.json({ message: 'Certificate reassigned successfully', potentialPoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REVERT APPROVED CERTIFICATE BACK TO PENDING ─────────────────────────────
router.post('/certificates/:id/revert-to-pending', tutorAuth, async (req, res) => {
  try {
    const authz = await authorizeCertificateAccess(req, res);
    if (!authz) return;
    const { cert } = authz;

    if (cert.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved certificates can be reverted to pending' });
    }

    cert.status        = 'pending';
    cert.pointsAwarded = 0;
    await cert.save();

    const categories = await Category.find();
    await syncStudentTotalPoints(cert.student, Certificate, Student, categories);

    logActivity({
      req,
      actorType: 'tutor',
      actorId: authz.tutor._id,
      actorName: authz.tutor.name,
      actorEmail: authz.tutor.email,
      action: 'certificate_reverted_to_pending',
      description: `${authz.tutor.name} reverted "${cert.eventName || cert.subcategory}" for ${authz.student.name} back to pending`,
      targetType: 'Certificate',
      targetId: cert._id,
      targetName: cert.eventName || cert.subcategory,
      meta: { student: authz.student.name },
    });

    // ── Push notification (non-blocking) ─────────────────────────────────────
    const student = await Student.findById(cert.student).select('fcmToken');
    if (student?.fcmToken) {
      const certName = cert.eventName || cert.subcategory || 'Your certificate';
      sendPushNotification(
        student.fcmToken,
        '🔄 Certificate Under Review',
        `"${certName}" has been moved back to pending review.`,
        { status: 'pending', certId: cert._id.toString() }
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.json({ message: 'Certificate reverted to pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FORGOT PASSWORD — send OTP to tutor's email ─────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const tutor = await Tutor.findOne({ email: email.trim().toLowerCase() });
    if (!tutor) return res.status(404).json({ message: 'No tutor account found with that email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    tutor.resetPasswordToken   = otp;
    tutor.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await tutor.save();

    await sendTutorResetOTPEmail(tutor.email, tutor.name, otp);

    // Mask the email — e.g. jo***@gmail.com
    const masked = tutor.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);
    res.json({ message: 'OTP sent to your registered email', maskedEmail: masked });
  } catch (err) {
    console.error('Tutor forgot-password error:', err.response?.body || err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── RESET PASSWORD — verify OTP and set new password ────────────────────────
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const tutor = await Tutor.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordToken:   otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!tutor) return res.status(400).json({ message: 'Invalid or expired OTP' });

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    tutor.password             = newPassword; // pre-save hook hashes it
    tutor.resetPasswordToken   = null;
    tutor.resetPasswordExpires = null;
    tutor.firstTimePasswordSet = true; // they've set their own password now — stop nagging them
    await tutor.save();

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'tutor_password_reset',
      description: `${tutor.name} reset their password`,
      targetType: 'Tutor',
      targetId: tutor._id,
      targetName: tutor.name,
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Tutor reset-password error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});
// ─── GET TUTOR PROFILE ────────────────────────────────────────────────────────
router.get('/me', tutorAuth, async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.tutor.id)
      .populate('batch',  'name')
      .populate('branch', 'name')
      .select('-password -resetPasswordToken -resetPasswordExpires -fcmToken');
    if (!tutor) return res.status(404).json({ error: 'Tutor not found' });
    res.json(tutor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPLOAD / UPDATE TUTOR PROFILE PHOTO ─────────────────────────────────────
router.patch('/profile-photo', tutorAuth, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo file provided' });

    const tutor = await Tutor.findById(req.tutor.id).select('name profilePhoto profilePhotoFileId');
    if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

    // Delete old image from ImageKit if it exists
    if (tutor.profilePhotoFileId) {
      try { await imagekit.deleteFile(tutor.profilePhotoFileId); } catch (_) {}
    }

    const extension = path.extname(req.file.originalname) || '.jpg';
    const fileName  = `tutor_${req.tutor.id}_${Date.now()}${extension}`;

    const uploadResponse = await imagekit.upload({
      file:            req.file.buffer,
      fileName,
      folder:          '/tutor-profiles',
      useUniqueFileName: false,
    });

    tutor.profilePhoto       = uploadResponse.url;
    tutor.profilePhotoFileId = uploadResponse.fileId;
    await tutor.save();

    logActivity({
      req,
      actorType: 'tutor',
      actorId: req.tutor.id,
      actorName: tutor.name,
      action: 'tutor_profile_photo_updated',
      description: `${tutor.name || 'A tutor'} updated their profile photo`,
      targetType: 'Tutor',
      targetId: tutor._id,
      targetName: tutor.name,
    });

    res.json({ success: true, profilePhoto: uploadResponse.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Profile photo upload failed' });
  }
});

module.exports = router;
