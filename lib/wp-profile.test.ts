import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import {
  MEMBER_PROFILE_UPDATED_EVENT,
  MemberProfileError,
  applyProfileDefaults,
  getMemberProfile,
  memberProfileErrorMessage,
  saveMemberProfile,
  type MemberProfile,
} from "./wp-profile";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }
}

class BrowserWindow extends EventTarget {
  localStorage = new MemoryStorage();
  sessionStorage = new MemoryStorage();
}

const browserWindow = new BrowserWindow();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalFetch = globalThis.fetch;

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  browserWindow.localStorage.clear();
  browserWindow.sessionStorage.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browserWindow,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: browserWindow.localStorage,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: browserWindow.sessionStorage,
  });
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  browserWindow.localStorage.clear();
  browserWindow.sessionStorage.clear();

  // A forced failed request guarantees no fulfilled profile remains cached.
  globalThis.fetch = async () => {
    throw new TypeError("reset");
  };
  await getMemberProfile(true).catch(() => undefined);
});

test("GET uses the shared bearer token and member profile endpoint", async () => {
  browserWindow.sessionStorage.setItem("wp_token", "session-jwt");
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return jsonResponse(profile);
  };

  assert.deepEqual(await getMemberProfile(true), profile);
  assert.equal(
    request?.url,
    "https://myroadclub.com/wp-json/myroadclub/v1/member-profile"
  );
  assert.equal(request?.init?.method, "GET");
  assert.equal(
    new Headers(request?.init?.headers).get("Authorization"),
    "Bearer session-jwt"
  );
});

test("missing token rejects as auth before fetch", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(profile);
  };

  await assert.rejects(
    getMemberProfile(true),
    (error: unknown) =>
      error instanceof MemberProfileError && error.kind === "auth"
  );
  assert.equal(calls, 0);
});

test("strictly rejects malformed and extra profile response fields", async () => {
  browserWindow.localStorage.setItem("wp_token", "jwt");
  const invalidProfiles: unknown[] = [
    { ...profile, id: "123" },
    { ...profile, id: 0 },
    { ...profile, username: null },
    { ...profile, firstName: false },
    { ...profile, lastName: undefined },
    { ...profile, displayName: 4 },
    { ...profile, email: [] },
    { ...profile, phone: {} },
    { ...profile, membershipId: 99 },
    { ...profile, internalRole: "administrator" },
  ];

  for (const invalidProfile of invalidProfiles) {
    globalThis.fetch = async () => jsonResponse(invalidProfile);
    await assert.rejects(
      getMemberProfile(true),
      (error: unknown) =>
        error instanceof MemberProfileError && error.kind === "server"
    );
  }
});

test("PATCH sends only editable fields and validates its response", async () => {
  browserWindow.localStorage.setItem("wp_token", "jwt");
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return jsonResponse({ ...profile, displayName: "Countess Lovelace" });
  };

  const result = await saveMemberProfile({
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Countess Lovelace",
    email: "ada@example.com",
    phone: "+15550100",
    id: 999,
    username: "attacker",
    membershipId: "OTHER",
  } as Parameters<typeof saveMemberProfile>[0] & {
    id: number;
    username: string;
    membershipId: string;
  });

  assert.equal(request?.url, "https://myroadclub.com/wp-json/myroadclub/v1/member-profile");
  assert.equal(request?.init?.method, "PATCH");
  assert.equal(new Headers(request?.init?.headers).get("Authorization"), "Bearer jwt");
  assert.equal(new Headers(request?.init?.headers).get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Countess Lovelace",
    email: "ada@example.com",
    phone: "+15550100",
  });
  assert.equal(result.displayName, "Countess Lovelace");

  globalThis.fetch = async () => jsonResponse({ ...profile, unexpected: true });
  await assert.rejects(
    saveMemberProfile(profile),
    (error: unknown) =>
      error instanceof MemberProfileError && error.kind === "server"
  );
});

