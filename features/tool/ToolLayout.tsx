import type { ReactNode } from "react";
import type { Tool } from "@/types/tool";
import { ToolHeader } from "./ToolHeader";
import { ToolContainer } from "./ToolContainer";
import { ToolSidebar } from "./ToolSidebar";
import { FAQSection } from "./FAQSection";
import { FinancialDisclaimer } from "./FinancialDisclaimer";

interface ToolLayoutProps {
  tool: Tool;
  children: ReactNode;
}

export function ToolLayout({ tool, children }: ToolLayoutProps) {
  const isCalculator = tool.category === "calculator";

  return (
    <div className="container-page section-gap">
      <ToolHeader tool={tool} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <main className="flex flex-col gap-8">
          <ToolContainer>{children}</ToolContainer>
          {isCalculator && <FinancialDisclaimer />}
          {tool.faq && tool.faq.length > 0 && <FAQSection items={tool.faq} />}
        </main>

        <ToolSidebar tool={tool} />
      </div>
    </div>
  );
}
