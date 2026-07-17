/**
 * Comparison datasets — the Commercial Decision Layer (REVENUE-001).
 *
 * A comparison earns its place only where a reader is genuinely choosing between
 * routes. The honesty rules are enforced by the type, not by review:
 *
 * - every option MUST list cons and who should AVOID it (an option that suits
 *   everyone is an advert, not a comparison);
 * - `pricing` states only what is structurally true (regulation or public policy),
 *   never a third-party price we cannot keep current;
 * - `sponsored` marks paid placements. It renders a disclosure and
 *   rel="sponsored" — and ranking is by user fit, never by payment. There are
 *   currently NO sponsored options and no affiliate links: the field exists so
 *   that when real partnerships arrive, disclosure is structural, not optional.
 *
 * These compare CATEGORIES of provider (routes), not named brands. Named brands
 * require verified current pricing and a real partnership agreement — adding a
 * brand here without both is how trust dies.
 */

export interface ComparisonOption {
  name: string;
  /** One-line description of what this route is. */
  summary: string;
  pros: string[];
  cons: string[];
  bestFor: string;
  avoidIf: string;
  /** Only structural/regulatory pricing facts. Omit rather than guess. */
  pricing?: string;
  /** External destination. None today; requires a real, disclosed partnership. */
  link?: { href: string; label: string; sponsored: boolean };
}

export interface Comparison {
  /** Stable id used in analytics events. */
  id: string;
  title: string;
  intro: string;
  /** What the reader should judge the options on — shown before the options. */
  criteria: string[];
  options: ComparisonOption[];
  /** Always rendered. */
  disclosure: string;
}

const STANDARD_DISCLOSURE =
  "Esytol currently has no paid partnerships: nothing below is sponsored and there are no affiliate links. If that ever changes, sponsored placements will be marked and never re-ordered for payment. This comparison describes categories of provider, not specific companies — verify current pricing with any provider before committing.";

const TAX_FILING: Comparison = {
  id: "tax-filing-route",
  title: "How should you file: portal, software, or a CA?",
  intro:
    "Everyone with taxable income files the same return — but the right route depends on how complicated your year was, not on how much you earn.",
  criteria: [
    "Complexity of your income (salary only? capital gains? foreign assets? business?)",
    "Whether you need advice or only execution",
    "Cost against the risk of an expensive mistake",
    "How much of your data you want to hand to a third party",
  ],
  options: [
    {
      name: "Income-tax portal (DIY)",
      summary: "The government's own e-filing portal, with pre-filled returns from your AIS.",
      pros: [
        "Free, official, and pre-filled with your TDS/AIS data",
        "No third party sees your financial data",
        "Perfectly adequate for salary + interest income",
      ],
      cons: [
        "Little guidance when something unusual appears",
        "Capital-gains schedules are tedious to fill manually",
        "You carry the full responsibility for getting it right",
      ],
      bestFor: "Salaried filers with simple income who check Form 26AS/AIS themselves.",
      avoidIf:
        "You have business income, many capital-gains entries, or foreign assets — the cost of a mistake exceeds any saving.",
      pricing: "Free (government service).",
    },
    {
      name: "Tax-filing software",
      summary: "Commercial platforms that import your data and guide the return step by step.",
      pros: [
        "Imports broker capital-gains statements — the biggest time-saver",
        "Guided flows catch common omissions (regime choice, missed deductions)",
        "Cheaper than a professional for moderately complex returns",
      ],
      cons: [
        "Paid tiers gate exactly the features complex filers need",
        "Guidance is generic — it will not argue your edge case",
        "Your full financial data sits with a private platform",
      ],
      bestFor:
        "Filers with equity/mutual-fund gains or multiple income sources who still want DIY.",
      avoidIf:
        "Your situation needs judgement (notices, business income, clubbing, foreign income) — software executes, it does not advise.",
    },
    {
      name: "Chartered Accountant",
      summary: "A professional prepares and files for you, and answers for the judgement calls.",
      pros: [
        "Advice, not just execution — regimes, timing, set-offs, notices",
        "Accountability when the department asks questions",
        "Saves real hours for complex years",
      ],
      cons: [
        "The most expensive route, and quality varies widely",
        "Peak-season CAs can be rushed exactly when you need care",
        "You still must supply and verify the underlying data",
      ],
      bestFor:
        "Business income, property sales, notices, NRI questions, or any year where a mistake is costly.",
      avoidIf:
        "Your return is salary + a bank account — you would be paying for judgement you don't need.",
    },
  ],
  disclosure: STANDARD_DISCLOSURE,
};

