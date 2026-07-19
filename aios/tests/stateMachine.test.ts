import { describe, it, expect } from "vitest";
import {
  TASK_STATES,
  LEGAL_TRANSITIONS,
  canTransition,
  assertTransition,
  isTerminal,
  IllegalTransitionError,
} from "../src/stateMachine";
import type { TaskState } from "../src/types";

describe("state machine (StateMachine.md)", () => {
  it("defines all 14 states", () => {
    expect(TASK_STATES).toHaveLength(14);
  });

  it("allows the documented legal transitions", () => {
    expect(canTransition("Created", "Queued")).toBe(true);
    expect(canTransition("Queued", "Executing")).toBe(true);
    expect(canTransition("Executing", "Completed")).toBe(true);
    expect(canTransition("Executing", "Review")).toBe(true);
    expect(canTransition("Review", "Approved")).toBe(true);
    expect(canTransition("Approved", "Completed")).toBe(true);
    expect(canTransition("Executing", "Retry")).toBe(true);
    expect(canTransition("Retry", "Queued")).toBe(true);
    expect(canTransition("Completed", "Archived")).toBe(true);
  });

  it("forbids illegal transitions (terminal is terminal; no skipping)", () => {
    expect(canTransition("Completed", "Executing")).toBe(false);
    expect(canTransition("Failed", "Queued")).toBe(false);
    expect(canTransition("Archived", "Executing")).toBe(false);
    expect(canTransition("Created", "Completed")).toBe(false); // can't complete without executing
    expect(canTransition("Review", "Completed")).toBe(false); // must be decided (Approved/Rejected)
    expect(canTransition("Waiting", "Executing")).toBe(false); // must pass through Queued
  });

  it("throws on an illegal transition", () => {
    expect(() => assertTransition("Completed", "Executing")).toThrow(IllegalTransitionError);
  });

  it("marks the terminal states", () => {
    expect(isTerminal("Completed")).toBe(true);
    expect(isTerminal("Failed")).toBe(true);
    expect(isTerminal("Cancelled")).toBe(true);
    expect(isTerminal("Archived")).toBe(true);
    expect(isTerminal("Executing")).toBe(false);
  });

  it("every legal target is itself a known state (no dangling transitions)", () => {
    for (const from of TASK_STATES) {
      for (const to of LEGAL_TRANSITIONS[from]) {
        expect(TASK_STATES).toContain(to as TaskState);
      }
    }
  });
});
