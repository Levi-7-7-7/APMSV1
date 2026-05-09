/**
 * SBTE Kerala Activity Points Rules — Frontend mirror of backend/utils/calcPoints.js
 * Keep both files in sync whenever this logic changes.
 *
 * Rule 1 : Regular → need 60 pts; Lateral Entry → need 40 pts.
 * Rule 3 : Arts / Sports — only HIGHEST single award per category counts (no clubbing).
 * Rule 6 : Per-segment cap = 40 (regular) / 30 (lateral entry).
 *
 * EXCEPTION: NCC (50) and NSS (50) have explicit PDF ceilings > 40, so they
 * override Rule 6 for regular students. For lateral entry the cap is still
 * min(categoryMaxPoints, 30), so NCC/NSS lateral → 30.
 *
 * Detection: if category.maxPoints !== 40 it was explicitly set in the PDF.
 */

export const PASS_THRESHOLD  = { regular: 60, lateral: 40 };
export const PER_SEGMENT_CAP = { regular: 40, lateral: 30 };
const DEFAULT_MAX = 40;

/**
 * @param {Array}   approvedCerts   - approved certs (category populated or ID)
 * @param {Array}   categories      - all Category objects for ID→doc lookup
 * @param {Boolean} isLateralEntry
 * @returns {Number}
 */
export function calcCappedPoints(approvedCerts, categories = [], isLateralEntry = false) {
  const perSegmentCap = isLateralEntry ? PER_SEGMENT_CAP.lateral : PER_SEGMENT_CAP.regular;

  const grouped = {};
  approvedCerts.forEach(cert => {
    const catId  = cert.category?._id || cert.category;
    if (!catId) return;
    const catKey = catId.toString();
    if (!grouped[catKey]) {
      const catDoc =
        (cert.category && typeof cert.category === 'object' && cert.category.name)
          ? cert.category
          : categories.find(c => (c._id === catKey) || (c._id?.toString() === catKey)) || null;
      grouped[catKey] = { certs: [], catDoc };
    }
    grouped[catKey].certs.push(cert);
  });

  let grandTotal = 0;

  Object.values(grouped).forEach(({ certs, catDoc }) => {
    const catName   = (catDoc?.name || '').toLowerCase();
    const catMaxPts = catDoc?.maxPoints ?? DEFAULT_MAX;

    // Explicit ceiling (NCC=50, NSS=50, Sports=30, Arts=30, Disaster=20) vs generic (40)
    const hasExplicitCeiling = catMaxPts !== DEFAULT_MAX;
    const effectiveCap = hasExplicitCeiling
      ? (isLateralEntry ? Math.min(catMaxPts, perSegmentCap) : catMaxPts)
      : perSegmentCap;

    // Rule 3
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

export function passThreshold(isLateralEntry) {
  return isLateralEntry ? PASS_THRESHOLD.lateral : PASS_THRESHOLD.regular;
}
