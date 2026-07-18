import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { ApiPlayground } from "@/features/dev-api/ApiPlayground";

export const metadata: Metadata = buildMetadata({
  title: "Income Tax API — Developer Documentation",
  description:
    "A deterministic Indian income-tax computation API (Old vs New regime, multi-year, fully explainable). Try it live, read the OpenAPI 3.1 spec, and integrate in minutes. No signup.",
  path: "/developers/income-tax-api",
});

const JS_EXAMPLE = `const res = await fetch("https://www.esytol.com/api/v1/income-tax/calculate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    assessmentYear: "2026-27",
    income: { salary: 1800000 },
  }),
});
const data = await res.json();
console.log(data.result.recommended, data.result[data.result.recommended].totalTax);`;

const PY_EXAMPLE = `import requests

res = requests.post(
    "https://www.esytol.com/api/v1/income-tax/calculate",
    json={"assessmentYear": "2026-27", "income": {"salary": 1800000}},
)
data = res.json()
print(data["result"]["recommended"], data["result"]["new"]["totalTax"])`;

const JAVA_EXAMPLE = `HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://www.esytol.com/api/v1/income-tax/calculate"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\\"assessmentYear\\":\\"2026-27\\",\\"income\\":{\\"salary\\":1800000}}"))
    .build();
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`;

export default function IncomeTaxApiPage() {
  return (
    <div className="container-page section-gap">
      <header className="max-w-3xl">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Developer API · v1
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Income Tax API</h1>
        <p className="mt-3 text-gray-600">
          Compute Indian personal income tax (Old vs New regime) for a selectable assessment year —
          deterministic, provably-attributed, and fully explainable with a §-level computation
          trace. No account, no data stored, identical requests return identical results.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a
            href="/api/v1/openapi.json"
            className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            OpenAPI 3.1 spec ↗
          </a>
          <a
            href="/api/v1/version"
            className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            /version ↗
          </a>
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-600">
            AY 2024-25 · 2025-26 · 2026-27
          </span>
        </div>
      </header>

      {/* Quick start */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Quick start</h2>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-gray-700">
          <li>No signup or key required — the API is public.</li>
          <li>
            <code>POST /api/v1/income-tax/calculate</code> with a JSON body containing your income.
          </li>
          <li>
            Read <code>result.recommended</code> and each regime&rsquo;s <code>totalTax</code>.
          </li>
          <li>The full request/response schema lives in the OpenAPI spec above.</li>
        </ol>
      </section>

      {/* Interactive playground */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Try it live</h2>
        <p className="mt-1 text-sm text-gray-500">
          Executes a real request against the production API. Import the OpenAPI spec into Swagger
          UI, Postman, or Insomnia for the full interface.
        </p>
        <div className="mt-4">
          <ApiPlayground />
        </div>
      </section>

      {/* Endpoints */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Endpoints</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Path</th>
                <th className="py-2">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <Row m="POST" p="/api/v1/income-tax/calculate" d="Compute tax (both regimes)" />
              <Row m="GET" p="/api/v1/health" d="Liveness probe" />
              <Row m="GET" p="/api/v1/ready" d="Readiness probe" />
              <Row m="GET" p="/api/v1/version" d="Engine + API version, supported years" />
              <Row m="GET" p="/api/v1/openapi.json" d="OpenAPI 3.1 document" />
            </tbody>
          </table>
        </div>
      </section>

      {/* Code examples */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Examples</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Example title="JavaScript" code={JS_EXAMPLE} />
          <Example title="Python" code={PY_EXAMPLE} />
          <Example title="Java" code={JAVA_EXAMPLE} />
        </div>
      </section>

      <p className="mt-10 max-w-3xl text-xs text-gray-500">
        Estimates for computation and integration; verify complex or high-value cases with a tax
        professional. The engine covers resident individuals below 60 and applies each year&rsquo;s
        Finance Act; it does not compute capital-gains special rates or firms/companies.
      </p>
    </div>
  );
}

function Row({ m, p, d }: { m: string; p: string; d: string }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-4 font-mono text-xs font-semibold text-brand-700">{m}</td>
      <td className="py-2 pr-4 font-mono text-xs">{p}</td>
      <td className="py-2">{d}</td>
    </tr>
  );
}

function Example({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
      <span className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">
        {title}
      </span>
      <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">{code}</pre>
    </div>
  );
}