const BROKER_ROUTE: Comparison = {
  id: "broker-route",
  title: "Discount broker, bank-backed broker, or full-service?",
  intro:
    "For buying stocks and ETFs you need a demat + trading account. The three routes differ mainly in cost, hand-holding, and conflicts of interest.",
  criteria: [
    "Total cost per trade AND annual account charges (both matter)",
    "Whether you want advice — and whether the 'advice' is really sales",
    "Platform reliability on the days markets move violently",
    "How easily you can leave (exit paperwork, share transfer)",
  ],
  options: [
    {
      name: "Discount broker",
      summary: "App-first brokers charging flat, low fees with no advisory layer.",
      pros: [
        "Lowest cost by far, especially for delivery investing",
        "Clean self-serve platforms; account opening in minutes",
        "No commission-driven product pushing",
      ],
      cons: [
        "No human support worth the name when something breaks",
        "Research/advice absent or basic — you are on your own",
        "Outages during market spikes have happened across the category",
      ],
      bestFor:
        "Self-directed investors buying ETFs, index funds and stocks on their own decisions.",
      avoidIf: "You will not act without someone to call, or you need hand-holding on every order.",
    },
    {
      name: "Bank-backed (3-in-1) broker",
      summary: "Broking bundled with your bank and demat account.",
      pros: [
        "Seamless money movement between savings, demat and trading",
        "Branch support exists; comfort of an institution you already use",
        "One institution, one KYC trail",
      ],
      cons: [
        "Meaningfully higher brokerage and charges than discount brokers",
        "Relationship managers are incentivised to sell products",
        "Platforms typically lag the app-first brokers",
      ],
      bestFor: "Investors who value the banking integration and will genuinely use branch support.",
      avoidIf:
        "Cost matters and you never visit a branch — you are paying for comfort you won't use.",
    },
    {
      name: "Full-service broker with advisory",
      summary: "Traditional broking plus research, advice and a human relationship.",
      pros: [
        "Research coverage and a person accountable to you",
        "Useful for large, complex portfolios and estate situations",
      ],
      cons: [
        "Highest cost; percentage-based charges compound painfully",
        "Advice can blur into sales — ask how the adviser is paid",
        "Minimums may exclude smaller portfolios anyway",
      ],
      bestFor: "Large portfolios that genuinely use ongoing, accountable advice.",
      avoidIf:
        "You mainly SIP into funds — you don't need a broker for that at all (see the platform comparison in the mutual funds guide).",
    },
  ],
  disclosure: STANDARD_DISCLOSURE,
};

const MF_PLATFORM: Comparison = {
  id: "mf-platform-route",
  title: "Where to buy mutual funds: direct platforms, distributors, or a fee-only adviser?",
  intro:
    "The same fund costs different amounts depending on where you buy it. This is the rare comparison where regulation itself defines the price gap.",
  criteria: [
    "Direct vs regular plan — the ~0.5–1%/yr difference compounds into lakhs",
    "Whether you need advice, and whether it is paid by you or by commissions",
    "Consolidation: statements, capital-gains reports, nominee handling",
  ],
  options: [
    {
      name: "Direct-plan platforms (incl. AMC sites, MF Central)",
      summary: "Buy direct plans with zero embedded commission — the SEBI-created route.",
      pros: [
        "Zero commission by regulation: the cheapest the fund can be",
        "The cost gap compounds — roughly ₹9 lakh on a ₹10k/month SIP over 20 years at a 1% drag (verify in our SIP calculator)",
        "Full control and clean records",
      ],
      cons: ["Nobody stops you doing something unwise", "Fund selection is entirely on you"],
      bestFor: "Anyone who has read enough to pick 2–4 sensible funds and stay the course.",
      avoidIf:
        "You will churn funds every time a ranking changes — the savings die in bad behaviour.",
      pricing: "Direct plans carry no distributor commission (SEBI regulation).",
    },
    {
      name: "Distributor apps and banks (regular plans)",
      summary:
        "Convenient platforms paid by commissions embedded in the regular plan's expense ratio.",
      pros: [
        "Convenient, familiar, often bundled with your bank",
        "A human may assist with paperwork and nudge you to start",
      ],
      cons: [
        "You pay ~0.5–1% of your corpus, every year, forever",
        "The incentive is to sell what pays, not what fits",
        '"Free" is the most expensive word in this table',
      ],
      bestFor: "Honestly: very few people, now that direct platforms are equally convenient.",
      avoidIf: "You know what an expense ratio is — at that point the commission buys you nothing.",
    },
    {
      name: "Fee-only adviser (SEBI RIA) + direct plans",
      summary: "You pay a transparent fee for advice; the money still goes into direct plans.",
      pros: [
        "Advice with no commission conflict — the adviser works for you",
        "Handles the whole picture: allocation, tax, insurance, goals",
        "Direct-plan savings usually exceed the fee for meaningful portfolios",
      ],
      cons: [
        "A real fee, visible (which is the point) — feels expensive vs 'free'",
        "Good RIAs are scarce and often have client minimums",
      ],
      bestFor:
        "Meaningful portfolios or complex situations wanting accountable, conflict-free advice.",
      avoidIf:
        "Your situation is one SIP and an emergency fund — read our investing guide instead and keep the fee.",
    },
  ],
  disclosure: STANDARD_DISCLOSURE,
};

