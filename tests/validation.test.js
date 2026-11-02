import test from "node:test";
import assert from "node:assert/strict";
import { validateBody, loginSchema, z } from "../src/api/validate.js";

const run = (schema, body) => {
  const req = { body };
  let status = null, payload = null, nexted = false;
  const res = { status(c) { status = c; return this; }, json(p) { payload = p; return this; } };
  validateBody(schema)(req, res, () => { nexted = true; });
  return { req, status, payload, nexted };
};

test("validateBody: accepts and trims valid login secret", () => {
  const r = run(loginSchema, { secret: "  hunter22  ", extra: "dropped" });
  assert.equal(r.nexted, true);
  assert.deepEqual(r.req.body, { secret: "hunter22" });
});

test("validateBody: rejects non-string and oversized values with 400", () => {
  assert.equal(run(loginSchema, { secret: { $gt: "" } }).status, 400);
  assert.equal(run(loginSchema, { secret: "x".repeat(300) }).status, 400);
});

test("validateBody: reports the offending field", () => {
  const r = run(z.object({ n: z.number() }), { n: "x" });
  assert.equal(r.status, 400);
  assert.match(r.payload.error, /Invalid n/);
});
