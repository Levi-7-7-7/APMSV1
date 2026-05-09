/**
 * SBTE Kerala Activity Points Rules (Annexure 1)
 *
 * Rule 1 : Regular students need 60 pts to pass; lateral entry need 40.
 * Rule 3 : Arts / Sports — participation + position cannot be clubbed.
 *          Only the highest single award counts per category.
 * Rule 6 : Max points from any single segment = 40 (regular) / 30 (lateral entry).
 *
 * EXCEPTION to Rule 6:
 *   Categories with their own EXPLICIT maxPoints in the SBTE PDF override the
 *   generic Rule 6 default of 40.  These are:
 *     NCC             → 50   (regular)
 *     NSS             → 50   (regular)
 *     Sports & Games  → 30   (regular) — already below Rule 6 default, so same effect
 *     Cultural Arts   → 30   (regular) — same
 *     Disaster Mgmt   → 20   (regular) — same
 *   For lateral entry the effective cap is still min(categoryMaxPoints, 30),
 *   so NCC/NSS lateral → min(50, 30) = 30. Generic categories → 30 (Rule 6).
 *
 * Logic:
 *   hasExplicitCeiling = category.maxPoints !== 40   (40 is the generic Rule 6 default)
 *   if hasExplicitCeiling:
 *     effectiveCap = isLateral ? min(catMaxPts, 30) : catMaxPts
 *     → NCC regular = 50 ✓   NCC lateral = 30 ✓
 *     → Sports regular = 30 ✓  Sports lateral = 30 ✓
 *   else (generic category, maxPoints === 40):
 *     effectiveCap = isLateral ? 30 : 40   (straight Rule 6)
 */

const PASS_THRESHOLD  = { regular: 60, lateral: 40 };
const PER_SEGMENT_CAP = { regular: 40, lateral: 30 };
const DEFAULT_MAX     = 40; // Rule 6 generic default

/**
 * @param {Array}   approvedCerts  - certs with status==='approved'; category must be populated
 * @param {Array}   categories     - all Category docs (fallback when cert.category is just an ID)
 * @param {Boolean} isLateralEntry
 * @returns {Number} capped grand-total
 */
function calcCappedPoints(approvedCerts, categories = [], isLateralEntry = false) {
  const perSegmentCap = isLateralEntry ? PER_SEGMENT_CAP.lateral : PER_SEGMENT_CAP.regular;

  // ── Group by category ────────────────────────────────────────────────────────
  const grouped = {};
  approvedCerts.forEach(cert => {
    const catId = cert.category?._id?.toString() || cert.category?.toString();
    if (!catId) return;
    if (!grouped[catId]) grouped[catId] = { certs: [], catDoc: null };
    grouped[catId].certs.push(cert);
    if (!grouped[catId].catDoc) {
      grouped[catId].catDoc =
        (cert.category && typeof cert.category === 'object' && cert.category.name)
          ? cert.category
          : (categories.find(c => c._id?.toString() === catId) || null);
    }
  });

  let grandTotal = 0;

  Object.values(grouped).forEach(({ certs, catDoc }) => {
    const catName   = (catDoc?.name || '').toLowerCase();
    const catMaxPts = catDoc?.maxPoints ?? DEFAULT_MAX;

    // Has the PDF explicitly defined a different ceiling for this category?
    const hasExplicitCeiling = catMaxPts !== DEFAULT_MAX;

    const effectiveCap = hasExplicitCeiling
      ? (isLateralEntry ? Math.min(catMaxPts, perSegmentCap) : catMaxPts)
      : perSegmentCap;
    // Examples:
    //   NCC (50) regular  → 50   lateral → min(50,30)=30
    //   NSS (50) regular  → 50   lateral → 30
    //   Sports (30) reg   → 30   lateral → min(30,30)=30
    //   Generic (40) reg  → 40   lateral → 30

    // ── Rule 3: Arts/Sports — only the HIGHEST single award counts ─────────────
    let catSum = 0;
    if (catName.includes('arts') || catName.includes('sports') || catName.includes('games')) {
      catSum = Math.max(...certs.map(c => c.pointsAwarded || 0), 0);
    } else {
      catSum = certs.reduce((s, c) => s + (c.pointsAwarded || 0), 0);
    }

    grandTotal += Math.min(catSum, effectiveCap);
  });

  return grandTotal;
}

/**
 * Recalculate and persist Student.totalPoints from scratch.
 * Call after every approve / reject / reassign.
 */
async function syncStudentTotalPoints(studentId, Certificate, Student, categories = []) {
  const approvedCerts = await Certificate.find({
    student: studentId,
    status: 'approved',
  }).populate('category', 'name maxPoints');

  const student = await Student.findById(studentId);
  if (!student) return 0;

  const newTotal = calcCappedPoints(approvedCerts, categories, student.isLateralEntry);
  await Student.findByIdAndUpdate(studentId, { totalPoints: newTotal });
  return newTotal;
}

module.exports = { calcCappedPoints, syncStudentTotalPoints, PASS_THRESHOLD, PER_SEGMENT_CAP };
