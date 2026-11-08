import crypto from "crypto";
import JobLease from "../models/JobLease.js";

export const INSTANCE_ID = crypto.randomUUID();

/**
 * Atomically claims a named lease. Returns true if this instance now holds it
 * (it was free, expired, or already ours), false if another instance holds it.
 */
export const acquireLease = async (key, ttlMs, holder = INSTANCE_ID) => {
  const now = new Date();
  try {
    const doc = await JobLease.findOneAndUpdate(
      { key, $or: [{ expiresAt: { $lte: now } }, { holder }] },
      { $set: { holder, expiresAt: new Date(now.getTime() + ttlMs) } },
      { upsert: true, new: true }
    );
    return doc?.holder === holder;
  } catch (err) {
    /* Duplicate key on upsert means another instance holds a live lease. */
    if (err?.code === 11000) return false;
    throw err;
  }
};

export const releaseLease = async (key, holder = INSTANCE_ID) => {
  await JobLease.deleteOne({ key, holder }).catch(() => {});
};

/**
 * Runs `fn` only if the lease for `key` is acquired. The lease is deliberately
 * held for the full TTL after success so a second instance firing the same cron
 * tick moments later cannot re-run the job.
 */
export const runWithLease = async (key, ttlMs, fn) => {
  if (!(await acquireLease(key, ttlMs))) {
    console.log(`⏭️ Job "${key}" skipped: lease held by another instance.`);
    return null;
  }
  try {
    return await fn();
  } catch (err) {
    await releaseLease(key);
    throw err;
  }
};
