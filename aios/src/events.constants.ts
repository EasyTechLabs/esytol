/**
 * Canonical event types (AIOS-004) the Chief Orchestrator supports out of the box (EventBus.md).
 * These are DATA, not code branches — the orchestrator routes any event to workflows registered for
 * its type, so new event types are added by registering a workflow, with zero orchestrator change.
 */

export const AIOS_EVENTS = {
  ToolRequested: "ToolRequested",
  BugReported: "BugReported",
  ContentRequested: "ContentRequested",
  SEOAuditRequested: "SEOAuditRequested",
  VideoRequested: "VideoRequested",
  AnalyticsRequested: "AnalyticsRequested",
  ReleaseRequested: "ReleaseRequested",
  DailyMaintenance: "DailyMaintenance",
  WeeklyMaintenance: "WeeklyMaintenance",
  MonthlyMaintenance: "MonthlyMaintenance",
} as const;

export type AiosEventType = (typeof AIOS_EVENTS)[keyof typeof AIOS_EVENTS];
