import assert from "node:assert/strict";
import test from "node:test";

import {
  WordPressRequestError,
  getWordPressToken,
  submitRoadsideRequest,
  submitTicketRequest,
  type RoadsideRequestPayload,
  type TicketRequestPayload,
} from "./wp-requests";

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

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage, sessionStorage },
});
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: sessionStorage,
});

const ticket: TicketRequestPayload = {
  citationNumber: "C-123",
  violationDate: "2026-07-01",
  state: "CA",
  city: "Los Angeles",
  violationType: "Speeding",
  description: "Test",
  courtDate: "",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "555-0100",
  email: "ada@example.com",
};

const roadside: RoadsideRequestPayload = {
  serviceType: "towing",
  serviceDetails: "Vehicle stopped",
  customer: {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "555-0100",
    email: "ada@example.com",
    isMember: true,
    accountName: "Ada",
    membershipId: "M-1",
  },
  vehicle: {
    year: "2024",
    make: "Example",
    model: "One",
    color: "Blue",
    vin: "",
    plate: "",
    safeLocation: true,
  },
  serviceLocation: {
    address: "1 Main St",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    lat: 34,
    lng: -118,
  },
  dropOff: null,
  additional: { passengers: "1", driveType: "FWD", withVehicle: true },
};

function createdResponse() {
  return new Response(
    JSON.stringify({
      id: 12,
      reference: "RA-20260717-12",
      status: "pending",
      createdAt: "2026-07-17T00:00:00+00:00",
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}

test("reads local token before session token", () => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("wp_token", "session");
  assert.equal(getWordPressToken(), "session");
  localStorage.setItem("wp_token", "local");
  assert.equal(getWordPressToken(), "local");
});

test("missing token fails as auth without fetching", async () => {
  localStorage.clear();
  sessionStorage.clear();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return createdResponse();
  };

  await assert.rejects(
    submitRoadsideRequest(roadside),
    (error: unknown) => error instanceof WordPressRequestError && error.kind === "auth"
  );
  assert.equal(calls, 0);
});

test("ticket request uses multipart fields without setting content type", async () => {
  localStorage.setItem("wp_token", "token");
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return createdResponse();
  };

  const fileOne = new File(["one"], "one.png", { type: "image/png" });
  const fileTwo = new File(["two"], "two.pdf", { type: "application/pdf" });
  await submitTicketRequest(ticket, [fileOne, fileTwo]);

  assert.equal(
    request?.url,
    "https://myroadclub.com/wp-json/myroadclub/v1/ticket-requests"
  );
  assert.equal(new Headers(request?.init?.headers).get("Authorization"), "Bearer token");
  assert.equal(new Headers(request?.init?.headers).has("Content-Type"), false);
  const body = request?.init?.body as FormData;
  assert.deepEqual(JSON.parse(String(body.get("payload"))), ticket);
  assert.deepEqual(body.getAll("attachments[]"), [fileOne, fileTwo]);
});

test("roadside request sends JSON without mutating its payload", async () => {
  localStorage.setItem("wp_token", "token");
  const before = JSON.stringify(roadside);
  let request: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    request = init;
    return createdResponse();
  };

  const result = await submitRoadsideRequest(roadside);

  assert.equal(JSON.stringify(roadside), before);
  assert.equal(new Headers(request?.headers).get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(String(request?.body)), roadside);
  assert.equal(result.status, "pending");
});

test("translates status, network, and malformed success failures safely", async () => {
  localStorage.setItem("wp_token", "token");
  const cases: Array<[number, WordPressRequestError["kind"]]> = [
    [401, "auth"],
    [413, "size"],
    [422, "validation"],
    [500, "server"],
  ];

  for (const [status, kind] of cases) {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "private stack trace" }), { status });
    await assert.rejects(
      submitRoadsideRequest(roadside),
      (error: unknown) =>
        error instanceof WordPressRequestError &&
        error.kind === kind &&
        !error.message.includes("private stack trace")
    );
  }

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "mrc_validation_error",
        message: "First name is required.",
      }),
      { status: 422 }
    );
  await assert.rejects(
    submitRoadsideRequest(roadside),
    (error: unknown) =>
      error instanceof WordPressRequestError &&
      error.kind === "validation" &&
      error.message === "First name is required."
  );

  globalThis.fetch = async () => {
    throw new TypeError("private network detail");
  };
  await assert.rejects(
    submitRoadsideRequest(roadside),
    (error: unknown) =>
      error instanceof WordPressRequestError &&
      error.kind === "network" &&
      !error.message.includes("private network detail")
  );

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 1, status: "pending" }), { status: 201 });
  await assert.rejects(
    submitRoadsideRequest(roadside),
    (error: unknown) => error instanceof WordPressRequestError && error.kind === "server"
  );
});
