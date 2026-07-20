// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { consumeLogoutReason, recordLogoutReason } from "./session-reliability";

describe("session reliability logout reasons", () => {
  beforeEach(() => window.localStorage.clear());

  it("records and consumes a logout reason once", () => {
    recordLogoutReason("session_expired");
    expect(consumeLogoutReason()).toBe("session_expired");
    expect(consumeLogoutReason()).toBeNull();
  });

  it("ignores malformed stored data", () => {
    window.localStorage.setItem("polygraph:last-logout-reason", "not-json");
    expect(consumeLogoutReason()).toBeNull();
  });
});
