import type { Tool } from "@/types/tool";
import { getMethodology } from "@/content/methodology";
import { ToolTrustBar } from "./ToolTrustBar";
import { MethodologySection } from "./MethodologySection";
import { FinancialDisclaimer } from "./FinancialDisclaimer";

/**
 * Composes the shared trust/E-E-A-T surface shown beneath every finance
 * calculator's results: the trust bar (last updated · reviewed · method ·
 * sources), the methodology section (formula · assumptions · limitations ·
 * official references), and the financial disclaimer.
 *
 * The trust bar and methodology render only when methodology data exists for
 * the tool; the disclaimer always renders for a calculator. Rendered once by
 * ToolLayout, so nothing is duplicated across calculators.
 */
export function CalculatorTrust({ tool }: { tool: Tool }) {
  const methodology = getMethodology(tool.slug);

  return (
    <div className="flex flex-col gap-6">
      {methodology && <ToolTrustBar tool={tool} methodology={methodology} />}
      {methodology && <MethodologySection methodology={methodology} />}
      <FinancialDisclaimer />
    </div>
  );
}
