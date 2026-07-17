import assert from "node:assert/strict";
import test from "node:test";

import {
  applyEditableProfileDefaults,
  applyRoadsideProfileDefaults,
  applyTicketProfileDefaults,
  validateMemberProfileInput,
} from "./member-profile-form";
import type { MemberProfile, MemberProfileInput } from "./wp-profile";

const profile: MemberProfile = {
  id: 123,
  username: "member-login",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+15550100",
  membershipId: "MRC-1001",
};

test("ticket defaults fill empty contact fields without replacing typed values", () => {
  const result = applyTicketProfileDefaults(
    {
      firstName: "",
      lastName: "Typed last",
      phone: "",
      email: "typed@example.com",
    },
    profile
  );

  assert.deepEqual(result, {
    firstName: "Ada",
    lastName: "Typed last",
    phone: "+15550100",
    email: "typed@example.com",
  });
});

test("roadside defaults mark the requester as a member and preserve typed fields", () => {
  const result = applyRoadsideProfileDefaults(
    {
      firstName: "Typed first",
      lastName: "",
      phone: "",
      email: "",
      accountName: "Typed account",
      membershipId: "",
      isMember: false,
    },
    profile
  );

  assert.deepEqual(result, {
    firstName: "Typed first",
    lastName: "Lovelace",
    phone: "+15550100",
    email: "ada@example.com",
    accountName: "Typed account",
    membershipId: "MRC-1001",
    isMember: true,
  });
});

test("profile editor defaults preserve values typed before loading finishes", () => {
  const result = applyEditableProfileDefaults(
    {
      firstName: "Early typing",
      lastName: "",
      displayName: "",
      email: "",
      phone: "",
    },
    profile
  );

  assert.deepEqual(result, {
    firstName: "Early typing",
    lastName: "Lovelace",
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+15550100",
  });
});

const validInput: MemberProfileInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+1 555 0100",
};

test("profile validation accepts server-bounded valid input", () => {
  assert.equal(validateMemberProfileInput(validInput), null);
  assert.equal(
    validateMemberProfileInput({
      firstName: "é".repeat(100),
      lastName: "x".repeat(100),
      displayName: "d".repeat(100),
      email: `${"a".repeat(242)}@example.com`,
      phone: "1".repeat(40),
    }),
    null
  );
});

test("profile validation requires names, display name, and a basic valid email", () => {
  assert.match(
    validateMemberProfileInput({ ...validInput, firstName: " " }) ?? "",
    /first name/i
  );
  assert.match(
    validateMemberProfileInput({ ...validInput, lastName: "" }) ?? "",
    /last name/i
  );
  assert.match(
    validateMemberProfileInput({ ...validInput, displayName: "" }) ?? "",
    /display name/i
  );
  assert.match(
    validateMemberProfileInput({ ...validInput, email: "not-an-email" }) ?? "",
    /valid email/i
  );
});

test("profile validation enforces server text limits", () => {
  assert.match(
    validateMemberProfileInput({ ...validInput, firstName: "x".repeat(101) }) ?? "",
    /100 characters/i
  );
  assert.match(
    validateMemberProfileInput({ ...validInput, email: `${"a".repeat(243)}@example.com` }) ?? "",
    /254 characters/i
  );
  assert.match(
    validateMemberProfileInput({ ...validInput, phone: "1".repeat(41) }) ?? "",
    /40 characters/i
  );
});
