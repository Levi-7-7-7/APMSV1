/**
 * utils/tutorRoleRules.js
 *
 * A tutor-side account can be one of three roles, each with a required
 * batch/branch shape:
 *
 *   - 'tutor'     -> batch REQUIRED, branch REQUIRED (scoped to one class)
 *   - 'hod'       -> batch must be BLANK, branch REQUIRED (whole branch, every batch)
 *   - 'principal' -> batch BLANK, branch BLANK (whole college)
 *
 * This is the single source of truth for that shape, used both when an
 * admin creates/assigns a tutor-side account (routes/adminRoutes.js) and
 * as a safety check on every tutor-side request (routes/tutorRoutes.js) —
 * so an account can never end up in / act from an inconsistent state
 * (e.g. role 'tutor' with no batch or branch set, which would otherwise
 * silently behave like a principal and see/act on everything).
 */

// Returns an error message string if the combination is invalid, or null if OK.
function validateTutorRoleConfig(role, batchId, branchId) {
  switch (role) {
    case 'tutor':
      if (!batchId || !branchId) {
        return 'A tutor must be assigned both a batch and a branch.';
      }
      return null;

    case 'hod':
      if (batchId) {
        return 'An HOD is scoped to a whole branch — batch must be left unassigned.';
      }
      if (!branchId) {
        return 'An HOD must be assigned a branch.';
      }
      return null;

    case 'principal':
      if (batchId || branchId) {
        return 'A principal oversees every batch and branch — neither should be assigned.';
      }
      return null;

    default:
      return `Unknown role "${role}".`;
  }
}

module.exports = { validateTutorRoleConfig };
