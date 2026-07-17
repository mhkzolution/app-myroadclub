import assert from "node:assert/strict";
import test from "node:test";

import { clearAuthTokens, getAuthToken, logout } from "./auth.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
let href = "/current";
const location = {
  get href() {
    return href;
  },
  set href(value: string) {
    href = value;
  },
};

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage,
    sessionStorage,
    location,
  },
});
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: sessionStorage,
});

test("getAuthToken prefers localStorage then sessionStorage", () => {
  localStorage.clear();
  sessionStorage.clear();

  assert.equal(getAuthToken(), null);

  sessionStorage.setItem("wp_token", "session-token");
  assert.equal(getAuthToken(), "session-token");

  localStorage.setItem("wp_token", "local-token");
  assert.equal(getAuthToken(), "local-token");
});

test("clearAuthTokens removes wp_token from localStorage and sessionStorage", () => {
  localStorage.setItem("wp_token", "local-token");
  sessionStorage.setItem("wp_token", "session-token");

  clearAuthTokens();

  assert.equal(localStorage.getItem("wp_token"), null);
  assert.equal(sessionStorage.getItem("wp_token"), null);
});

test("logout clears both storages and navigates to login", () => {
  localStorage.setItem("wp_token", "local-token");
  sessionStorage.setItem("wp_token", "session-token");
  href = "/account";

  logout();

  assert.equal(localStorage.getItem("wp_token"), null);
  assert.equal(sessionStorage.getItem("wp_token"), null);
  assert.equal(href, "/login");
});
