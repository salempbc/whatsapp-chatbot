import test from "node:test";
import assert from "node:assert/strict";

test("Fast Entry: Age estimator computes valid birth year and child flag", () => {
  const computeFromAge = (ageInput) => {
    const age = parseInt(ageInput, 10);
    if (isNaN(age) || age < 0 || age > 120) return null;
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    return {
      dob: `${birthYear}-01-01`,
      isChild: age < 18,
      recommendedRole: age < 18 ? "Youth" : "Member"
    };
  };

  const childResult = computeFromAge(12);
  assert.equal(childResult.isChild, true);
  assert.equal(childResult.recommendedRole, "Youth");
  assert.ok(childResult.dob.endsWith("-01-01"));

  const adultResult = computeFromAge(35);
  assert.equal(adultResult.isChild, false);
  assert.equal(adultResult.recommendedRole, "Member");
  assert.ok(adultResult.dob.endsWith("-01-01"));
});

test("Fast Entry: Household retention preserves family credentials while resetting individual fields", () => {
  const previousMember = {
    name: "Bro. David Solomon",
    gender: "male",
    role: "Member",
    familyName: "Solomon Family",
    phone: "+91 98765 43210",
    address: "12 Church Lane, Salem",
    dob: "1988-05-14",
    isChild: false,
    isMarried: true,
    spouseName: "Sis. Rachel"
  };

  const retainNextForm = (prev, keepHousehold = true) => {
    return {
      name: "",
      gender: "female",
      role: "Member",
      familyName: keepHousehold ? prev.familyName : "",
      phone: keepHousehold ? prev.phone : "",
      address: keepHousehold ? prev.address : "",
      dob: "",
      isChild: false,
      isMarried: false,
      spouseName: ""
    };
  };

  const nextForm = retainNextForm(previousMember, true);
  assert.equal(nextForm.name, "");
  assert.equal(nextForm.familyName, "Solomon Family");
  assert.equal(nextForm.phone, "+91 98765 43210");
  assert.equal(nextForm.address, "12 Church Lane, Salem");
  assert.equal(nextForm.spouseName, "");
});
