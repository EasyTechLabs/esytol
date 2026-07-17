"use client";

/**
 * Financial Roadmap — UI (PROJECT-002).
 *
 * Thin shell over lib/financialRoadmap.ts. All computation is the engine's;
 * everything runs in the browser and nothing is stored or transmitted —
 * consistent with the platform's privacy position.
 */

import { useEffect, useMemo, useState } from "react";
import {
  buildRoadmap,
  validateRoadmapInputs,
  formatINR,
  type PrimaryGoal,
  type RoadmapAction,
  type RoadmapInput,
} from "@/lib/financialRoadmap";
import { cn } from "@/lib/cn";
import { readStore, saveProfile } from "@/lib/localFinance";

const GOALS: { value: PrimaryGoal; label: string }[] = [
  { value: "stability", label: "Financial stability" },
  { value: "buy-house", label: "Buying a home" },
  { value: "children-education", label: "Children's education" },
  { value: "early-retirement", label: "Early retirement" },
  { value: "wealth", label: "Long-term wealth" },
];

const RISK_STYLE = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
} as const;

const STATUS_STYLE = {
  done: { icon: "✓", chip: "bg-green-100 text-green-700", line: "border-green-300" },
  pending: { icon: "•", chip: "bg-gray-100 text-gray-600", line: "border-gray-200" },
  "not-applicable": { icon: "—", chip: "bg-gray-50 text-gray-400", line: "border-gray-100" },
} as const;

