import test from "node:test";
import assert from "node:assert/strict";

test("Cron Converter: Validates HH:MM and generates valid cron format", () => {
  const toCron = (value, fallback = "06:00") => {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? "")) ? String(value) : fallback;
    const [hh, mm] = time.split(":");
    return { cron: `${Number(mm)} ${Number(hh)} * * *`, time };
  };

  assert.deepEqual(toCron("06:30"), { cron: "30 6 * * *", time: "06:30" });
  assert.deepEqual(toCron("20:00"), { cron: "0 20 * * *", time: "20:00" });
  assert.deepEqual(toCron("invalid-time", "06:00"), { cron: "0 6 * * *", time: "06:00" });
});

test("Sanitization: Accusative Tamil name suffix generator", () => {
  const formatTamilName = (name, age) => {
    if (age !== null && age < 30) {
      return name + " -ஐ";
    }
    return name + " அவர்களை";
  };

  assert.equal(formatTamilName("யோவான்", 22), "யோவான் -ஐ");
  assert.equal(formatTamilName("தாவீது", 45), "தாவீது அவர்களை");
});