const FD_VENUE: Comparison = {
  id: "fd-venue",
  title: "Where to book an FD: your bank, a small finance bank, or a corporate deposit?",
  intro:
    "An FD's rate is only half the decision — who owes you the money is the other half. The venues differ more in risk than in paperwork.",
  criteria: [
    "DICGC insurance: ₹5 lakh per depositor per bank covers scheduled banks — not corporate deposits",
    "Rate premium vs the extra risk it is paying you for",
    "Premature-withdrawal terms, which decide whether the money is really liquid",
  ],
  options: [
    {
      name: "Your existing bank",
      summary: "The default: book in two clicks where your savings account lives.",
      pros: [
        "Instant, familiar, easy premature closure",
        "DICGC-insured up to ₹5 lakh",
        "Simplest tax paperwork (one AIS trail)",
      ],
      cons: [
        "Large banks usually pay the lowest rates",
        "Convenience quietly costs 0.5–1% vs alternatives",
      ],
      bestFor: "Emergency funds and short-term parking where access beats yield.",
      avoidIf: "You are laddering large long-term sums — shopping around is paid work.",
      pricing: "DICGC insurance up to ₹5,00,000 per depositor per bank (statutory).",
    },
    {
      name: "Small finance banks",
      summary: "Newer licensed banks paying visibly higher FD rates to attract deposits.",
      pros: [
        "Typically the best insured rates available",
        "Same DICGC ₹5 lakh cover as any scheduled bank",
        "Senior-citizen premiums stack on top",
      ],
      cons: [
        "Above ₹5 lakh you are taking real institution risk for the extra rate",
        "Service and apps vary; premature terms can be stiffer",
      ],
      bestFor: "Yield-seekers who keep each bank's exposure within the ₹5 lakh insured limit.",
      avoidIf: "You would exceed the insured limit in one bank — split it or stay mainstream.",
      pricing: "DICGC insurance up to ₹5,00,000 per depositor per bank (statutory).",
    },
    {
      name: "Corporate fixed deposits",
      summary: "Deposits with NBFCs/companies at rates above bank FDs.",
      pros: [
        "Higher headline rates than banks",
        "Some issuers are highly rated and long-established",
      ],
      cons: [
        "NO DICGC insurance — this is unsecured corporate credit",
        "Credit ratings can drop after you invest; defaults have happened",
        "Premature exit is at the issuer's terms",
      ],
      bestFor:
        "Investors who understand credit risk, diversify across issuers, and read the rating rationale.",
      avoidIf:
        "This is safety money. The extra 1–2% is not compensation for losing principal — that's what the insured venues are for.",
    },
  ],
  disclosure: STANDARD_DISCLOSURE,
};

const CREDIT_REPORT: Comparison = {
  id: "credit-report-route",
  title: "Checking your credit score: free bureau reports, fintech apps, or paid monitoring?",
  intro:
    "Before a big loan you should read your credit report. There are three ways in, and the free one is the one most people don't know they own.",
  criteria: [
    "Is it the full report or just the score?",
    "What happens to your data (marketing consent is the real price of 'free')",
    "Do you need a one-time check or ongoing monitoring?",
  ],
  options: [
    {
      name: "Free annual bureau reports (your statutory right)",
      summary:
        "Each RBI-licensed bureau — CIBIL, Experian, Equifax, CRIF — must give you one full free report every year.",
      pros: [
        "The complete report, from the source, free — four times a year across bureaus",
        "No marketing funnel attached",
        "Exactly what a lender sees, so errors are visible",
      ],
      cons: ["Manual: four sign-ups, once a year each", "No alerts between checks"],
      bestFor: "Everyone — and especially anyone 3–6 months before a home-loan application.",
      avoidIf: "You need continuous monitoring after identity theft — see paid monitoring.",
      pricing: "Free — one full report per bureau per calendar year (RBI mandate).",
    },
    {
      name: "Fintech apps showing 'free credit score'",
      summary: "Loan/credit-card marketplaces that show your score in exchange for consent.",
      pros: ["Instant, convenient, refreshed monthly", "Genuinely free in rupees"],
      cons: [
        "The product is you: expect loan and card marketing",
        "Usually score-only or a partial report — errors stay hidden",
        "Consent often includes data sharing with lending partners",
      ],
      bestFor: "Casual score-watching between annual full-report checks.",
      avoidIf:
        "You are error-hunting before a big application — you need the full bureau report, not a number.",
    },
    {
      name: "Paid monitoring subscriptions",
      summary: "Bureau or third-party plans with alerts on every enquiry and change.",
      pros: [
        "Alerts on new enquiries — useful after fraud or identity theft",
        "Full reports on demand",
      ],
      cons: [
        "Recurring cost for data you can mostly get free",
        "Sold hardest to the people who need it least",
      ],
      bestFor: "Post-fraud vigilance, or heavy credit users managing many accounts.",
      avoidIf: "You just want your score before a loan — use your free statutory reports.",
    },
  ],
  disclosure: STANDARD_DISCLOSURE,
};

