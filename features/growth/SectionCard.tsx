import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import type { ProviderStatus } from "@/lib/growth/types";

/** Section wrapper: anchor target, titled header with provider status + note. */
export function SectionCard({
  id,
  icon,
  title,
  status,
  note,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  status?: ProviderStatus;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xl leading-none" aria-hidden="true">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {status && <StatusBadge status={status} />}
      </div>
      {note && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

/** Sub-panel inside a section (titled white card). */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}
