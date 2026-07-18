import type { ReactNode } from "react";
import type { Tool } from "@/types/tool";
import { ToolHeader } from "./ToolHeader";
import { ToolContainer } from "./ToolContainer";
import { ToolSidebar } from "./ToolSidebar";
import { FAQSection } from "./FAQSection";
import { CalculatorTrust } from "./CalculatorTrust";
import { DeveloperTrust } from "./DeveloperTrust";
import { EverydayTrust } from "./EverydayTrust";
import { RecentToolTracker } from "./RecentToolTracker";
import { ToolIntelligence } from "./ToolIntelligence";
import { domainForTool } from "@/registry/domains";

interface ToolLayoutProps {
  tool: Tool;
  children: ReactNode;
}

export function ToolLayout({ tool, children }: ToolLayoutProps) {
  // Each domain gets its own trust surface. Finance keeps the E-E-A-T surface on
  // its `category: "calculator"` tools exactly as before; Developer and Everyday
  // get theirs by domain. Age is a calculator by format but an Everyday tool by
  // domain, so it is excluded from the finance surface — no Finance tool is ever
  // in the Everyday domain, so finance rendering is unchanged.
  const domain = domainForTool(tool)?.slug;
  const isEveryday = domain === "everyday";
  const isDeveloper = domain === "developer";
  const isFinanceCalculator = tool.category === "calculator" && !isEveryday;

  return (
    <div className="container-page section-gap">
      <RecentToolTracker slug={tool.slug} name={tool.name} />
      <ToolHeader tool={tool} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <main className="flex flex-col gap-8">
          <ToolContainer>{children}</ToolContainer>
          {isFinanceCalculator && <ToolIntelligence slug={tool.slug} />}
          {isFinanceCalculator && <CalculatorTrust tool={tool} />}
          {isDeveloper && <DeveloperTrust tool={tool} />}
          {isEveryday && <EverydayTrust tool={tool} />}
          {tool.faq && tool.faq.length > 0 && <FAQSection items={tool.faq} />}
        </main>

        <ToolSidebar tool={tool} />
      </div>
    </div>
  );
}
