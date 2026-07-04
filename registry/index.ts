import type { Tool, ToolFilter } from "@/types/tool";

export const toolRegistry: Tool[] = [
  // ─── Developer ───────────────────────────────────────────────────────────
  {
    id: "json-formatter",
    name: "JSON Formatter",
    slug: "json-formatter",
    description: "Format, validate, and beautify JSON data with syntax highlighting.",
    category: "developer",
    tags: ["json", "formatter", "validator", "developer"],
    keywords: ["json formatter online", "json validator", "json beautifier", "json pretty print"],
    icon: "📋",
    url: "/tools/json-formatter",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["base64-encoder", "url-encoder"],
    faq: [
      {
        question: "Is my JSON data sent to a server?",
        answer:
          "No. All formatting and validation happens entirely in your browser. Nothing is sent to any server.",
      },
      {
        question: "What is the maximum JSON size I can format?",
        answer:
          "There is no hard limit; however, very large JSON files (10 MB+) may be slower depending on your device.",
      },
      {
        question: "Can I use this to validate JSON syntax errors?",
        answer:
          "Yes. The formatter highlights syntax errors and shows the exact position of the issue.",
      },
    ],
    featured: true,
    popular: true,
  },
  {
    id: "base64-encoder",
    name: "Base64 Encoder / Decoder",
    slug: "base64-encoder",
    description: "Encode plain text or files to Base64 and decode Base64 strings instantly.",
    category: "encoder",
    tags: ["base64", "encoder", "decoder", "developer"],
    keywords: ["base64 encoder", "base64 decoder", "base64 online", "encode decode base64"],
    icon: "🔡",
    url: "/tools/base64-encoder",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["url-encoder", "json-formatter"],
    faq: [
      {
        question: "What is Base64 encoding?",
        answer:
          "Base64 converts binary or text data into 64 printable ASCII characters, making it safe to transmit over text-only systems.",
      },
      {
        question: "Is Base64 the same as encryption?",
        answer:
          "No. Base64 is encoding, not encryption. Anyone can decode a Base64 string — it provides no security.",
      },
      {
        question: "Can I encode files to Base64?",
        answer:
          "Yes. Use the file input option to encode any file's binary content to a Base64 string.",
      },
    ],
    popular: true,
  },
  {
    id: "url-encoder",
    name: "URL Encoder / Decoder",
    slug: "url-encoder",
    description: "Percent-encode URLs for safe transmission and decode them back.",
    category: "encoder",
    tags: ["url", "encoder", "decoder", "percent-encoding"],
    keywords: ["url encoder online", "url decoder", "percent encoding", "urlencode", "urldecode"],
    icon: "🔗",
    url: "/tools/url-encoder",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["base64-encoder", "json-formatter"],
    faq: [
      {
        question: "What is URL encoding?",
        answer:
          "URL encoding (percent-encoding) replaces unsafe ASCII characters with a % followed by two hex digits so they can be safely included in a URL.",
      },
      {
        question: "When should I URL-encode a string?",
        answer:
          "Encode strings before appending them as query parameters or path segments to avoid breaking the URL structure.",
      },
    ],
    isNew: true,
  },

  // ─── Text ─────────────────────────────────────────────────────────────────
  {
    id: "word-counter",
    name: "Word Counter",
    slug: "word-counter",
    description: "Count words, characters, sentences, and paragraphs in any text.",
    category: "text",
    tags: ["word", "counter", "character", "text"],
    keywords: ["word counter online", "character counter", "word count tool", "sentence counter"],
    icon: "🔢",
    url: "/tools/word-counter",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["case-converter", "lorem-ipsum"],
    faq: [
      {
        question: "Does the word counter include punctuation in character counts?",
        answer:
          "The character count with spaces includes every character including punctuation. The count without spaces excludes whitespace only.",
      },
      {
        question: "How are words defined?",
        answer:
          "A word is any sequence of non-whitespace characters separated by spaces, tabs, or newlines.",
      },
    ],
    featured: true,
    popular: true,
  },
  {
    id: "case-converter",
    name: "Case Converter",
    slug: "case-converter",
    description: "Convert text between UPPER, lower, Title, camelCase, snake_case, and kebab-case.",
    category: "text",
    tags: ["case", "converter", "text", "camelCase", "snake_case"],
    keywords: [
      "case converter online",
      "camelcase converter",
      "snake case converter",
      "text case changer",
    ],
    icon: "🔡",
    url: "/tools/case-converter",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["word-counter", "lorem-ipsum"],
    faq: [
      {
        question: "What is camelCase?",
        answer:
          "camelCase joins words without spaces and capitalises the first letter of each word except the first (e.g. myVariableName).",
      },
      {
        question: "What is the difference between snake_case and kebab-case?",
        answer:
          "snake_case uses underscores between words; kebab-case uses hyphens. Both are lowercase.",
      },
    ],
    popular: true,
  },
  {
    id: "lorem-ipsum",
    name: "Lorem Ipsum Generator",
    slug: "lorem-ipsum",
    description: "Generate configurable placeholder text for wireframes and mockups.",
    category: "generator",
    tags: ["lorem", "ipsum", "placeholder", "generator", "text"],
    keywords: ["lorem ipsum generator", "placeholder text", "dummy text generator", "filler text"],
    icon: "📄",
    url: "/tools/lorem-ipsum",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["word-counter", "case-converter"],
    faq: [
      {
        question: "What is Lorem Ipsum?",
        answer:
          'Lorem Ipsum is dummy text derived from Cicero\'s "de Finibus Bonorum et Malorum" (45 BC). It has been the standard placeholder text in the printing industry since the 1500s.',
      },
      {
        question: "Can I generate Lorem Ipsum in different languages?",
        answer:
          "Currently the generator produces classic Latin-based Lorem Ipsum. Multi-language support is planned.",
      },
    ],
    isNew: true,
  },

  // ─── Calculators ─────────────────────────────────────────────────────────
  {
    id: "emi-calculator",
    name: "EMI Calculator",
    slug: "emi-calculator",
    description:
      "Calculate your monthly EMI, total interest, and full amortization schedule for any loan.",
    category: "calculator",
    tags: ["emi", "loan", "calculator", "finance", "interest", "amortization"],
    keywords: [
      "emi calculator",
      "loan emi calculator",
      "home loan emi calculator",
      "car loan emi",
      "personal loan calculator",
      "amortization schedule",
      "monthly installment calculator",
    ],
    icon: "🧮",
    url: "/tools/emi-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: ["home-loan-calculator", "personal-loan-calculator", "fd-calculator"],
    faq: [
      {
        question: "What is EMI?",
        answer:
          "EMI (Equated Monthly Instalment) is the fixed amount you pay to the lender every month until the loan is fully repaid. Each payment covers part of the principal and the interest accrued.",
      },
      {
        question: "How is EMI calculated?",
        answer:
          "EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is the principal, r is the monthly interest rate (annual rate ÷ 12 ÷ 100), and n is the tenure in months.",
      },
      {
        question: "What is an amortization schedule?",
        answer:
          "An amortization schedule is a table showing the breakdown of each monthly payment into principal and interest, and the remaining loan balance after each payment.",
      },
      {
        question: "Does a higher tenure reduce my EMI?",
        answer:
          "Yes. A longer tenure reduces the monthly EMI but increases the total interest paid over the life of the loan. A shorter tenure means higher EMI but lower total interest.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser. No data is sent to any server.",
      },
    ],
    featured: true,
    popular: true,
  },

  {
    id: "gst-calculator",
    name: "GST Calculator",
    slug: "gst-calculator",
    description:
      "Calculate GST amount, original price, and total for any goods or service. Supports all GST slabs — 3%, 5%, 12%, 18%, 28% — plus custom rates. Shows CGST, SGST, and IGST breakdown.",
    category: "calculator",
    tags: ["gst", "tax", "calculator", "india", "cgst", "sgst", "igst", "finance", "invoice"],
    keywords: [
      "gst calculator",
      "gst calculator india",
      "add gst to amount",
      "remove gst from amount",
      "gst inclusive calculator",
      "gst exclusive calculator",
      "cgst sgst calculator",
      "18% gst calculator",
      "12% gst calculator",
      "gst on invoice",
      "goods and services tax calculator",
      "tax calculator india",
      "gst amount calculator",
    ],
    icon: "🧾",
    url: "/tools/gst-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: ["emi-calculator", "sip-calculator", "fd-calculator"],
    faq: [
      {
        question: "What is GST?",
        answer:
          "GST (Goods and Services Tax) is a comprehensive indirect tax levied on the supply of goods and services in India, introduced on 1 July 2017. It replaced multiple taxes including VAT, service tax, and excise duty. GST is charged at multiple rates: 0%, 3%, 5%, 12%, 18%, and 28%.",
      },
      {
        question: "What is the difference between GST exclusive and GST inclusive?",
        answer:
          "GST exclusive (Add GST) means the entered amount is the base price before tax — the calculator adds GST on top. GST inclusive (Remove GST) means the entered amount already includes GST — the calculator extracts the original base price and the tax portion.",
      },
      {
        question: "What are CGST and SGST?",
        answer:
          "For intra-state supplies, GST is split equally into CGST (Central GST, collected by the Centre) and SGST (State GST, collected by the state). Each is levied at half the applicable GST rate. For example, at 18% GST: CGST = 9% and SGST = 9%. For inter-state supplies, a single IGST (Integrated GST) at the full rate applies instead.",
      },
      {
        question: "What are the standard GST rates in India?",
        answer:
          "As per the GST Council: 0% (exempted goods — milk, eggs, fresh vegetables), 3% (gold, silver, precious metals), 5% (essential goods, transport services), 12% (processed foods, computers, medicines), 18% (most goods and services, electronics — the standard rate), and 28% (luxury goods, automobiles, tobacco, aerated beverages).",
      },
      {
        question: "How is GST calculated on an inclusive price?",
        answer:
          "For an amount that already includes GST, the original price = Total × 100 ÷ (100 + GST Rate), as per CGST Rules 2017, Rule 35. For example, ₹1,180 inclusive at 18% GST: Original = 1180 × 100 ÷ 118 = ₹1,000, and GST = ₹1,180 − ₹1,000 = ₹180.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "sip-calculator",
    name: "SIP Calculator",
    slug: "sip-calculator",
    description:
      "Calculate SIP returns, total maturity value, and month-wise portfolio growth for any mutual fund SIP. Shows Total Invested, Estimated Returns, Wealth Gained %, and CAGR.",
    category: "calculator",
    tags: ["sip", "mutual fund", "calculator", "india", "investment", "returns", "finance"],
    keywords: [
      "sip calculator",
      "sip calculator india",
      "sip return calculator",
      "mutual fund sip calculator",
      "monthly sip calculator",
      "sip maturity calculator",
      "sip investment calculator",
      "systematic investment plan calculator",
      "sip wealth calculator",
      "sip cagr calculator",
      "how much will my sip grow",
      "sip returns estimator",
      "mutual fund returns calculator",
    ],
    icon: "📈",
    url: "/tools/sip-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "lumpsum-calculator",
      "fd-calculator",
      "rd-calculator",
      "ppf-calculator",
      "cagr-calculator",
    ],
    faq: [
      {
        question: "What is a SIP?",
        answer:
          "SIP (Systematic Investment Plan) is a method of investing a fixed amount regularly — typically monthly — in a mutual fund scheme. Instead of investing a lump sum, a SIP lets you invest small amounts periodically, benefiting from rupee cost averaging and the power of compounding.",
      },
      {
        question: "How is SIP return calculated?",
        answer:
          "SIP return uses the Future Value of an Annuity Due formula: FV = P × [(1 + i)^n − 1] / i × (1 + i), where P is the monthly investment, i is the monthly rate (annual rate ÷ 12 ÷ 100), and n is the number of months. Each installment is assumed to be invested at the beginning of the month (annuity due), which is the standard adopted by AMFI.",
      },
      {
        question: "What is Wealth Gained %?",
        answer:
          "Wealth Gained % = (Estimated Returns ÷ Total Invested) × 100. It shows how much your investment has grown relative to what you put in. A Wealth Gained % of 100% means your investment has doubled.",
      },
      {
        question: "What is CAGR in a SIP context?",
        answer:
          "CAGR (Compound Annual Growth Rate) here represents the annual rate at which your total invested capital would need to grow to reach the maturity value over the investment period: CAGR = (Total Value ÷ Total Invested)^(12 / months) − 1. Note that this is not the same as XIRR, which accounts for the timing of each installment and is the more precise measure of SIP returns.",
      },
      {
        question: "What return rate should I use?",
        answer:
          "Historical data shows that Indian large-cap equity mutual funds have delivered approximately 12–15% CAGR over long periods (10+ years), while debt funds typically deliver 6–8%. These are historical figures — actual future returns are not guaranteed. SEBI mandates that past performance is not indicative of future results.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "fd-calculator",
    name: "FD Calculator",
    slug: "fd-calculator",
    description:
      "Calculate fixed deposit maturity amount, interest earned, and effective annual yield with yearly, half-yearly, quarterly, or monthly compounding. Includes a period-wise growth schedule.",
    category: "calculator",
    tags: ["fd", "fixed deposit", "calculator", "india", "interest", "compound", "savings", "bank"],
    keywords: [
      "fd calculator",
      "fixed deposit calculator",
      "fd calculator india",
      "fd maturity calculator",
      "fd interest calculator",
      "bank fd calculator",
      "sbi fd calculator",
      "quarterly compounding fd calculator",
      "fd return calculator",
      "compound interest fd calculator",
      "fixed deposit maturity amount",
      "fd effective yield calculator",
      "term deposit calculator",
    ],
    icon: "🏦",
    url: "/tools/fd-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "rd-calculator",
      "ppf-calculator",
      "sip-calculator",
      "cagr-calculator",
      "emi-calculator",
    ],
    faq: [
      {
        question: "What is a Fixed Deposit (FD)?",
        answer:
          "A Fixed Deposit is a financial instrument offered by banks and NBFCs where you deposit a lump sum for a fixed tenure at a predetermined interest rate. The interest is compounded periodically, and the principal plus accumulated interest is paid out at maturity. FDs offer guaranteed returns and are considered a low-risk investment.",
      },
      {
        question: "How is FD maturity amount calculated?",
        answer:
          "FD maturity uses the compound interest formula: A = P × (1 + r/n)^(n×t), where P is the principal, r is the annual interest rate (as a decimal), n is the number of compounding periods per year, and t is the tenure in years. Interest earned = A − P.",
      },
      {
        question: "How often do banks compound FD interest?",
        answer:
          "As per RBI's Master Direction on interest rates, Indian banks compound term-deposit interest at quarterly rests (every 3 months) by default. Major banks such as SBI, HDFC, ICICI, and PNB follow quarterly compounding. This calculator also lets you choose yearly, half-yearly, or monthly compounding to compare scenarios.",
      },
      {
        question: "What is Effective Annual Yield?",
        answer:
          "Effective Annual Yield (EAY) is the actual annual return after accounting for intra-year compounding: EAY = (1 + r/n)^n − 1. Because interest is compounded more than once a year, the effective yield is slightly higher than the nominal rate. For example, 7% nominal compounded quarterly gives an effective yield of about 7.19%.",
      },
      {
        question: "Does a higher compounding frequency give higher returns?",
        answer:
          "Yes. For the same nominal interest rate, more frequent compounding produces a higher maturity amount because interest is added to the principal more often and starts earning interest sooner. Monthly compounding yields slightly more than quarterly, which yields more than half-yearly or yearly.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "rd-calculator",
    name: "RD Calculator",
    slug: "rd-calculator",
    description:
      "Calculate recurring deposit maturity amount, total deposited, and interest earned with quarterly compounding (RBI standard). Includes a month-wise growth schedule and effective annual yield.",
    category: "calculator",
    tags: [
      "rd",
      "recurring deposit",
      "calculator",
      "india",
      "interest",
      "compound",
      "savings",
      "bank",
    ],
    keywords: [
      "rd calculator",
      "recurring deposit calculator",
      "rd calculator india",
      "rd maturity calculator",
      "rd interest calculator",
      "bank rd calculator",
      "sbi rd calculator",
      "post office rd calculator",
      "monthly rd calculator",
      "rd return calculator",
      "recurring deposit maturity amount",
      "rd effective yield calculator",
      "quarterly compounding rd calculator",
    ],
    icon: "💰",
    url: "/tools/rd-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "fd-calculator",
      "ppf-calculator",
      "sip-calculator",
      "cagr-calculator",
      "emi-calculator",
    ],
    faq: [
      {
        question: "What is a Recurring Deposit (RD)?",
        answer:
          "A Recurring Deposit is a savings instrument offered by banks and post offices where you deposit a fixed amount every month for a fixed tenure at a predetermined interest rate. At maturity, you receive the total of all installments plus the accumulated interest. RDs are ideal for disciplined, goal-based saving.",
      },
      {
        question: "How is RD maturity calculated?",
        answer:
          "RD interest is compounded quarterly. Each monthly installment earns interest for the remaining months until maturity. The maturity value is M = Σ P × (1 + r/4)^((remaining months) / 3), where P is the monthly deposit and r is the annual interest rate as a decimal. Total interest = maturity − total deposited.",
      },
      {
        question: "How often is RD interest compounded?",
        answer:
          "As per RBI's Master Direction on interest rates, recurring-deposit interest is compounded at quarterly rests (every 3 months), the same as fixed deposits. Banks such as SBI, HDFC, and ICICI, as well as India Post, follow quarterly compounding for RDs.",
      },
      {
        question: "What is the difference between an RD and an FD?",
        answer:
          "In a Fixed Deposit (FD) you invest a lump sum once and it grows for the full tenure. In a Recurring Deposit (RD) you invest a fixed amount every month. Because RD installments are added gradually, each installment earns interest for a shorter period, so an RD earns less total interest than an equivalent lump-sum FD for the same total amount and rate.",
      },
      {
        question: "How does an RD differ from a SIP?",
        answer:
          "An RD is a bank deposit with a fixed, guaranteed interest rate and quarterly compounding, so returns are assured. A SIP invests in mutual funds where returns are market-linked and not guaranteed. RDs carry lower risk and lower expected returns; SIPs carry market risk with potentially higher long-term returns.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "ppf-calculator",
    name: "PPF Calculator",
    slug: "ppf-calculator",
    description:
      "Calculate your Public Provident Fund (PPF) maturity value, total interest, and year-wise growth. Supports the current 7.1% rate, ₹500–₹1.5 lakh yearly limits, 15-year maturity, and extensions.",
    category: "calculator",
    tags: [
      "ppf",
      "public provident fund",
      "calculator",
      "india",
      "tax saving",
      "investment",
      "80c",
    ],
    keywords: [
      "ppf calculator",
      "public provident fund calculator",
      "ppf calculator india",
      "ppf maturity calculator",
      "ppf interest calculator",
      "sbi ppf calculator",
      "post office ppf calculator",
      "ppf calculator 15 years",
      "ppf return calculator",
      "ppf 7.1 interest calculator",
      "ppf extension calculator",
      "ppf maturity value",
      "80c ppf calculator",
    ],
    icon: "🏛️",
    url: "/tools/ppf-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "sip-calculator",
      "fd-calculator",
      "rd-calculator",
      "cagr-calculator",
      "emi-calculator",
    ],
    faq: [
      {
        question: "What is PPF (Public Provident Fund)?",
        answer:
          "PPF is a long-term, government-backed savings scheme introduced by the Ministry of Finance under the Public Provident Fund Scheme, 2019. It offers a fixed, tax-free rate of interest, a 15-year maturity, and deductions under Section 80C of the Income Tax Act. Both the interest earned and the maturity amount are fully exempt from tax (EEE status).",
      },
      {
        question: "How is PPF interest calculated?",
        answer:
          "PPF interest is compounded annually and credited on 31 March each year. As per the scheme, interest is calculated on the lowest account balance between the 5th and the last day of each month. This calculator assumes the yearly contribution is deposited at the start of the year, so it earns interest for the full year: closing balance = (opening balance + contribution) × (1 + rate).",
      },
      {
        question: "What are the minimum and maximum PPF contributions?",
        answer:
          "Under the PPF Scheme, 2019, the minimum contribution is ₹500 per financial year and the maximum is ₹1,50,000 per financial year. Contributions above ₹1.5 lakh in a year do not earn interest and are not eligible for tax benefits.",
      },
      {
        question: "What is the current PPF interest rate?",
        answer:
          "The PPF interest rate is notified quarterly by the Ministry of Finance. The current rate is 7.1% per annum, unchanged since the first quarter of FY 2020-21. You can edit the rate in this calculator to model different scenarios.",
      },
      {
        question: "Can a PPF account be extended beyond 15 years?",
        answer:
          "Yes. After the 15-year maturity, a PPF account can be extended in blocks of 5 years any number of times, either with fresh contributions or without. This calculator lets you enter periods beyond 15 years (up to 50) to estimate the value of an extended account.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "cagr-calculator",
    name: "CAGR Calculator",
    slug: "cagr-calculator",
    description:
      "Calculate the Compound Annual Growth Rate (CAGR) of any investment from its beginning and ending value. Shows absolute return, total profit/loss, investment multiple, and a year-wise growth projection.",
    category: "calculator",
    tags: [
      "cagr",
      "returns",
      "calculator",
      "investment",
      "growth",
      "finance",
      "stocks",
      "mutual fund",
    ],
    keywords: [
      "cagr calculator",
      "compound annual growth rate calculator",
      "cagr calculator india",
      "cagr return calculator",
      "investment cagr calculator",
      "annualized return calculator",
      "cagr formula calculator",
      "stock cagr calculator",
      "mutual fund cagr calculator",
      "cagr of investment",
      "absolute vs cagr return",
      "investment growth rate calculator",
      "how to calculate cagr",
    ],
    icon: "📊",
    url: "/tools/cagr-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "lumpsum-calculator",
      "sip-calculator",
      "fd-calculator",
      "ppf-calculator",
      "emi-calculator",
    ],
    faq: [
      {
        question: "What is CAGR (Compound Annual Growth Rate)?",
        answer:
          "CAGR is the rate at which an investment would have grown if it had grown at a steady rate each year and compounded annually. It smooths out year-to-year volatility into a single annualised return, making it the standard way to compare investments over multi-year periods.",
      },
      {
        question: "How is CAGR calculated?",
        answer:
          "CAGR = (Ending Value ÷ Beginning Value)^(1 ÷ Years) − 1. For example, an investment that grows from ₹1,00,000 to ₹2,00,000 over 5 years has a CAGR of (2)^(1/5) − 1 ≈ 14.87% per annum.",
      },
      {
        question: "What is the difference between CAGR and absolute return?",
        answer:
          "Absolute return is the total percentage gain over the whole period — (Ending − Beginning) ÷ Beginning × 100 — and ignores time. CAGR annualises that return using compounding, so it tells you the equivalent steady yearly growth rate. For periods longer than a year, CAGR is the more meaningful comparison; SEBI requires mutual fund returns over one year to be shown as CAGR.",
      },
      {
        question: "Can CAGR be negative?",
        answer:
          "Yes. If the ending value is lower than the beginning value, the CAGR is negative, indicating an annualised loss. For example, ₹1,00,000 falling to ₹50,000 over 2 years gives a CAGR of about −29.29% per annum. The calculation is valid as long as the beginning value is positive and the ending value is not negative.",
      },
      {
        question: "What are the limitations of CAGR?",
        answer:
          "CAGR assumes smooth, steady growth and only uses the beginning and ending values — it ignores volatility and any interim highs, lows, or additional cash flows. For investments with periodic contributions (like a SIP), XIRR is a more accurate measure. CAGR is best for a single lump-sum investment measured between two points in time.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "lumpsum-calculator",
    name: "Lumpsum Calculator",
    slug: "lumpsum-calculator",
    description:
      "Calculate the future value of a one-time (lumpsum) investment at an expected annual return. Shows estimated returns, maturity value, wealth gain %, CAGR, investment multiple, and a year-wise growth projection.",
    category: "calculator",
    tags: ["lumpsum", "investment", "calculator", "mutual fund", "returns", "compound", "finance"],
    keywords: [
      "lumpsum calculator",
      "lumpsum investment calculator",
      "lumpsum calculator india",
      "mutual fund lumpsum calculator",
      "one time investment calculator",
      "lumpsum return calculator",
      "lumpsum maturity calculator",
      "future value calculator",
      "lumpsum vs sip calculator",
      "investment growth calculator",
      "compound interest investment calculator",
      "lumpsum sip calculator",
      "one time mutual fund investment",
    ],
    icon: "💵",
    url: "/tools/lumpsum-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "sip-calculator",
      "fd-calculator",
      "rd-calculator",
      "ppf-calculator",
      "cagr-calculator",
      "emi-calculator",
    ],
    faq: [
      {
        question: "What is a lumpsum investment?",
        answer:
          "A lumpsum investment is a one-time deposit of a fixed amount into an instrument such as a mutual fund, rather than investing gradually over time. The entire amount is invested at once and grows through compounding until maturity.",
      },
      {
        question: "How is lumpsum maturity value calculated?",
        answer:
          "Lumpsum maturity uses the future-value formula: FV = P × (1 + r)^t, where P is the initial investment, r is the expected annual return (as a decimal), and t is the investment period in years. Estimated returns = FV − P.",
      },
      {
        question: "What is the difference between lumpsum and SIP?",
        answer:
          "A lumpsum invests the whole amount at once, while a SIP (Systematic Investment Plan) invests a fixed amount at regular intervals. Lumpsum benefits fully from compounding over the entire period and tends to do better in steadily rising markets, whereas a SIP averages the purchase cost over time (rupee cost averaging) and reduces the impact of market volatility.",
      },
      {
        question: "Why does the calculator show CAGR equal to the expected return?",
        answer:
          "For a lumpsum growing at a constant annual rate, the Compound Annual Growth Rate (CAGR) is mathematically identical to the expected annual return: CAGR = (FV/P)^(1/t) − 1 = r. It is shown separately for clarity and to compare with market-linked, variable-return scenarios.",
      },
      {
        question: "Can a lumpsum investment show a loss?",
        answer:
          "Yes. If you enter a negative expected annual return, the calculator projects a loss — for example, a −10% annual return shrinks the investment each year. At −100% the entire investment is lost. Market-linked investments carry risk, and past performance is not indicative of future results.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  {
    id: "home-loan-calculator",
    name: "Home Loan Calculator",
    slug: "home-loan-calculator",
    description:
      "Calculate your home loan EMI, total interest, and full amortization schedule. Includes processing fee, down payment, LTV, and the effective cost of borrowing for Indian home loans.",
    category: "calculator",
    tags: ["home loan", "emi", "mortgage", "calculator", "india", "housing", "loan", "finance"],
    keywords: [
      "home loan calculator",
      "home loan emi calculator",
      "housing loan calculator",
      "home loan calculator india",
      "sbi home loan calculator",
      "hdfc home loan emi calculator",
      "home loan amortization schedule",
      "home loan interest calculator",
      "mortgage calculator india",
      "home loan ltv calculator",
      "home loan processing fee calculator",
      "home loan repayment calculator",
      "home loan eligibility emi",
    ],
    icon: "🏠",
    url: "/tools/home-loan-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "emi-calculator",
      "personal-loan-calculator",
      "fd-calculator",
      "sip-calculator",
      "ppf-calculator",
    ],
    faq: [
      {
        question: "How is home loan EMI calculated?",
        answer:
          "Home loan EMI uses the standard reducing-balance formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is the loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100), and n is the tenure in months. Each EMI covers the interest on the outstanding balance plus a part of the principal, and the interest portion falls as the balance reduces.",
      },
      {
        question: "What is an amortization schedule?",
        answer:
          "An amortization schedule is a month-by-month table showing the opening balance, EMI, how much of each payment goes to principal and interest, and the closing balance after each payment. Early EMIs are interest-heavy; later EMIs are principal-heavy.",
      },
      {
        question: "What is Loan-to-Value (LTV)?",
        answer:
          "LTV is the loan amount as a percentage of the property value (loan ÷ (loan + down payment) × 100). As per RBI norms, lenders can finance up to 90% of the property value for loans up to ₹30 lakh, 80% for ₹30–75 lakh, and 75% above ₹75 lakh; the rest is your down payment.",
      },
      {
        question: "How does the processing fee work?",
        answer:
          "A processing fee is a one-time charge levied by the lender when the loan is sanctioned, usually 0.25% to 2% of the loan amount (sometimes capped). It is paid upfront and is not part of the EMI. This calculator adds it to the down payment to show your total initial cash outlay.",
      },
      {
        question: "Does a longer tenure reduce my EMI?",
        answer:
          "Yes. A longer tenure lowers the monthly EMI but increases the total interest paid over the life of the loan. A shorter tenure means a higher EMI but significantly lower total interest. The amortization schedule and interest-to-principal ratio help you compare both.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    featured: true,
    popular: true,
  },

  {
    id: "personal-loan-calculator",
    name: "Personal Loan Calculator",
    slug: "personal-loan-calculator",
    description:
      "Calculate your personal loan EMI, total interest, and full amortization schedule. Includes processing fee, total borrowing cost, and the effective cost of borrowing for Indian personal loans.",
    category: "calculator",
    tags: ["personal loan", "emi", "loan", "calculator", "india", "unsecured", "finance", "credit"],
    keywords: [
      "personal loan calculator",
      "personal loan emi calculator",
      "personal loan calculator india",
      "sbi personal loan calculator",
      "hdfc personal loan emi calculator",
      "personal loan interest calculator",
      "personal loan amortization schedule",
      "instant personal loan calculator",
      "personal loan repayment calculator",
      "personal loan processing fee calculator",
      "unsecured loan emi calculator",
      "personal loan eligibility emi",
      "loan emi calculator personal",
    ],
    icon: "💳",
    url: "/tools/personal-loan-calculator",
    version: "1.0.0",
    lastUpdated: "Jul 2025",
    relatedTools: [
      "emi-calculator",
      "home-loan-calculator",
      "fd-calculator",
      "sip-calculator",
      "rd-calculator",
      "ppf-calculator",
    ],
    faq: [
      {
        question: "How is personal loan EMI calculated?",
        answer:
          "Personal loan EMI uses the standard reducing-balance formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is the loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100), and n is the tenure in months. Interest is charged only on the outstanding balance, which reduces with every EMI.",
      },
      {
        question: "What is the reducing-balance method?",
        answer:
          "Under the reducing-balance (or diminishing-balance) method, interest each month is calculated on the remaining principal, not the original loan amount. As you repay, the outstanding balance falls, so the interest portion of each EMI shrinks and the principal portion grows. This is the method RBI-regulated banks use for personal loans, and it is cheaper than the flat-rate method.",
      },
      {
        question: "How does the processing fee work?",
        answer:
          "A processing fee is a one-time charge deducted when the loan is disbursed, usually 1% to 3% of the loan amount (sometimes with a cap). It is not part of the EMI. This calculator adds it to the total interest to show your Total Borrowing Cost and the effective cost of the loan.",
      },
      {
        question: "What is the Effective Cost of borrowing?",
        answer:
          "The effective cost here is the total cost of the loan — total interest plus the one-time processing fee — expressed as a percentage of the principal. It shows how much extra you pay overall to borrow. Note that this is a total-cost figure over the whole tenure, not an annualised APR.",
      },
      {
        question: "Is a personal loan secured?",
        answer:
          "No. A personal loan is unsecured, meaning it does not require collateral such as property or gold. Because there is no security, interest rates are usually higher than for home loans, and eligibility depends mainly on your income and credit score.",
      },
      {
        question: "Is my data sent to any server?",
        answer:
          "No. All calculations happen entirely in your browser using JavaScript. No data is sent to any server.",
      },
    ],
    popular: true,
  },

  // ─── Security ─────────────────────────────────────────────────────────────
  {
    id: "password-generator",
    name: "Password Generator",
    slug: "password-generator",
    description: "Generate strong, cryptographically secure passwords with custom rules.",
    category: "security",
    tags: ["password", "generator", "security", "random"],
    keywords: [
      "password generator online",
      "strong password generator",
      "random password",
      "secure password",
    ],
    icon: "🔑",
    url: "/tools/password-generator",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["hash-generator", "uuid-generator"],
    faq: [
      {
        question: "Are generated passwords stored anywhere?",
        answer:
          "No. Passwords are generated client-side using the Web Crypto API and are never sent to any server.",
      },
      {
        question: "What makes a password cryptographically secure?",
        answer:
          "The generator uses window.crypto.getRandomValues(), which uses the operating system's entropy source, making it suitable for security-sensitive applications.",
      },
      {
        question: "How long should my password be?",
        answer:
          "Security experts recommend at least 16 characters for most accounts and 24+ for high-value accounts.",
      },
    ],
    featured: true,
  },
  {
    id: "hash-generator",
    name: "Hash Generator",
    slug: "hash-generator",
    description: "Compute MD5, SHA-1, SHA-256, and SHA-512 hashes for any string.",
    category: "security",
    tags: ["hash", "md5", "sha256", "sha512", "security"],
    keywords: ["hash generator", "sha256 online", "md5 generator", "sha512 hash", "checksum"],
    icon: "🔏",
    url: "/tools/hash-generator",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["password-generator", "uuid-generator"],
    faq: [
      {
        question: "What is a hash function?",
        answer:
          "A hash function maps arbitrary-length input to a fixed-length output. The same input always produces the same hash, and it is computationally infeasible to reverse.",
      },
      {
        question: "Is MD5 still safe to use?",
        answer:
          "MD5 is broken for security purposes (collision attacks exist). Use SHA-256 or SHA-512 for integrity verification.",
      },
    ],
    popular: true,
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    slug: "uuid-generator",
    description: "Generate RFC-4122 compliant UUIDs (v4) in bulk with one click.",
    category: "generator",
    tags: ["uuid", "guid", "generator", "random"],
    keywords: ["uuid generator online", "guid generator", "random uuid", "uuid v4"],
    icon: "🆔",
    url: "/tools/uuid-generator",
    version: "1.0.0",
    lastUpdated: "Jan 2025",
    relatedTools: ["hash-generator", "password-generator"],
    faq: [
      {
        question: "What is a UUID?",
        answer:
          "A UUID (Universally Unique Identifier) is a 128-bit label used to uniquely identify objects in computer systems without central coordination.",
      },
      {
        question: "What is the difference between UUID v4 and other versions?",
        answer:
          "UUID v4 is randomly generated. v1 is time-based, v3/v5 are name-based (hashed). v4 is the most common for general-purpose unique IDs.",
      },
    ],
    isNew: true,
  },
];

// ─── Slug index (O(1) lookup) ────────────────────────────────────────────────

const _slugIndex = new Map<string, Tool>(toolRegistry.map((t) => [t.slug, t]));

// ─── Query helpers ──────────────────────────────────────────────────────────

export function getTools(filter?: ToolFilter): Tool[] {
  let tools = [...toolRegistry];

  if (filter?.category) {
    tools = tools.filter((t) => t.category === filter.category);
  }
  if (filter?.featured) {
    tools = tools.filter((t) => t.featured === true);
  }
  if (filter?.popular) {
    tools = tools.filter((t) => t.popular === true);
  }
  if (filter?.isNew) {
    tools = tools.filter((t) => t.isNew === true);
  }
  if (filter?.query) {
    const q = filter.query.toLowerCase();
    tools = tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return tools;
}

export function getFeaturedTools(): Tool[] {
  return getTools({ featured: true });
}

export function getPopularTools(): Tool[] {
  return getTools({ popular: true });
}

export function getNewTools(): Tool[] {
  return getTools({ isNew: true });
}

export function getToolBySlug(slug: string): Tool | undefined {
  return _slugIndex.get(slug);
}

export function getToolCount(): number {
  return toolRegistry.length;
}
