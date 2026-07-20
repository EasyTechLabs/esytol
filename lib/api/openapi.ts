/**
 * OpenAPI 3.1 specification for the Income Tax API — EXPOSE-001.
 *
 * Built from the engine's own version constants so it cannot drift from the
 * implementation. Served at GET /api/v1/openapi.json and consumable by any
 * standard Swagger UI, Postman, Insomnia, or code generator.
 */

import {
  ENGINE_VERSION,
  SUPPORTED_ASSESSMENT_YEARS,
  DEFAULT_ASSESSMENT_YEAR,
} from "@/lib/incomeTax";
import { API_VERSION } from "@/lib/incomeTaxApi";

export function buildOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Esytol Income Tax API",
      version: `${API_VERSION}.0.0`,
      description:
        "Compute Indian personal income tax (Old vs New regime) for a selectable assessment year. " +
        "Deterministic, provably-attributed, and fully explainable (§-level computation trace). " +
        "No data is stored; identical requests return identical results. " +
        `Engine v${ENGINE_VERSION}. Supported assessment years: ${SUPPORTED_ASSESSMENT_YEARS.join(", ")}.`,
      contact: { name: "EasyTechLabs", url: "https://www.esytol.com" },
      license: { name: "Proprietary" },
    },
    servers: [{ url: "https://www.esytol.com/api/v1", description: "Production v1" }],
    tags: [
      { name: "Income Tax", description: "Tax computation" },
      { name: "Operational", description: "Health, readiness, and version" },
    ],
    paths: {
      "/income-tax/calculate": {
        post: {
          tags: ["Income Tax"],
          summary: "Compute income tax (both regimes)",
          description:
            "Computes tax under both the Old and New regimes and recommends the cheaper one. " +
            "Deductions apply to the Old regime only. Returns a §-level computation trace and an attribution stamp.",
          operationId: "calculateIncomeTax",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TaxRequest" },
                examples: {
                  salaried: {
                    summary: "Salaried, new regime default year",
                    value: { assessmentYear: DEFAULT_ASSESSMENT_YEAR, income: { salary: 1800000 } },
                  },
                  withDeductions: {
                    summary: "Old-regime deductions",
                    value: {
                      assessmentYear: DEFAULT_ASSESSMENT_YEAR,
                      income: { salary: 1500000, other: 50000 },
                      deductions: { section80C: 150000, section80D: 25000 },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Computed tax for both regimes",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TaxResponse" } },
              },
            },
            "422": {
              description: "Validation error (structured, never a stack trace)",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            "400": {
              description: "Malformed JSON body",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            "429": {
              description: "Rate limit exceeded",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/health": {
        get: {
          tags: ["Operational"],
          summary: "Liveness probe",
          operationId: "health",
          responses: { "200": { description: "The service is alive" } },
        },
      },
      "/ready": {
        get: {
          tags: ["Operational"],
          summary: "Readiness probe",
          operationId: "ready",
          responses: {
            "200": { description: "Ready to serve" },
            "503": { description: "Not ready" },
          },
        },
      },
      "/version": {
        get: {
          tags: ["Operational"],
          summary: "Engine + API version and supported years",
          operationId: "version",
          responses: { "200": { description: "Version metadata" } },
        },
      },
      "/usage": {
        get: {
          tags: ["Operational"],
          summary: "Your current-month usage for the resolved plan",
          description:
            "Returns the caller's real usage this month for their plan (anonymous → Free tier). " +
            "Marketplace customers should read RapidAPI for authoritative, global usage + billing.",
          operationId: "usage",
          responses: {
            "200": { description: "Usage snapshot (plan, used, included, remaining, overage)" },
            "401": { description: "Invalid X-Api-Key" },
            "403": { description: "Invalid RapidAPI proxy secret" },
          },
        },
      },
    },
    components: {
      // Defined for forward compatibility; NOT required today (public API).
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "X-Api-Key" },
        BearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        TaxRequest: {
          type: "object",
          required: ["income"],
          properties: {
            assessmentYear: {
              type: "string",
              enum: SUPPORTED_ASSESSMENT_YEARS,
              default: DEFAULT_ASSESSMENT_YEAR,
              description: "Which year's law to apply. Defaults to the current AY.",
            },
            income: {
              type: "object",
              required: ["salary"],
              properties: {
                salary: { type: "number", minimum: 0, description: "Annual salary income (₹)." },
                other: { type: "number", minimum: 0, default: 0, description: "Other income (₹)." },
              },
            },
            deductions: {
              type: "object",
              description: "Old-regime deductions; ignored by the New regime. All optional.",
              properties: {
                section80C: { type: "number", minimum: 0 },
                section80D: { type: "number", minimum: 0 },
                hraExemption: { type: "number", minimum: 0 },
                homeLoanInterest: { type: "number", minimum: 0 },
                professionalTax: { type: "number", minimum: 0 },
                other: { type: "number", minimum: 0 },
              },
            },
          },
        },
        TraceStep: {
          type: "object",
          properties: {
            label: { type: "string" },
            section: { type: ["string", "null"], description: "Statutory source (e.g. §87A)." },
            amount: { type: "number", description: "Signed rupee effect of this step." },
          },
        },
        RegimeResult: {
          type: "object",
          properties: {
            regime: { type: "string", enum: ["old", "new"] },
            grossIncome: { type: "number" },
            standardDeduction: { type: "number" },
            totalDeductions: { type: "number" },
            taxableIncome: { type: "number" },
            taxBeforeRebate: { type: "number" },
            rebate: { type: "number" },
            taxAfterRebate: { type: "number" },
            surcharge: { type: "number" },
            cess: { type: "number" },
            totalTax: { type: "number" },
            effectiveRate: { type: "number" },
            monthlyTax: { type: "number" },
            trace: { type: "array", items: { $ref: "#/components/schemas/TraceStep" } },
          },
        },
        Attribution: {
          type: "object",
          properties: {
            engineVersion: { type: "string" },
            assessmentYear: { type: "string" },
            financialYear: { type: "string" },
            rulesetVersion: { type: "string" },
            financeAct: { type: "string" },
            computedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        TaxResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", const: true },
            apiVersion: { type: "string" },
            engineVersion: { type: "string" },
            assessmentYear: { type: "string" },
            requestId: { type: "string" },
            result: {
              type: "object",
              properties: {
                old: { $ref: "#/components/schemas/RegimeResult" },
                new: { $ref: "#/components/schemas/RegimeResult" },
                recommended: { type: "string", enum: ["old", "new"] },
                taxSaved: { type: "number" },
                attribution: { $ref: "#/components/schemas/Attribution" },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            apiVersion: { type: "string" },
            requestId: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                  field: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    // No security required today. Schemes above are the forward-compatible seam.
    security: [],
  };
}