export function FinancialRoadmap() {
  const [form, setForm] = useState({
    age: "30",
    monthlyIncome: "80000",
    hasPartner: false,
    dependants: "0",
    emergencyFund: "100000",
    monthlyExpenses: "45000",
    monthlyEmi: "0",
    highInterestDebt: "0",
    hasHealthInsurance: false,
    healthCoverLakh: "0",
    hasTermInsurance: false,
    termCoverLakh: "0",
    monthlyInvesting: "5000",
    retirementCorpus: "200000",
    primaryGoal: "stability" as PrimaryGoal,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Returning visitors pick up where they left off — locally, from this browser
  // only (PROJECT-003). Runs once, before any save can fire.
  useEffect(() => {
    const saved = readStore().profile;
    if (saved) {
      setForm({
        age: String(saved.age),
        monthlyIncome: String(saved.monthlyIncome),
        hasPartner: saved.hasPartner,
        dependants: String(saved.dependants),
        emergencyFund: String(saved.emergencyFund),
        monthlyExpenses: String(saved.monthlyExpenses),
        monthlyEmi: String(saved.monthlyEmi),
        highInterestDebt: String(saved.highInterestDebt),
        hasHealthInsurance: saved.hasHealthInsurance,
        healthCoverLakh: String(saved.healthCoverLakh),
        hasTermInsurance: saved.hasTermInsurance,
        termCoverLakh: String(saved.termCoverLakh),
        monthlyInvesting: String(saved.monthlyInvesting),
        retirementCorpus: String(saved.retirementCorpus),
        primaryGoal: saved.primaryGoal,
      });
    }
    setHydrated(true);
  }, []);

  const input: RoadmapInput = useMemo(
    () => ({
      age: parseInt(form.age, 10) || 0,
      monthlyIncome: parseFloat(form.monthlyIncome) || 0,
      hasPartner: form.hasPartner,
      dependants: parseInt(form.dependants, 10) || 0,
      emergencyFund: parseFloat(form.emergencyFund) || 0,
      monthlyExpenses: parseFloat(form.monthlyExpenses) || 0,
      monthlyEmi: parseFloat(form.monthlyEmi) || 0,
      highInterestDebt: parseFloat(form.highInterestDebt) || 0,
      hasHealthInsurance: form.hasHealthInsurance,
      healthCoverLakh: parseFloat(form.healthCoverLakh) || 0,
      hasTermInsurance: form.hasTermInsurance,
      termCoverLakh: parseFloat(form.termCoverLakh) || 0,
      monthlyInvesting: parseFloat(form.monthlyInvesting) || 0,
      retirementCorpus: parseFloat(form.retirementCorpus) || 0,
      primaryGoal: form.primaryGoal,
    }),
    [form]
  );

  const errors = useMemo(() => validateRoadmapInputs(input), [input]);
  const isValid = Object.keys(errors).length === 0;
  const result = useMemo(() => (isValid ? buildRoadmap(input) : null), [isValid, input]);

  // Valid inputs persist locally (debounced), feeding the personal dashboard.
  useEffect(() => {
    if (!hydrated || !isValid) return;
    const t = setTimeout(() => saveProfile(input), 400);
    return () => clearTimeout(t);
  }, [hydrated, isValid, input]);

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ─────────────────────────────────────────────────────── */}
      <section aria-label="Your details" className="grid gap-6 lg:grid-cols-3">
        <Fieldset legend="You">
          <Num label="Age" value={form.age} onChange={set("age")} error={errors.age} />
          <Toggle label="Partner" checked={form.hasPartner} onChange={set("hasPartner")} />
          <Num
            label="Dependants"
            value={form.dependants}
            onChange={set("dependants")}
            error={errors.dependants}
          />
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Primary goal</span>
            <select
              value={form.primaryGoal}
              onChange={(e) => set("primaryGoal")(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </Fieldset>

        <Fieldset legend="Money in and out (monthly, ₹)">
          <Num
            label="Take-home income"
            value={form.monthlyIncome}
            onChange={set("monthlyIncome")}
            error={errors.monthlyIncome}
          />
          <Num
            label="Expenses"
            value={form.monthlyExpenses}
            onChange={set("monthlyExpenses")}
            error={errors.monthlyExpenses}
          />
          <Num
            label="Loan EMIs"
            value={form.monthlyEmi}
            onChange={set("monthlyEmi")}
            error={errors.monthlyEmi}
          />
          <Num
            label="Investing (SIPs etc.)"
            value={form.monthlyInvesting}
            onChange={set("monthlyInvesting")}
            error={errors.monthlyInvesting}
          />
        </Fieldset>

        <Fieldset legend="What you have (₹)">
          <Num
            label="Emergency fund (liquid)"
            value={form.emergencyFund}
            onChange={set("emergencyFund")}
            error={errors.emergencyFund}
          />
          <Num
            label="High-interest debt (>12%)"
            value={form.highInterestDebt}
            onChange={set("highInterestDebt")}
            error={errors.highInterestDebt}
          />
          <Num
            label="Retirement corpus (EPF+PPF+NPS)"
            value={form.retirementCorpus}
            onChange={set("retirementCorpus")}
            error={errors.retirementCorpus}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Toggle
                label="Health insurance"
                checked={form.hasHealthInsurance}
                onChange={set("hasHealthInsurance")}
              />
              {form.hasHealthInsurance && (
                <Num
                  label="Cover (₹ lakh)"
                  value={form.healthCoverLakh}
                  onChange={set("healthCoverLakh")}
                  error={errors.healthCoverLakh}
                />
              )}
            </div>
            <div>
              <Toggle
                label="Term life"
                checked={form.hasTermInsurance}
                onChange={set("hasTermInsurance")}
              />
              {form.hasTermInsurance && (
                <Num
                  label="Cover (₹ lakh)"
                  value={form.termCoverLakh}
                  onChange={set("termCoverLakh")}
                  error={errors.termCoverLakh}
                />
              )}
            </div>
          </div>
        </Fieldset>
      </section>

      {!result ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Fix the highlighted inputs to see your roadmap.
        </p>
      ) : (
        <>
          {/* ── Score + progress ─────────────────────────────────────── */}
          <section
            aria-label="Your financial health"
            className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-3"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Health score
              </p>
              <p className="mt-1 text-4xl font-extrabold text-gray-900">
                {result.healthScore}
                <span className="text-lg font-medium text-gray-400">/100</span>
              </p>
              <span
                className={cn(
                  "mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
                  RISK_STYLE[result.riskLevel]
                )}
              >
                {result.riskLevel} risk
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Progress
              </p>
              <p className="mt-1 text-4xl font-extrabold text-gray-900">
                {result.completionPct}
                <span className="text-lg font-medium text-gray-400">%</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {result.completedCount} of {result.applicableCount} steps complete
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all"
                  style={{ width: `${result.completionPct}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Time to complete pending steps
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{result.estimatedTimeline}</p>
              <p className="mt-1 text-xs text-gray-500">
                Effort estimate for the actions — not a market projection.
              </p>
            </div>
          </section>

          {/* ── Pillars ───────────────────────────────────────────────── */}
          <section aria-label="Score breakdown" className="grid gap-3 sm:grid-cols-5">
            {result.pillars.map((p) => (
              <div key={p.key} className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-medium text-gray-500">{p.label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {Math.round(p.score * p.weight)}
                  <span className="text-xs font-normal text-gray-400">/{p.weight}</span>
                </p>
                <p className="mt-1 text-[11px] leading-tight text-gray-500">{p.detail}</p>
              </div>
            ))}
          </section>

          {/* ── The roadmap timeline ─────────────────────────────────── */}
          <section aria-label="Your action plan">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Your roadmap</h2>
            <ol className="space-y-3">
              {result.actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  isCurrent={action.id === result.currentActionId}
                  expanded={expanded === action.id}
                  onToggle={() => setExpanded(expanded === action.id ? null : action.id)}
                />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function ActionCard({
  action,
  isCurrent,
  expanded,
  onToggle,
}: {
  action: RoadmapAction;
  isCurrent: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = STATUS_STYLE[action.status];
  return (
    <li
      className={cn(
        "rounded-xl border bg-white",
        isCurrent ? "border-brand-400 ring-1 ring-brand-200" : style.line
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            style.chip
          )}
          aria-hidden="true"
        >
          {action.status === "done" ? "✓" : action.step}
        </span>
        <span className="flex-1">
          <span
            className={cn(
              "block text-sm font-semibold",
              action.status === "not-applicable" ? "text-gray-400" : "text-gray-900"
            )}
          >
            {action.title}
          </span>
          <span className="text-xs text-gray-500">
            {action.status === "done" && "Done"}
            {action.status === "pending" &&
              (isCurrent ? "← Start here" : `Effort: ${action.effortWindow}`)}
            {action.status === "not-applicable" && "Not applicable to you"}
          </span>
        </span>
        {action.gapAmount !== undefined && action.status === "pending" && (
          <span className="hidden text-xs font-medium text-gray-500 sm:block">
            gap {formatINR(action.gapAmount)}
          </span>
        )}
        <span className="text-gray-400" aria-hidden="true">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 text-sm">
          {action.status === "not-applicable" && action.notApplicableReason ? (
            <p className="text-gray-500">{action.notApplicableReason}</p>
          ) : (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Why it matters
                </dt>
                <dd className="mt-1 text-gray-700">{action.whyItMatters}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Expected benefit
                </dt>
                <dd className="mt-1 text-gray-700">{action.expectedBenefit}</dd>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                <span>
                  Effort: <strong className="text-gray-700">{action.effortWindow}</strong>
                </span>
                {action.dependencies.length > 0 && (
                  <span>After: {action.dependencies.join(", ").replace(/-/g, " ")}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {action.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    {link.label} →
                  </a>
                ))}
              </div>
            </dl>
          )}
        </div>
      )}
    </li>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Num({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
          error ? "border-red-400 bg-red-50" : "border-gray-300"
        )}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-brand-600"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
