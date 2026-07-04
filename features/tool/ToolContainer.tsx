import type { ReactNode } from "react";

interface ToolContainerProps {
  children: ReactNode;
}

export function ToolContainer({ children }: ToolContainerProps) {
  return <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>;
}
