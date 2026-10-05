import test from "node:test";
import assert from "node:assert/strict";
import { getTodayKey, getTomorrowKey } from "../src/services/eventService.js";

test("Date Helpers: getTodayKey and getTomorrowKey return valid MM-DD format", () => {
  const todayKey = getTodayKey();
  const tomorrowKey = getTomorrowKey();

  assert.match(todayKey, /^\d{2}-\d{2}$/, "todayKey must match MM-DD format");
  assert.match(tomorrowKey, /^\d{2}-\d{2}$/, "tomorrowKey must match MM-DD format");
});

test("Event Engine: Age calculation logic", () => {
  const calcAge = (dobString, refDate = new Date("2026-10-05")) => {
    if (!dobString) return null;
    const birth = new Date(dobString);
    let age = refDate.getFullYear() - birth.getFullYear();
    const m = refDate.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) age--;
    return age;
  };

  assert.equal(calcAge("2000-10-04"), 26);
  assert.equal(calcAge("2000-10-06"), 25);
  assert.equal(calcAge("1970-01-01"), 56);
  assert.equal(calcAge(null), null);
});

test("Template Parser: Conditional block rendering", () => {
  const processConditionals = (str, ctx) => {
    if (!str) return str;
    let res = str;
    for (const [k, v] of Object.entries(ctx)) {
      res = res.replace(new RegExp("\\{" + k + "\\}", "gi"), v === null || v === undefined ? "" : v);
    }
    
    res = res.replace(/\{if\s+([a-zA-Z0-9_]+)\s*(==|=|!=|>|<|>=|<=)\s*(\d+)\}([\s\S]*?)\{endif\}/gi, (match, varName, op, val, content) => {
      const contextVal = ctx[varName];
      if (contextVal === undefined || contextVal === null) return "";
      const left = Number(contextVal);
      const right = Number(val);
      let isTrue = false;
      
      switch (op) {
        case "==":
        case "=": isTrue = left === right; break;
        case "!=": isTrue = left !== right; break;
        case ">": isTrue = left > right; break;
        case "<": isTrue = left < right; break;
        case ">=": isTrue = left >= right; break;
        case "<=": isTrue = left <= right; break;
      }
      return isTrue ? content : "";
    });
    return res;
  };

  const tpl = "Happy Birthday {name}! {if age >= 60}Senior Citizen Blessing.{endif}";
  
  const youngResult = processConditionals(tpl, { name: "David", age: 25 });
  assert.equal(youngResult, "Happy Birthday David! ");

  const seniorResult = processConditionals(tpl, { name: "Abraham", age: 70 });
  assert.equal(seniorResult, "Happy Birthday Abraham! Senior Citizen Blessing.");
});
