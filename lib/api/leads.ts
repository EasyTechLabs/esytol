/**
 * Lead capture — Growth Sprint 002 (Conversion).
 *
 * A tiny, dependency-free seam for inbound sales / enterprise / API-key requests.
 * The default sink records the lead as a structured log line (captured by Vercel);
 * a real CRM / email adapter (e.g. a webhook, Resend, HubSpot) can be wired by
 * swapping `leadConfig.sink` — no route changes. This is the honest MVP: it
 * durably records intent to the logs; automated delivery is the swap-in.
 */

export type LeadType = "sales" | "enterprise" | "apikey";

export interface Lead {
  type: LeadType;
  name: string;
  email: string;
  company?: string;
  message?: string;
  /** Where the lead came from (page / CTA), for attribution. */
  source?: string;
}

export interface LeadReceipt {
  ok: boolean;
  leadId?: string;
  error?: { code: string; message: string; field?: string };
}

export interface LeadSink {
  record(lead: Lead, leadId: string): void;
}

/** Default: structured log. The lead is intentionally recorded (the user submitted it). */
export const loggingLeadSink: LeadSink = {
  record(lead, leadId) {
    console.log(
      JSON.stringify({
        level: "info",
        service: "esytol-leads",
        kind: "lead",
        leadId,
        type: lead.type,
        email: lead.email,
        company: lead.company ?? null,
        source: lead.source ?? null,
        hasMessage: Boolean(lead.message),
      })
    );
  },
};

export const leadConfig: { sink: LeadSink } = { sink: loggingLeadSink };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES: ReadonlySet<string> = new Set(["sales", "enterprise", "apikey"]);

/** Validate + record a lead. Never throws; returns a typed receipt. */
export function captureLead(input: Partial<Lead>, leadId: string): LeadReceipt {
  if (!input.type || !TYPES.has(input.type)) {
    return {
      ok: false,
      error: {
        code: "invalid_type",
        message: "type must be sales, enterprise, or apikey.",
        field: "type",
      },
    };
  }
  if (!input.name || input.name.trim().length === 0) {
    return {
      ok: false,
      error: { code: "missing_name", message: "name is required.", field: "name" },
    };
  }
  if (!input.email || !EMAIL_RE.test(input.email)) {
    return {
      ok: false,
      error: { code: "invalid_email", message: "A valid email is required.", field: "email" },
    };
  }
  const lead: Lead = {
    type: input.type,
    name: input.name.trim().slice(0, 200),
    email: input.email.trim().slice(0, 320),
    company: input.company?.trim().slice(0, 200) || undefined,
    message: input.message?.trim().slice(0, 4000) || undefined,
    source: input.source?.trim().slice(0, 200) || undefined,
  };
  leadConfig.sink.record(lead, leadId);
  return { ok: true, leadId };
}
