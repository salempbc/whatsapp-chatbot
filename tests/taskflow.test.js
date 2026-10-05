import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickAddTask } from "../src/services/taskService.js";

test("TaskFlow: parseQuickAddTask parses tags, dates, times, and notes correctly", () => {
  const input = "meet Elder Thomas tomorrow at 4pm #visitation #pastoral - discuss communion bread";
  const result = parseQuickAddTask(input);

  assert.equal(result.title, "meet Elder Thomas");
  assert.equal(result.description, "discuss communion bread");
  assert.equal(result.dueTime, "16:00");
  assert.ok(result.dueDate, "Due date should be computed");
  assert.deepEqual(result.tags, ["visitation", "pastoral"]);
  assert.equal(result.priority, "medium");
});

test("TaskFlow: parseQuickAddTask handles relative day offsets like 'in 3 days'", () => {
  const input = "clean prayer hall in 3 days at 10am #facility - sound system check";
  const result = parseQuickAddTask(input);

  assert.equal(result.title, "clean prayer hall");
  assert.equal(result.description, "sound system check");
  assert.equal(result.dueTime, "10:00");
  assert.ok(result.dueDate, "Due date should be set");
  assert.deepEqual(result.tags, ["facility"]);
});

test("TaskFlow: parseQuickAddTask falls back gracefully on empty or plain strings", () => {
  const empty = parseQuickAddTask("");
  assert.equal(empty.title, "");
  assert.equal(empty.dueDate, "");
  assert.deepEqual(empty.tags, []);

  const plain = parseQuickAddTask("Prepare Sunday sermon");
  assert.equal(plain.title, "Prepare Sunday sermon");
  assert.equal(plain.description, "");
  assert.equal(plain.dueDate, "");
  assert.equal(plain.dueTime, "");
  assert.deepEqual(plain.tags, []);
});

test("TaskFlow: Time and estimate formatting math", () => {
  const formatEstimate = (mins) => {
    if (!mins || mins <= 0) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  assert.equal(formatEstimate(45), "45m");
  assert.equal(formatEstimate(60), "1h");
  assert.equal(formatEstimate(90), "1h 30m");
  assert.equal(formatEstimate(125), "2h 5m");
  assert.equal(formatEstimate(0), "");
});
