# Income Tax API — Developer Guide

> **Purpose:** Get a developer from zero to a correct response in ten minutes. The public HTTP surface of the Income Tax Engine (EXPOSE-001).
> **Status:** Live · v1
> **Last Updated:** 2026-07-18
> **Interactive docs:** `/developers/income-tax-api` · **OpenAPI 3.1:** `/api/v1/openapi.json`

## Quick start (≤ 10 minutes)

1. **Clone & run** the repo: `npm install && npm run dev` (or use the live base URL
   `https://www.esytol.com`).
2. **Open the interactive docs:** `/developers/income-tax-api` — a live playground, or import
   `/api/v1/openapi.json` into Swagger UI / Postman / Insomnia.
3. **Call the API** (no signup, no key):

```bash
curl -X POST https://www.esytol.com/api/v1/income-tax/calculate \
  -H "Content-Type: application/json" \
  -d '{"assessmentYear":"2026-27","income":{"salary":1800000}}'
```

4. **Read the response:** `result.recommended` names the cheaper regime; each regime carries its
   `totalTax` and a §-level `trace`.

## Base URL & versioning

- **Base:** `/api/v1` (URL-versioned). Future versions coexist under `/api/v2`, `/api/v3`, … — v1
  never changes shape.
- **Content type:** `application/json`. **CORS:** open (`*`) — callable from browsers.

## Endpoints

| Method | Path                           | Purpose                                          |
| ------ | ------------------------------ | ------------------------------------------------ |
| `POST` | `/api/v1/income-tax/calculate` | Compute tax under both regimes                   |
| `GET`  | `/api/v1/health`               | Liveness (`{ "status": "ok" }`)                  |
| `GET`  | `/api/v1/ready`                | Readiness (engine computes)                      |
| `GET`  | `/api/v1/version`              | Engine + API version, supported assessment years |
| `GET`  | `/api/v1/openapi.json`         | The OpenAPI 3.1 document                         |

## Request

```jsonc
{
  "assessmentYear": "2026-27", // optional; one of 2024-25 | 2025-26 | 2026-27 (default current)
  "income": { "salary": 1800000, "other": 0 },
  "deductions": {
    // optional; OLD regime only
    "section80C": 150000,
    "section80D": 25000,
    "hraExemption": 0,
    "homeLoanInterest": 0,
    "professionalTax": 0,
    "other": 0,
  },
}
```

## Response (200)

```jsonc
{
  "success": true,
  "apiVersion": "1",
  "engineVersion": "2.0.0",
  "assessmentYear": "2026-27",
  "requestId": "…",
  "result": {
    "old":  { "taxableIncome": …, "totalTax": …, "trace": [ { "label": "…", "section": "§87A", "amount": … } ] },
    "new":  { "taxableIncome": …, "totalTax": …, "trace": [ … ] },
    "recommended": "new",
    "taxSaved": …,
    "attribution": { "engineVersion": "2.0.0", "assessmentYear": "2026-27",
                     "financialYear": "2025-26", "rulesetVersion": "AY2026-27.1",
                     "financeAct": "Finance Act, 2025", "computedAt": "…" }
  }
}
```

Both regimes are always returned — the value of the API is the Old-vs-New comparison.

## Errors (structured, never a stack trace)

| Status | When                | Body                                                   |
| ------ | ------------------- | ------------------------------------------------------ |
| `400`  | Malformed JSON      | `{ success:false, errors:[{code:"invalid_json", …}] }` |
| `422`  | Validation failure  | `{ success:false, errors:[{code, message, field}] }`   |
| `429`  | Rate limit exceeded | `{ success:false, errors:[{code:"rate_limited", …}] }` |

Every response includes an `X-Request-Id` header (echoed in `requestId`) for support and tracing.

## Rate limiting

A generous default public limit applies per client, surfaced via `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. There are no hardcoded business limits;
the ceiling is a single config value. (On serverless this is best-effort per-instance.)

## Authentication

**None required today** — a public compute API. The server ships an authentication _abstraction_
(API-key and bearer seams) so keys can be introduced later without changing the request shape or
breaking existing integrations.

## Examples

**JavaScript**

```js
const res = await fetch("https://www.esytol.com/api/v1/income-tax/calculate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ assessmentYear: "2026-27", income: { salary: 1800000 } }),
});
const data = await res.json();
console.log(data.result.recommended, data.result.new.totalTax);
```

**Python**

```python
import requests
data = requests.post(
    "https://www.esytol.com/api/v1/income-tax/calculate",
    json={"assessmentYear": "2026-27", "income": {"salary": 1800000}},
).json()
print(data["result"]["recommended"], data["result"]["new"]["totalTax"])
```

**Java**

```java
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://www.esytol.com/api/v1/income-tax/calculate"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\"assessmentYear\":\"2026-27\",\"income\":{\"salary\":1800000}}"))
    .build();
System.out.println(client.send(request, HttpResponse.BodyHandlers.ofString()).body());
```

## Guarantees

- **Deterministic:** identical request + assessment year → identical result.
- **Private:** no request body is stored or logged (the tax figures never leave the computation).
- **Explainable:** every result carries a cited, §-level computation trace.
- **Correct:** matches the ITD portal (statutory §288A/§288B rounding); verified by 45 engine +
  8 contract + 15 HTTP tests.

## Scope & disclaimer

Resident individuals below 60; applies each year's Finance Act (2023/2024/2025). Does not compute
capital-gains special rates or firms/companies. Estimates for integration; verify complex cases
with a tax professional.
