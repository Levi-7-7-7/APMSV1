const { google } = require('googleapis');

// ─── Auth ────────────────────────────────────────────────────────────────────
// Uses a Service Account whose JSON key is stored in GOOGLE_SERVICE_ACCOUNT_JSON
// (the full JSON stringified, stored as an env var).
// The service account must be given "Editor" access to the shared Drive folder.

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find or create a folder by name inside a parent folder.
 * Returns the folder's Drive ID.
 */
async function findOrCreateFolder(drive, name, parentId) {
  // Check if it already exists
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id; // folder already exists
  }

  // Create it
  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  return folder.data.id;
}

// ─── Public API (mirrors imagekit.upload / imagekit.deleteFile) ───────────────

/**
 * Upload a file to Google Drive.
 *
 * @param {Object} opts
 * @param {Buffer} opts.fileBuffer
 * @param {string} opts.fileName
 * @param {string} opts.mimeType
 * @param {string} opts.department
 * @param {string} opts.batch
 * @param {string} opts.studentName
 *
 * @returns {{ fileId: string, url: string }}
 */

async function uploadFile({
  fileBuffer,
  fileName,
  mimeType,
  department,
  batch,
  studentName
}) {
  const auth = getAuthClient();

  const drive = google.drive({
    version: 'v3',
    auth
  });

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  // Folder structure:
  // root → department → batch → studentName

  const deptFolderId = await findOrCreateFolder(
    drive,
    department,
    rootFolderId
  );

  const batchFolderId = await findOrCreateFolder(
    drive,
    batch,
    deptFolderId
  );

  const studentFolderId = await findOrCreateFolder(
    drive,
    studentName,
    batchFolderId
  );

  // Upload file
  const { Readable } = require('stream');

  const stream = Readable.from(fileBuffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [studentFolderId],
    },

    media: {
      mimeType,
      body: stream,
    },

    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  // Public permission
  await drive.permissions.create({
    fileId: uploaded.data.id,

    requestBody: {
      role: 'reader',
      type: 'anyone',
    },

    supportsAllDrives: true,
  });

  return {
    fileId: uploaded.data.id,
    url: uploaded.data.webViewLink,
  };
}

/**
 * Delete a file from Google Drive by its fileId.
 * Best-effort — caller should catch errors.
 */
async function deleteFile(fileId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}

module.exports = { uploadFile, deleteFile };
