/**
 * Vyora — Merchant Insights (V1-005). Pure calculations only, no AI, no charts:
 * this-week cash movement (given / received / recovered / lost), customer leagues
 * (best/worst paying, most active, dormant), and portfolio averages (recovery time,
 * credit days, recovery %). One function, one source of truth.
 *
 * Definitions (kept honest and explainable):
 *  - Given / Received  = credit given / payments received THIS WEEK (Mon→today).
 *  - Recovered         = of this week's payments, the part that (FIFO) cleared a
 *                        credit that was already PAST its due date — money chased back.
 *  - Lost              = credit that fell past its due date THIS WEEK and is still
 *                        unpaid — receivable that slipped into overdue.
 *  - Recovery time     = average FIFO days a settled credit took to be paid.
 *  - Credit days       = average (due date − date) across dated credits.
 *  - Recovery %        = lifetime received ÷ given.
 * Everything is receivable-focused (customers: given/received); suppliers excluded.
 */

import type { VyoraData, Transaction, Payment } from "./types";
import { daysBetween } from "./aging";
import { rupees } from "./selectors";

export interface InsightRow {
  partyId: string;
  name: string;
  given: number;
  received: number;
  ratioPct: number; // received ÷ given, 0–100
  outstanding: number; // max(0, given − received)
  count: number; // total entries (credits + payments)
  daysSince: number | null; // days since last activity
}

export interface MerchantInsights {
  week: { given: number; received: number; recovered: number; lost: number };
  bestPaying: InsightRow[];
  worstPaying: InsightRow[];
  mostActive: InsightRow[];
  dormant: InsightRow[];
  avgRecoveryDays: number | null;
  avgCreditDays: number | null;
  recoveryPct: number | null;
}

const byDateThenId = <T extends { date: string; id: string }>(a: T, b: T) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function merchantInsights(data: VyoraData, today: string): MerchantInsights {
  const [ty, tm, td] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(ty!, tm! - 1, td!)).getUTCDay(); // 0 Sun … 6 Sat
  const weekStart = new Date(Date.UTC(ty!, tm! - 1, td! - ((dow + 6) % 7)))
    .toISOString()
    .slice(0, 10);
  const inWeek = (date: string) => date >= weekStart && date <= today;

  const givenByParty = new Map<string, Transaction[]>();
  const recvByParty = new Map<string, Payment[]>();
  const givenTotal = new Map<string, number>();
  const recvTotal = new Map<string, number>();
  const count = new Map<string, number>();
  const last = new Map<string, string>();
  const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
    const a = m.get(k);
    if (a) a.push(v);
    else m.set(k, [v]);
  };
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  const touch = (id: string, date: string) => {
    bump(count, id, 1);
    const l = last.get(id);
    if (!l || date > l) last.set(id, date);
  };

  let weekGiven = 0;
  let weekReceived = 0;
  let sumGiven = 0;
  let sumReceived = 0;
  let creditDaysSum = 0;
  let creditDaysCount = 0;

  for (const t of data.transactions) {
    touch(t.partyId, t.date);
    if (t.kind !== "given") continue;
    push(givenByParty, t.partyId, t);
    bump(givenTotal, t.partyId, t.amount);
    sumGiven += t.amount;
    if (inWeek(t.date)) weekGiven += t.amount;
    if (t.dueDate) {
      creditDaysSum += daysBetween(t.date, t.dueDate);
      creditDaysCount += 1;
    }
  }
  for (const p of data.payments) {
    touch(p.partyId, p.date);
    if (p.kind !== "received") continue;
    push(recvByParty, p.partyId, p);
    bump(recvTotal, p.partyId, p.amount);
    sumReceived += p.amount;
    if (inWeek(p.date)) weekReceived += p.amount;
  }

  // FIFO with dates → recovered (overdue money collected this week), lost (slipped
  // to overdue this week), and settlement times (for average recovery time).
  let recovered = 0;
  let lost = 0;
  const settledDays: number[] = [];
  for (const [pid, creditsRaw] of givenByParty) {
    const credits = [...creditsRaw].sort(byDateThenId);
    const pays = [...(recvByParty.get(pid) ?? [])].sort(byDateThenId);
    let pIdx = 0;
    let payLeft = pays.length ? pays[0]!.amount : 0;
    for (const c of credits) {
      let need = c.amount;
      let lastPortionDate: string | null = null;
      while (need > 0 && pIdx < pays.length) {
        const take = Math.min(need, payLeft);
        const payDate = pays[pIdx]!.date;
        if (c.dueDate && payDate > c.dueDate && inWeek(payDate)) recovered += take;
        need -= take;
        payLeft -= take;
        lastPortionDate = payDate;
        if (payLeft <= 0) {
          pIdx += 1;
          payLeft = pIdx < pays.length ? pays[pIdx]!.amount : 0;
        }
      }
      if (need <= 0) {
        if (lastPortionDate) settledDays.push(Math.max(0, daysBetween(c.date, lastPortionDate)));
      } else if (c.dueDate && c.dueDate >= weekStart && c.dueDate < today) {
        lost += need; // fell overdue this week, still open
      }
    }
  }

  // Customer rows (customers = anyone extended credit).
  const rows: InsightRow[] = [];
  for (const p of data.parties) {
    const given = givenTotal.get(p.id) ?? 0;
    if (given <= 0) continue;
    const received = recvTotal.get(p.id) ?? 0;
    const l = last.get(p.id) ?? null;
    rows.push({
      partyId: p.id,
      name: p.name,
      given,
      received,
      ratioPct: Math.round(Math.min(1, received / given) * 100),
      outstanding: Math.max(0, given - received),
      count: count.get(p.id) ?? 0,
      daysSince: l ? daysBetween(l, today) : null,
    });
  }

  const bestPaying = [...rows]
    .filter((r) => r.received > 0)
    .sort((a, b) => b.ratioPct - a.ratioPct || b.received - a.received)
    .slice(0, 5);
  const worstPaying = [...rows]
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => a.ratioPct - b.ratioPct || b.outstanding - a.outstanding)
    .slice(0, 5);
  const mostActive = [...rows].sort((a, b) => b.count - a.count || b.given - a.given).slice(0, 5);
  const dormant = [...rows]
    .filter((r) => r.daysSince !== null && r.daysSince > 30)
    .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0))
    .slice(0, 5);

  return {
    week: {
      given: rupees(weekGiven),
      received: rupees(weekReceived),
      recovered: rupees(recovered),
      lost: rupees(lost),
    },
    bestPaying,
    worstPaying,
    mostActive,
    dormant,
    avgRecoveryDays: settledDays.length
      ? Math.round(settledDays.reduce((a, b) => a + b, 0) / settledDays.length)
      : null,
    avgCreditDays: creditDaysCount ? Math.round(creditDaysSum / creditDaysCount) : null,
    recoveryPct: sumGiven > 0 ? Math.round((sumReceived / sumGiven) * 100) : null,
  };
}