const HOME_LOAN_SOURCE: Comparison = {
  id: "home-loan-source",
  title: "Getting a home loan: your bank, a marketplace, or a DSA agent?",
  intro:
    "The same borrower can be quoted meaningfully different rates through different channels. Knowing who is paid what makes the quotes comparable.",
  criteria: [
    "The full price: rate + processing fee + insurance push, not the headline rate",
    "Who the intermediary actually works for (hint: whoever pays them)",
    "Speed and paperwork tolerance",
    "Your negotiating position — a strong credit profile changes everything",
  ],
  options: [
    {
      name: "Direct to banks (2–3 quotes yourself)",
      summary: "Approach your salary bank plus one or two competitors directly.",
      pros: [
        "No intermediary incentives in the middle",
        "Your existing bank often has a relationship rate — and competitors' quotes are your leverage",
        "Cleanest view of the fee structure",
      ],
      cons: [
        "Your legwork: forms and follow-ups per bank",
        "You only see the banks you thought to ask",
      ],
      bestFor: "Borrowers with strong credit (750+) who can invest a weekend to save lakhs.",
      avoidIf:
        "Your profile is complicated (self-employed, thin file) — a good intermediary earns their keep there.",
    },
    {
      name: "Online loan marketplaces",
      summary: "Aggregators showing many banks' offers against one application.",
      pros: [
        "Wide comparison in one sitting",
        "Useful for discovering lenders you'd never have asked",
      ],
      cons: [
        "Listings can reflect commercial arrangements, not just fit",
        "Your details fan out to many lenders — expect calls; enquiries may multiply",
        "The displayed rate is the start of negotiation, not the end",
      ],
      bestFor: "First-pass discovery of the realistic rate band for your profile.",
      avoidIf:
        "You dislike sales calls, or your bureau file is fragile enough that scattered enquiries hurt.",
    },
    {
      name: "DSA (direct selling agent)",
      summary: "A commission-paid agent who processes your file with one or more lenders.",
      pros: [
        "Handles paperwork end-to-end — real value for messy files",
        "Knows which lender's credit team accepts which profiles",
      ],
      cons: [
        "Paid by the lender per disbursal: the incentive is to close, not to optimise your rate",
        "Insurance and top-up cross-selling is common at signing",
      ],
      bestFor: "Non-standard profiles where file presentation genuinely decides approval.",
      avoidIf:
        "You have a clean salaried profile — you're paying (invisibly) for a service you don't need.",
    },
  ],
  disclosure: STANDARD_DISCLOSURE,
};

/** Which comparison(s) appear on which article. One dataset; placements are data. */
export const comparisonsBySlug: Record<string, Comparison[]> = {
  "capital-gains-tax-guide": [TAX_FILING],
  "tds-explained": [TAX_FILING],
  "advance-tax-guide": [TAX_FILING],
  "complete-guide-to-investing-in-india": [BROKER_ROUTE],
  "mutual-funds-elss-etf-guide": [MF_PLATFORM],
  "sip-vs-lumpsum-vs-swp": [MF_PLATFORM],
  "fd-vs-rd-vs-ppf": [FD_VENUE],
  "credit-score-and-loan-eligibility": [CREDIT_REPORT],
  "complete-guide-to-loans-in-india": [HOME_LOAN_SOURCE],
  "home-loan-vs-personal-loan": [HOME_LOAN_SOURCE],
};

export function comparisonsFor(slug: string): Comparison[] {
  return comparisonsBySlug[slug] ?? [];
}
