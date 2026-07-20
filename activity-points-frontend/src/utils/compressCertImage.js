/**
 * compressCertImage — shrinks an image file/blob that exceeds a target size,
 * by scaling its dimensions down (not its JPEG quality) until it fits. Used
 * after certificate crop so a large photo doesn't need to be rejected
 * outright.
 *
 * Quality stays fixed and high (default 0.92) throughout — only width/height
 * are reduced, so text on the certificate stays as legible as possible.
 */

const DEFAULT_TARGET_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_QUALITY = 0.92;
const SCALE_STEP = 0.85; // shrink dimensions by 15% per attempt
const MAX_ITERATIONS = 8;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = err => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
  });
}

/**
 * @param {Blob} blob - source image blob (already cropped, if applicable)
 * @param {object} [opts]
 * @param {number} [opts.targetBytes] - size to get under
 * @param {number} [opts.quality] - fixed JPEG quality used at every step
 * @returns {Promise<{blob: Blob, wasCompressed: boolean}>}
 */
export async function compressCertImage(blob, opts = {}) {
  const targetBytes = opts.targetBytes ?? DEFAULT_TARGET_BYTES;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  if (!blob || blob.size <= targetBytes) return { blob, wasCompressed: false };

  const img = await loadImage(blob);
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  let currentBlob = blob;

  for (let i = 0; i < MAX_ITERATIONS && currentBlob.size > targetBytes; i++) {
    width = Math.max(1, Math.round(width * SCALE_STEP));
    height = Math.max(1, Math.round(height * SCALE_STEP));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const nextBlob = await canvasToBlob(canvas, quality);
    if (!nextBlob) break;
    currentBlob = nextBlob;
  }

  return { blob: currentBlob, wasCompressed: true };
}
