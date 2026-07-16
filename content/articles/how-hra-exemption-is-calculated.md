---
title: "How HRA Exemption is Calculated (Step by Step, With Examples)"
metaTitle: "How HRA Exemption is Calculated — Step by Step | Esytol"
metaDescription: "Learn exactly how HRA exemption is calculated under Rule 2A: the three-rule test, worked examples for metro and non-metro cities, edge cases, and a free calculator."
slug: "how-hra-exemption-is-calculated"
category: "income-tax"
tags: ["hra exemption calculation", "rule 2a", "section 10(13a)", "income tax", "hra calculator"]
lastUpdated: "2026-07-06"
reviewedBy: "EasyTechLabs Finance Team"
---

# How HRA Exemption is Calculated

The House Rent Allowance exemption is decided by a single, precise rule — yet it trips up more taxpayers than almost any other salary item. The reason is that the exemption is not a flat percentage; it is the **least of three different amounts**, and which amount "wins" changes with your rent, your salary structure, and your city.

This guide walks through the calculation step by step, with worked examples you can follow, the edge cases that catch people out, and a way to get your exact figure instantly. If you would rather skip the arithmetic, the [HRA Calculator](/tools/hra-calculator) applies every rule below automatically and shows you which one determines your exemption.

New to HRA altogether? [What is HRA?](/learn/what-is-hra) covers what the allowance is, who can claim it, and the regime rule that decides whether you can claim it at all — worth reading first, because the exemption is worth nothing under the New Regime.

## The legal basis: Section 10(13A) and Rule 2A

The HRA exemption comes from **Section 10(13A)** of the Income-tax Act, 1961, and the actual computation is laid down in **Rule 2A** of the Income-tax Rules, 1962. Rule 2A states that the exemption is the **least** of three amounts. Everything in this article flows from that single principle.

## The three-rule test

Your HRA exemption is the smallest of these three figures:

1. **Actual HRA received** — the HRA component your employer actually paid you.
2. **Rent paid minus 10% of salary** — your annual rent, reduced by 10% of your salary.
3. **50% or 40% of salary** — 50% of salary if you live in a metro city (Delhi, Mumbai, Kolkata, Chennai), otherwise 40%.

Whatever is the lowest of these three is exempt from tax. The balance of your HRA is taxable and added back to your income.

### What "salary" means here

Throughout the formula, _salary_ has a narrow meaning: **Basic Salary + Dearness Allowance (to the extent it forms part of retirement benefits) + commission at a fixed percentage of turnover.** For most salaried employees without DA or commission, salary is simply the Basic Salary. This is the figure you enter as **Basic Salary** in the calculator, and it drives Rules 2 and 3.

## Step-by-step calculation

Let us formalise the process into clear steps.

- **Step 1 — Gather your annual figures.** You need four numbers: your Basic Salary, the HRA you received, the rent you paid, and whether your city is metro or non-metro. Use annual amounts for consistency.
- **Step 2 — Compute Rule 1.** This is simply the actual HRA received. No calculation needed.
- **Step 3 — Compute Rule 2.** Take your annual rent and subtract 10% of your Basic Salary. If the result is negative (rent below 10% of Basic), treat it as zero.
- **Step 4 — Compute Rule 3.** Multiply your Basic Salary by 50% (metro) or 40% (non-metro).
- **Step 5 — Take the least.** The smallest of the three is your HRA exemption.
- **Step 6 — Find the taxable HRA.** Subtract the exemption from the HRA received. That balance is taxable.

## Worked example 1: Metro city, full exemption

Rahul lives in **Delhi** (metro). His annual figures:

- Basic Salary: ₹8,00,000
- HRA received: ₹3,20,000
- Rent paid: ₹3,60,000

Applying the rules:

| Rule                    | Calculation         | Amount    |
| ----------------------- | ------------------- | --------- |
| 1. Actual HRA received  | —                   | ₹3,20,000 |
| 2. Rent − 10% of Basic  | ₹3,60,000 − ₹80,000 | ₹2,80,000 |
| 3. 50% of Basic (metro) | 50% × ₹8,00,000     | ₹4,00,000 |

The least is **₹2,80,000** (Rule 2). So Rahul's HRA exemption is ₹2,80,000, and his taxable HRA is ₹3,20,000 − ₹2,80,000 = **₹40,000**.

Notice that even though Rahul receives ₹3.2 lakh of HRA and lives in a metro, he cannot exempt all of it, because his rent is not high enough. Rule 2 is the binding constraint.

## Worked example 2: Non-metro city

Sneha lives in **Pune** (non-metro). Her annual figures:

- Basic Salary: ₹5,00,000
- HRA received: ₹2,00,000
- Rent paid: ₹1,80,000

| Rule                        | Calculation         | Amount    |
| --------------------------- | ------------------- | --------- |
| 1. Actual HRA received      | —                   | ₹2,00,000 |
| 2. Rent − 10% of Basic      | ₹1,80,000 − ₹50,000 | ₹1,30,000 |
| 3. 40% of Basic (non-metro) | 40% × ₹5,00,000     | ₹2,00,000 |

