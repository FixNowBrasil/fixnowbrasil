import { test, expect } from "@playwright/test";
import { REQUEST_STATUS_TRANSITIONS, canTransitionRequestStatus, getNextRequestStatuses } from "../../src/lib/request-lifecycle";

test.describe("FixNow request lifecycle", () => {
  test("allows only the intended forward transitions", () => {
    expect(canTransitionRequestStatus("sent", "analyzing")).toBe(true);
    expect(canTransitionRequestStatus("analyzing", "confirmed")).toBe(true);
    expect(canTransitionRequestStatus("confirmed", "on_the_way")).toBe(true);
    expect(canTransitionRequestStatus("on_the_way", "in_progress")).toBe(true);
    expect(canTransitionRequestStatus("in_progress", "completed")).toBe(true);
    expect(canTransitionRequestStatus("completed", "rated")).toBe(true);
  });

  test("rejects invalid lifecycle jumps", () => {
    expect(canTransitionRequestStatus("sent", "completed")).toBe(false);
    expect(canTransitionRequestStatus("sent", "confirmed")).toBe(false);
    expect(canTransitionRequestStatus("completed", "analyzing")).toBe(false);
    expect(canTransitionRequestStatus("rated", "completed")).toBe(false);
    expect(canTransitionRequestStatus("cancelled", "sent")).toBe(false);
  });

  test("keeps cancellation limited to pre-execution states", () => {
    expect(getNextRequestStatuses("sent")).toContain("cancelled");
    expect(getNextRequestStatuses("analyzing")).toContain("cancelled");
    expect(getNextRequestStatuses("confirmed")).toContain("cancelled");
    expect(getNextRequestStatuses("on_the_way")).not.toContain("cancelled");
    expect(getNextRequestStatuses("in_progress")).not.toContain("cancelled");
    expect(getNextRequestStatuses("completed")).not.toContain("cancelled");
  });

  test("has no accidental transitions out of terminal states", () => {
    expect(REQUEST_STATUS_TRANSITIONS.rated).toEqual([]);
    expect(REQUEST_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });
});
