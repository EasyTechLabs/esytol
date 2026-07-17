import type { ReactNode } from "react";
import type { Tool } from "@/types/tool";
import { ToolHeader } from "./ToolHeader";
import { ToolContainer } from "./ToolContainer";
import { ToolSidebar } from "./ToolSidebar";
import { FAQSection } from "./FAQSection";
import { CalculatorTrust } from "./CalculatorTrust";
import { DeveloperTrust } from "./DeveloperTrust";
import { RecentToolTracker } from "./RecentToolTracker";
import { ToolIntelligence } from "./ToolIntelligence";
import { domainForTool } from "@/registry/domains";

interface ToolLayoutProps {
  tool: Tool;
  children: ReactNode;
}

export function ToolLayout({ tool, children }: ToolLayoutProps) {
  // `category === "calculator"` gates the finance E-E-A-T surface (unchanged).
  // Developer tools carry their own category (developer/encoder/…) and get the
  // developer trust surface instead — one additive branch, no fork.
  const isCalculator = tool.category === "calculator";
  const isDeveloper = domainForTool(tool)?.slug === "developer";

  return (
    <div className="container-page section-gap">
      <RecentToolTracker slug={tool.slug} name={tool.name} />
      <ToolHeader tool={tool} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <main className="flex flex-col gap-8">
          <ToolContainer>{children}</ToolContainer>
          {isCalculator && <ToolIntelligence slug={tool.slug} />}
          {isCalculator && <CalculatorTrust tool={tool} />}
          {isDeveloper && <DeveloperTrust tool={tool} />}
          {tool.faq && tool.faq.length > 0 && <FAQSection items={tool.faq} />}
        </main>

        <ToolSidebar tool={tool} />
      </div>
    </div>
  );
}
