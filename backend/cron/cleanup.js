// cron/cleanup.js – 24-hour auto-deletion of expired photos
//
// MongoDB has a TTL index on `expires_at` that handles DB cleanup automatically (~every 60s).
// But TTL doesn't touch Firebase Storage — those files would become orphaned.
// This cron job runs every X minutes to:
//   1. Find expired photos still in DB (before TTL fires)
//   2. Delete the files from Firebase Storage
//   3. Delete the DB documents (idempotent — safe if TTL already removed them)

const cron = require('node-cron');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const { deleteFromFirebase } = require('../config/firebase');

// How often the cleanup runs. Default: every 10 minutes
const CRON_SCHEDULE = process.env.CLEANUP_CRON || '*/10 * * * *';

let isRunning = false;
let totalDeleted = 0;
let lastRun = null;

async function runCleanup() {
  if (isRunning) {
    console.log('🧹 [cleanup] Already running, skipping…');
    return;
  }
  isRunning = true;
  const startTime = Date.now();

  try {
    const now = new Date();
    // Find photos whose 24h window has passed
    const expired = await Photo.find({ expires_at: { $lte: now } })
      .select('_id firebase_path event_id')
      .lean();

    if (expired.length === 0) {
      lastRun = { time: now, deleted: 0, durationMs: Date.now() - startTime };
      isRunning = false;
      return;
    }

    console.log(`🧹 [cleanup] Found ${expired.length} expired photo(s) to delete…`);

    let firebaseDeleted = 0;
    let firebaseFailed = 0;

    // Delete from Firebase in parallel batches of 10 to avoid hammering API
    const BATCH = 10;
    for (let i = 0; i < expired.length; i += BATCH) {
      const slice = expired.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        slice.map((p) => (p.firebase_path ? deleteFromFirebase(p.firebase_path) : Promise.resolve()))
      );
      results.forEach((r) => (r.status === 'fulfilled' ? firebaseDeleted++ : firebaseFailed++));
    }

    // Delete DB records
    const ids = expired.map((p) => p._id);
    const dbResult = await Photo.deleteMany({ _id: { $in: ids } });

    // Decrement photo_count on each affected event
    const eventCounts = expired.reduce((acc, p) => {
      const k = p.event_id.toString();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    await Promise.all(
      Object.entries(eventCounts).map(([eventId, count]) =>
        Event.updateOne({ _id: eventId }, { $inc: { photo_count: -count } })
      )
    );

    totalDeleted += dbResult.deletedCount;
    lastRun = {
      time: now,
      deleted: dbResult.deletedCount,
      firebaseDeleted,
      firebaseFailed,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `✅ [cleanup] Removed ${dbResult.deletedCount} photo(s) ` +
      `(Firebase: ${firebaseDeleted} ok, ${firebaseFailed} failed) in ${Date.now() - startTime}ms`
    );
  } catch (err) {
    console.error('❌ [cleanup] Error:', err.message);
  } finally {
    isRunning = false;
  }
}

function initCleanupJob() {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`❌ [cleanup] Invalid CRON_SCHEDULE: ${CRON_SCHEDULE}`);
    return;
  }

  cron.schedule(CRON_SCHEDULE, runCleanup);
  console.log(`✅ Cleanup cron scheduled (${CRON_SCHEDULE}) — 24h photo expiration active`);

  // Run once on startup, after a 30s delay (lets server warm up)
  setTimeout(runCleanup, 30_000);
}

// Manual trigger (for admin endpoint)
async function manualCleanup() {
  await runCleanup();
  return lastRun;
}

function getStatus() {
  return { isRunning, totalDeleted, lastRun, schedule: CRON_SCHEDULE };
}

module.exports = { initCleanupJob, manualCleanup, getStatus };