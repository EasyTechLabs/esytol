/**
 * Approval gateways (AIOS-004) — realize the ApprovalMatrix.md decision boundary. A gateway decides an
 * approval request synchronously (auto), or returns null to PAUSE the task for an asynchronous human
 * decision delivered later via `ChiefOrchestrator.provideApproval`.
 */

import type { ApprovalDecision, ApprovalGateway, ApprovalRequest } from "./types";

/**
 * Default: everything requiring a human approval PAUSES (returns null). Tier-2/3 are Founder/VP gated
 * and never auto-approved — this is the safe default (ApprovalMatrix.md §1, §4).
 */
export class PendingApprovalGateway implements ApprovalGateway {
  decide(): ApprovalDecision | null {
    return null;
  }
}

/** Dev/test gateway that auto-approves (used to exercise the full happy path deterministically). */
export class AutoApproveGateway implements ApprovalGateway {
  constructor(private readonly approver = "auto") {}
  decide(request: ApprovalRequest): ApprovalDecision {
    return { taskId: request.taskId, decision: "approved", approver: this.approver };
  }
}

/** Dev/test gateway that auto-rejects (used to exercise the rejection + rollback path). */
export class AutoRejectGateway implements ApprovalGateway {
  constructor(
    private readonly approver = "auto",
    private readonly reason = "denied"
  ) {}
  decide(request: ApprovalRequest): ApprovalDecision {
    return {
      taskId: request.taskId,
      decision: "rejected",
      approver: this.approver,
      reason: this.reason,
    };
  }
}
