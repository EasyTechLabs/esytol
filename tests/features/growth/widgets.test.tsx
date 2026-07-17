import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "@/features/growth/StatusBadge";
import { StatCard } from "@/features/growth/StatCard";
import { BarList } from "@/features/growth/BarList";
import { DataTable, type Column } from "@/features/growth/DataTable";
import { InsightCard } from "@/features/growth/InsightCard";
import { Sparkline } from "@/features/growth/Sparkline";
import type { Insight } from "@/lib/growth/types";

describe("growth widgets", () => {
  it("StatusBadge renders the label for each status", () => {
    render(<StatusBadge status="unconfigured" />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("StatCard shows value, hint and a positive delta", () => {
    render(<StatCard label="Users" value="12.3K" hint="last 28d" delta={5.2} trend={[1, 2, 3]} />);
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("12.3K")).toBeInTheDocument();
    expect(screen.getByText(/5.2%/)).toBeInTheDocument();
    expect(screen.getByText("last 28d")).toBeInTheDocument();
  });

  it("BarList renders each datum and an empty state", () => {
    const { rerender } = render(
      <BarList
        items={[
          { label: "Organic", value: 100 },
          { label: "Direct", value: 50 },
        ]}
      />
    );
    expect(screen.getByText("Organic")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
    rerender(<BarList items={[]} emptyLabel="Nothing" />);
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });

  it("DataTable renders columns and rows", () => {
    interface Row {
      name: string;
      n: number;
    }
    const cols: Column<Row>[] = [
      { key: "name", label: "Name", render: (r) => r.name },
      { key: "n", label: "Count", align: "right", render: (r) => r.n },
    ];
    render(<DataTable columns={cols} rows={[{ name: "alpha", n: 1 }]} getRowKey={(r) => r.name} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("InsightCard renders the title, description and items", () => {
    const insight: Insight = {
      id: "x",
      severity: "opportunity",
      title: "High impressions, low CTR",
      description: "Rewrite titles.",
      items: [{ label: "/tools/emi-calculator", detail: "5,000 impressions" }],
    };
    render(<InsightCard insight={insight} />);
    expect(screen.getByRole("heading", { name: /high impressions, low ctr/i })).toBeInTheDocument();
    expect(screen.getByText("/tools/emi-calculator")).toBeInTheDocument();
    expect(screen.getByText("Opportunity")).toBeInTheDocument();
  });

  it("Sparkline renders an SVG for >= 2 points and nothing for fewer", () => {
    const { container, rerender } = render(<Sparkline values={[1, 2, 3, 2, 5]} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("path").length).toBe(2); // area + line
    rerender(<Sparkline values={[1]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