The least is **₹1,30,000** (Rule 2). Sneha's exemption is ₹1,30,000 and her taxable HRA is **₹70,000**.

Had Sneha lived in a metro, Rule 3 would have been 50% × ₹5,00,000 = ₹2,50,000, but Rule 2 (₹1,30,000) would still win. The city only matters when Rule 3 is the smallest.

## Worked example 3: When the city changes the answer

Consider someone with a high rent relative to salary:

- Basic Salary: ₹6,00,000
- HRA received: ₹3,00,000
- Rent paid: ₹4,20,000

| Rule                   | Metro           | Non-metro       |
| ---------------------- | --------------- | --------------- |
| 1. Actual HRA          | ₹3,00,000       | ₹3,00,000       |
| 2. Rent − 10% of Basic | ₹3,60,000       | ₹3,60,000       |
| 3. % of Basic          | ₹3,00,000 (50%) | ₹2,40,000 (40%) |

- **Metro:** least is ₹3,00,000 (Rules 1 and 3 tie) → exemption ₹3,00,000, taxable HRA nil.
- **Non-metro:** least is ₹2,40,000 (Rule 3) → exemption ₹2,40,000, taxable HRA ₹60,000.

Here the metro/non-metro classification directly changes the tax outcome by ₹60,000 of exemption. This is exactly the kind of comparison the [HRA Calculator](/tools/hra-calculator) makes effortless — flip the toggle and watch the winning rule change.

## Edge cases that catch people out

- **No rent paid.** If you pay no rent, Rule 2 becomes "0 − 10% of Basic", which is negative and floored at zero. The least of the three is therefore zero, and **no HRA is exempt.** Living rent-free forfeits the benefit entirely.
- **Rent below 10% of Basic.** If your rent is less than 10% of your Basic Salary, Rule 2 is again zero or negative, so your exemption is zero regardless of how much HRA you receive.
- **HRA not part of your salary.** If your employer does not pay a distinct HRA component, Section 10(13A) does not apply. You may instead look at Section 80GG.
- **Changing jobs, cities, or rent mid-year.** The formula assumes constant figures. If your salary, rent, or city changed during the year, the exemption must be computed **month by month** and summed. Our calculator uses annual figures for a clean estimate; for a mid-year change, run it separately for each period.
- **Rent over ₹1,00,000 a year.** You must report your landlord's PAN to claim the exemption. Keep it on file.

## Monthly vs annual figures

You can compute HRA on a monthly or an annual basis — the answer is the same as long as your figures are constant through the year. Working annually is simpler and less error-prone, which is why the [HRA Calculator](/tools/hra-calculator) uses annual inputs and then shows you the **monthly exemption** (annual ÷ 12) for convenience, so you can sanity-check it against your payslip.

## From HRA exemption to your actual tax saved

The HRA exemption reduces your **taxable income**, not your tax directly. The rupee value of the saving depends on your marginal tax slab. For example, an exemption of ₹2,00,000 saves:

- ₹40,000 if your marginal rate is 20%, or
- ₹60,000 if your marginal rate is 30%,

plus the 4% Health and Education Cess on top. Because HRA is an Old-Regime benefit, the right way to see its true value is to compute your total tax **with and without** it under the Old Regime, and then compare that against the New Regime. The [Income Tax Calculator](/tools/income-tax-calculator) does this end to end.

## Putting your tax saving to work

Once you know your HRA saving, plan where it goes:

- Build a Section 80C corpus with the [PPF Calculator](/tools/ppf-calculator).
- Project long-term growth with the [SIP Calculator](/tools/sip-calculator) or the [Lumpsum Calculator](/tools/lumpsum-calculator).
- Compare a future home purchase using the [Home Loan Calculator](/tools/home-loan-calculator).

## Frequently asked questions

**What is the formula for HRA exemption?**
The exemption is the least of: (1) actual HRA received, (2) rent paid minus 10% of salary, and (3) 50% of salary for metro cities or 40% for non-metro cities.

**Is HRA calculated monthly or yearly?**
Either works if your figures are constant. If salary, rent, or city changed during the year, compute month by month and add up the results.

**What if my rent is very low?**
If your rent is below 10% of your Basic Salary, Rule 2 becomes zero and you get no HRA exemption, regardless of how much HRA you receive.

**Does HRA reduce my tax or my income?**
It reduces your taxable income. Your actual tax saving equals the exemption multiplied by your marginal tax rate, plus cess.

**Which cities are metro for HRA?**
Only Delhi, Mumbai, Kolkata, and Chennai. All other cities use the 40% limit.

**Can I claim HRA and a home loan together?**
Yes, in genuine cases. See [HRA vs Home Loan Tax Benefits](/learn/hra-vs-home-loan-tax-benefits) for the full explanation.

---

_Skip the manual maths — the [HRA Calculator](/tools/hra-calculator) runs all three rules for you and highlights the exempt amount. Then use the [Income Tax Calculator](/tools/income-tax-calculator) to see the effect on your total tax._

_Disclaimer: This article is for general information only and is not tax advice. Verify against official sources or consult a qualified professional._
