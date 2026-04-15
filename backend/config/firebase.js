// config/firebase.js – Firebase Admin SDK initialization

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let storage = null;
let bucket = null;

const initFirebase = () => {
  if (admin.apps.length > 0) return; // Already initialized

  let serviceAccount;

  // Try loading from file path first
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const resolvedPath = path.resolve(saPath);

  if (fs.existsSync(resolvedPath)) {
    serviceAccount = require(resolvedPath);
  } else {
    // Fallback: try reading from env var directly (JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      console.error('❌ Firebase service account not found. Check FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON');
      process.exit(1);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  storage = admin.storage();
  bucket = storage.bucket();

  console.log('✅ Firebase Admin initialized');
};

/**
 * Upload a buffer to Firebase Storage
 * @param {Buffer} buffer - File buffer
 * @param {string} destPath - Destination path in bucket (e.g. "events/abc123/photo.jpg")
 * @param {string} mimetype - File MIME type
 * @returns {Promise<string>} Public URL
 */
const uploadToFirebase = async (buffer, destPath, mimetype) => {
  if (!bucket) throw new Error('Firebase not initialized');

  const file = bucket.file(destPath);

  await file.save(buffer, {
    metadata: {
      contentType: mimetype,
      cacheControl: 'public, max-age=31536000',
    },
  });

  // Make the file publicly readable
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destPath}`;
  return publicUrl;
};

/**
 * Delete a file from Firebase Storage
 * @param {string} destPath - File path in bucket
 */
const deleteFromFirebase = async (destPath) => {
  if (!bucket) throw new Error('Firebase not initialized');
  try {
    await bucket.file(destPath).delete();
  } catch (err) {
    console.warn(`⚠️  Could not delete Firebase file ${destPath}:`, err.message);
  }
};

module.exports = { initFirebase, uploadToFirebase, deleteFromFirebase };