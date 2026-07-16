---
title: "How EMI is Calculated (Formula, Examples & Amortisation)"
metaTitle: "How EMI is Calculated — Formula & Examples | Esytol"
metaDescription: "How EMI is calculated in India: the reducing-balance formula, worked examples, and why your early EMIs are almost all interest. With an amortisation schedule explained."
slug: "how-emi-is-calculated"
category: "loans"
tags: ["how emi is calculated", "emi formula", "reducing balance", "amortisation"]
lastUpdated: "2026-07-17"
reviewedBy: "EasyTechLabs Finance Team"
---

# How EMI is Calculated

Your EMI is the one number every lender leads with, and the one number that tells you least about what a loan costs. Two loans with the same EMI can differ by lakhs in total interest. Understanding how the EMI is built — and how it splits between interest and principal each month — is what turns a loan from something that happens to you into something you can steer.

This article shows the formula, works through real numbers, and explains the amortisation schedule that decides whether prepaying is worth it. The [EMI Calculator](/tools/emi-calculator) does all of it instantly for your own loan, but the mechanics below are what make the output mean something.

## EMI in one sentence

An EMI (Equated Monthly Instalment) is a fixed monthly payment, calculated so that a loan of a given amount, at a given rate, is fully repaid — principal and interest — over a given number of months.

The word doing the work is **equated**: the payment is level, but what it is _made of_ changes every single month.

## The formula

EMI is calculated using the reducing-balance method:

> **EMI = P × r × (1 + r)ⁿ ÷ [(1 + r)ⁿ − 1]**

Where:

- **P** = principal (the amount borrowed)
- **r** = **monthly** interest rate = annual rate ÷ 12 ÷ 100
- **n** = tenure in **months**

Two conversions cause most manual-calculation errors: the rate must be monthly, not annual, and the tenure must be in months, not years. A 9% annual rate is `0.09 ÷ 12 = 0.0075` per month; 20 years is 240 months, not 20.

### A worked example

Borrow **₹50,00,000** at **9%** for **20 years**:

- P = 50,00,000
- r = 9 ÷ 12 ÷ 100 = 0.0075
- n = 240

Running those through the formula gives an EMI of approximately **₹44,986**.

Over 240 months you pay about **₹1,07,96,000** in total — roughly **₹57,96,000** of interest on a ₹50 lakh loan. You repay more in interest than you borrowed. That is not a scandal; it is what 20 years of compounding costs, and it is the number the EMI conceals.

## Why interest is charged on the reducing balance

Indian retail loans charge interest on **what you still owe**, recalculated every month — not on the original amount.

Each month:

1. **Interest for the month** = outstanding balance × monthly rate
2. **Principal repaid** = EMI − interest for the month
3. **New balance** = old balance − principal repaid

The EMI never changes, but as the balance falls, the interest portion falls with it — so a bigger slice of the same EMI goes to principal each month. That is the whole mechanism.

### The alternative: flat rate

Some small unsecured loans quote a **flat rate**, charging interest on the _original_ amount for the entire tenure. A "10% flat" loan is far more expensive than a 10% reducing-balance loan, because you keep paying interest on money you have already repaid. A flat rate of roughly 10% corresponds to an effective reducing-balance rate not far off double that.

If a quote seems unusually cheap, check which method it uses. The [Personal Loan Calculator](/tools/personal-loan-calculator) shows the effective cost once fees are included, which is the only fair basis for comparison.

## The amortisation schedule, and why it matters

The amortisation schedule is the month-by-month record of that split. On the ₹50 lakh / 9% / 20-year loan above, the first month looks like this:

- Interest = ₹50,00,000 × 0.0075 = **₹37,500**
- Principal = ₹44,986 − ₹37,500 = **₹7,486**

Your first ₹44,986 payment reduces your debt by about **₹7,486**. Roughly **83% of it is interest**.

Here is the shape across the loan:

| Stage            | Roughly what your EMI is doing                  |
| ---------------- | ----------------------------------------------- |
| Year 1           | Overwhelmingly interest; principal barely moves |
| Around year 8–10 | The split approaches half and half              |
| Final years      | Almost entirely principal                       |

This front-loading is not a trick. It falls directly out of "interest is charged on the outstanding balance" — early on, the balance is at its largest, so the interest is too.

### The consequence: when prepayment is worth most

Because every rupee of principal you kill also kills all the future interest that rupee would have carried, a prepayment is worth most **when the remaining interest is largest** — that is, early. The same ₹1,00,000 prepaid in year 2 saves dramatically more than in year 15, when most of the interest has already been paid and the balance is mostly principal anyway.

This is why "should I prepay?" is really a question about _where you are in the schedule_. [Loan Prepayment: Should You Reduce EMI or Tenure?](/learn/loan-prepayment-guide) works through it properly, including which of the two options to take.

## What changes your EMI

| Change                      | Effect on EMI | Effect on total interest |
| --------------------------- | ------------- | ------------------------ |
| Higher principal            | Up            | Up                       |
| Higher interest rate        | Up            | Up                       |
| **Longer tenure**           | **Down**      | **Up**                   |
| Prepayment (EMI reduced)    | Down          | Down                     |
| Prepayment (tenure reduced) | Unchanged     | Down, usually by more    |

The third row is the one to sit with. Stretching the tenure is the standard remedy when an EMI is unaffordable, and it works — but it is a purchase, not a saving. You are buying breathing room with interest.

On a **floating-rate** loan there is a fourth mover: the benchmark. Since **1 October 2019** the RBI has required banks to link new floating-rate retail loans to an external benchmark such as the repo rate. When it moves, your lender adjusts your tenure, your EMI, or both — see [Fixed vs Floating Interest Rate](/learn/fixed-vs-floating-interest-rate).

## Frequently asked questions

**What is the EMI formula?**
EMI = P × r × (1 + r)ⁿ ÷ [(1 + r)ⁿ − 1], where P is the principal, r is the monthly interest rate (annual rate ÷ 12 ÷ 100), and n is the tenure in months. The [EMI Calculator](/tools/emi-calculator) applies it and shows the full schedule.

**Why is most of my early EMI going to interest?**
Because interest is charged on your outstanding balance, and early in the loan that balance is at its highest. On a ₹50 lakh, 9%, 20-year loan, the first EMI is about 83% interest. The proportion shifts toward principal every month.

**What is the difference between flat rate and reducing balance?**
A reducing-balance rate charges interest only on what you still owe. A flat rate charges interest on the full original amount for the whole tenure, so you keep paying interest on money you have already repaid. A flat rate is much more expensive than the same number quoted as reducing balance.

**Does a longer tenure reduce the cost of my loan?**
No. It reduces the EMI and increases the total interest, because the debt is outstanding for longer. Compare the EMI and the total interest together — the [EMI Calculator](/tools/emi-calculator) shows both.

**Is EMI calculated the same way for home and personal loans?**
The formula is the same for any reducing-balance loan. What differs is the rate, the tenure and the fees — which is why the [Home Loan Calculator](/tools/home-loan-calculator) and [Personal Loan Calculator](/tools/personal-loan-calculator) add the costs specific to each.

---

_See the formula applied to your own loan — with the full amortisation schedule — in the [EMI Calculator](/tools/emi-calculator). New to borrowing? Start with the [Complete Guide to Loans in India](/learn/complete-guide-to-loans-in-india)._

_Official sources: [Reserve Bank of India](https://www.rbi.org.in) for external benchmark-linked lending rules._

_Disclaimer: This article is for general information only and is not financial advice. Figures are illustrative; your lender's actual EMI may differ slightly due to rounding and day-count conventions. Verify against official sources or consult a qualified professional._