test("maps auth, validation, network, and server failures to approved safe messages", async () => {
  browserWindow.localStorage.setItem("wp_token", "jwt");
  const expected = {
    auth: "Your session has expired. Please sign in again.",
    validation: "Some profile information could not be accepted. Review your details and try again.",
    network: "Could not reach My Road Club. Check your connection and try again.",
    server: "We could not load or save your profile. Please try again.",
  } as const;

  for (const [status, kind] of [
    [401, "auth"],
    [422, "validation"],
    [500, "server"],
  ] as const) {
    globalThis.fetch = async () =>
      jsonResponse({ code: "private_code", message: "private proxy or WP internals" }, status);
    await assert.rejects(
      getMemberProfile(true),
      (error: unknown) =>
        error instanceof MemberProfileError &&
        error.kind === kind &&
        error.message === expected[kind] &&
        !error.message.includes("private")
    );
  }

  globalThis.fetch = async () => {
    throw new TypeError("private network internals");
  };
  await assert.rejects(
    getMemberProfile(true),
    (error: unknown) =>
      error instanceof MemberProfileError &&
      error.kind === "network" &&
      error.message === expected.network
  );

  for (const [kind, message] of Object.entries(expected)) {
    assert.equal(
      memberProfileErrorMessage(
        new MemberProfileError(kind as keyof typeof expected, "private")
      ),
      message
    );
  }
  assert.equal(memberProfileErrorMessage(new Error("private")), expected.server);
});

test("concurrent and repeated GETs share the same cached request", async () => {
  browserWindow.localStorage.setItem("wp_token", "jwt");
  let calls = 0;
  let resolveResponse!: (response: Response) => void;
  globalThis.fetch = async () => {
    calls += 1;
    return await new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
  };

  const first = getMemberProfile(true);
  const concurrent = getMemberProfile();
  assert.equal(first, concurrent);
  assert.equal(calls, 1);
  resolveResponse(jsonResponse(profile));
  assert.deepEqual(await first, profile);
  assert.deepEqual(await getMemberProfile(), profile);
  assert.equal(calls, 1);
});

test("failed GET promises are cleared so the next request retries", async () => {
  browserWindow.localStorage.setItem("wp_token", "jwt");
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("offline");
    return jsonResponse(profile);
  };

  await assert.rejects(getMemberProfile(true));
  assert.deepEqual(await getMemberProfile(), profile);
  assert.equal(calls, 2);
});

test("save updates cache and dispatches an update event only after valid success", async () => {
  browserWindow.localStorage.setItem("wp_token", "jwt");
  const updated = { ...profile, phone: "+15550999" };
  let events = 0;
  const onUpdate = () => {
    events += 1;
  };
  browserWindow.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, onUpdate);

  globalThis.fetch = async () => jsonResponse({ ...updated, extra: "private" });
  await assert.rejects(saveMemberProfile(updated));
  assert.equal(events, 0);

  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.method, "PATCH");
    return jsonResponse(updated);
  };
  assert.deepEqual(await saveMemberProfile(updated), updated);
  assert.equal(events, 1);

  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(profile);
  };
  assert.deepEqual(await getMemberProfile(), updated);
  assert.equal(calls, 1);
  browserWindow.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, onUpdate);
});

test("profile APIs remain safe when rendered without window", async () => {
  Reflect.deleteProperty(globalThis, "window");
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(profile);
  };

  await assert.rejects(
    getMemberProfile(true),
    (error: unknown) =>
      error instanceof MemberProfileError && error.kind === "auth"
  );
  assert.equal(calls, 0);
});

test("applyProfileDefaults replaces only empty, null, and undefined values", () => {
  const current = {
    empty: "",
    nil: null as string | null,
    missing: undefined as string | undefined,
    text: "member input",
    disabled: false,
    zero: 0,
  };
  const defaults = {
    empty: "default empty",
    nil: "default nil",
    missing: "default missing",
    text: "default text",
    disabled: true,
    zero: 7,
  };

  const result = applyProfileDefaults(current, defaults);

  assert.deepEqual(result, {
    empty: "default empty",
    nil: "default nil",
    missing: "default missing",
    text: "member input",
    disabled: false,
    zero: 0,
  });
  assert.notEqual(result, current);
  assert.deepEqual(current, {
    empty: "",
    nil: null,
    missing: undefined,
    text: "member input",
    disabled: false,
    zero: 0,
  });
});

test.after(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
  if (originalSessionStorage) {
    Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  } else {
    Reflect.deleteProperty(globalThis, "sessionStorage");
  }
  globalThis.fetch = originalFetch;
});
