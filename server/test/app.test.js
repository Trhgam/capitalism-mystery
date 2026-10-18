import { describe, expect, it } from "vitest";
import { healthStatus } from "../src/app.js";

describe("HTTP app", () => {
  it("returns the health response payload", () => {
    expect(healthStatus()).toEqual({ ok: true, service: "capitalism-mystery" });
  });
});
