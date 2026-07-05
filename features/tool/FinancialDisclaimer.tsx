/**
 * Shared financial disclaimer shown on every finance calculator.
 * Rendered once by ToolLayout for tools in the "calculator" category, so the
 * copy is never duplicated across individual calculators.
 */
export function FinancialDisclaimer() {
  return (
    <aside
      role="note"
      aria-label="Financial disclaimer"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <p className="text-xs leading-relaxed text-amber-800">
        <span className="font-semibold">Disclaimer:</span> This calculator provides estimates for
        educational purposes only. Actual figures may vary depending on lender policies, taxes, fees
        and regulatory changes.
      </p>
    </aside>
  );
}
