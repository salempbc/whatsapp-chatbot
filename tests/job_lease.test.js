import test from "node:test";
import assert from "node:assert/strict";
import JobLease from "../src/models/JobLease.js";
import { acquireLease, releaseLease, runWithLease } from "../src/services/jobLeaseService.js";

/* Minimal in-memory stand-in for the unique-key lease collection. */
const installFakeStore = () => {
  const store = new Map();
  JobLease.findOneAndUpdate = async (filter, update) => {
    const now = new Date();
    const cur = store.get(filter.key);
    const free = !cur || cur.expiresAt <= now || cur.holder === update.$set.holder;
    if (!free) {
      const err = new Error("E11000 duplicate key");
      err.code = 11000;
      throw err;
    }
    const doc = { key: filter.key, ...update.$set };
    store.set(filter.key, doc);
    return doc;
  };
  JobLease.deleteOne = async ({ key, holder }) => {
    if (store.get(key)?.holder === holder) store.delete(key);
  };
  return store;
};

test("Job lease: only one instance can hold a live lease", async () => {
  installFakeStore();
  assert.equal(await acquireLease("morning", 60_000, "A"), true);
  assert.equal(await acquireLease("morning", 60_000, "B"), false);
  assert.equal(await acquireLease("morning", 60_000, "A"), true, "holder may renew");
});

test("Job lease: expired lease can be taken over", async () => {
  installFakeStore();
  assert.equal(await acquireLease("job", 1, "A"), true);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await acquireLease("job", 60_000, "B"), true);
});

test("Job lease: runWithLease skips when held and releases on failure", async () => {
  installFakeStore();
  await acquireLease("daily", 60_000, "other-instance");
  let ran = false;
  const realLog = console.log;
  console.log = () => {};
  try {
    assert.equal(await runWithLease("daily", 60_000, async () => { ran = true; }), null);
  } finally {
    console.log = realLog;
  }
  assert.equal(ran, false);

  await assert.rejects(runWithLease("fresh", 60_000, async () => { throw new Error("boom"); }), /boom/);
  assert.equal(await acquireLease("fresh", 60_000, "B"), true, "failed run frees the lease for retry");
  await releaseLease("fresh", "B");
});
