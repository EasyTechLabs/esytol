/**
 * Age Calculation Engine — calendar-accurate, leap-year aware.
 *
 * All functions are pure and take explicit calendar dates (no reliance on the
 * system clock), so results are deterministic and fully testable. The UI passes
 * "today" in as `asOf`.
 *
 * Method:
 *   - Age (years/months/days) is computed by finding the largest whole number of
 *     months between the two dates (with month-end clamping — e.g. Jan 31 + 1
 *     month = Feb 28/29), then the residual days between that anchor and the
 *     target date. This is correct for month-end births where naive borrowing
 *     fails.
 *   - Total units (days/weeks/hours/minutes/seconds) derive from the exact
 *     calendar day count between the dates (UTC midnight difference), so leap
 *     days are counted exactly and there is no DST drift.
 *
 * References: proleptic Gregorian calendar; ISO 8601 date representation.
 */

export interface DateParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

export interface NextBirthday {
  date: DateParts;
  dayOfWeek: string;
  daysUntil: number;
  turningAge: number;
  isToday: boolean;
}

export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  dayOfBirth: string;
  nextBirthday: NextBirthday;
}

export interface AgeDifference {
  /** Which input is older; "same" when identical. */
  older: "first" | "second" | "same";
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

export interface AgeValidationErrors {
  dob?: string;
  asOf?: string;
  dob2?: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Calendar primitives ───────────────────────────────────────────────────────

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1];
}

export function isValidDate(dp: DateParts): boolean {
  if (!Number.isInteger(dp.year) || !Number.isInteger(dp.month) || !Number.isInteger(dp.day)) {
    return false;
  }
  if (dp.year < 1 || dp.year > 9999) return false;
  if (dp.month < 1 || dp.month > 12) return false;
  return dp.day >= 1 && dp.day <= daysInMonth(dp.year, dp.month);
}

function toUTC(dp: DateParts): number {
  return Date.UTC(dp.year, dp.month - 1, dp.day);
}

/** Whole calendar days from `a` to `b` (negative if `b` is before `a`). */
export function daysBetween(a: DateParts, b: DateParts): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

/** Compare two dates: negative if a<b, 0 if equal, positive if a>b. */
export function compareDates(a: DateParts, b: DateParts): number {
  return toUTC(a) - toUTC(b);
}

export function weekdayOf(dp: DateParts): string {
  return WEEKDAYS[new Date(toUTC(dp)).getUTCDay()];
}

/** Add `n` months to a date with month-end clamping. */
export function addMonths(dp: DateParts, n: number): DateParts {
  const total = dp.month - 1 + n;
  const year = dp.year + Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  const day = Math.min(dp.day, daysInMonth(year, month));
  return { year, month, day };
}

// ── Age ───────────────────────────────────────────────────────────────────────

/** The date a birthday falls on in a given year (Feb 29 → Mar 1 in common years). */
export function birthdayInYear(birth: DateParts, year: number): DateParts {
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    return { year, month: 3, day: 1 };
  }
  return { year, month: birth.month, day: birth.day };
}

function computeNextBirthday(birth: DateParts, asOf: DateParts): NextBirthday {
  let year = asOf.year;
  let cand = birthdayInYear(birth, year);
  if (daysBetween(asOf, cand) < 0) {
    year += 1;
    cand = birthdayInYear(birth, year);
  }
  const daysUntil = daysBetween(asOf, cand);
  return {
    date: cand,
    dayOfWeek: weekdayOf(cand),
    daysUntil,
    turningAge: cand.year - birth.year,
    isToday: daysUntil === 0,
  };
}

export function calculateAge(birth: DateParts, asOf: DateParts): AgeResult {
  // Largest whole number of months between the dates (with month-end clamping).
  let totalMonths = (asOf.year - birth.year) * 12 + (asOf.month - birth.month);
  if (compareDates(addMonths(birth, totalMonths), asOf) > 0) {
    totalMonths -= 1;
  }
  const anchor = addMonths(birth, totalMonths);
  const days = daysBetween(anchor, asOf);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const totalDays = daysBetween(birth, asOf);

  return {
    years,
    months,
    days,
    totalMonths,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    totalHours: totalDays * 24,
    totalMinutes: totalDays * 24 * 60,
    totalSeconds: totalDays * 24 * 60 * 60,
    dayOfBirth: weekdayOf(birth),
    nextBirthday: computeNextBirthday(birth, asOf),
  };
}

export function ageDifference(a: DateParts, b: DateParts): AgeDifference {
  const cmp = compareDates(a, b);
  const older = cmp <= 0 ? a : b;
  const younger = cmp <= 0 ? b : a;
  const age = calculateAge(older, younger);
  return {
    older: cmp === 0 ? "same" : cmp < 0 ? "first" : "second",
    years: age.years,
    months: age.months,
    days: age.days,
    totalDays: daysBetween(older, younger),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateAgeInputs(
  birth: DateParts | null,
  asOf: DateParts,
  compare?: DateParts | null
): AgeValidationErrors {
  const errors: AgeValidationErrors = {};

  if (!birth) {
    errors.dob = "Enter your date of birth";
  } else if (!isValidDate(birth)) {
    errors.dob = "Enter a valid date of birth";
  } else if (compareDates(birth, asOf) > 0) {
    errors.dob = "Date of birth cannot be in the future";
  }

  if (!isValidDate(asOf)) {
    errors.asOf = "Enter a valid date";
  }

  if (compare !== undefined) {
    if (!compare) {
      errors.dob2 = "Enter the second date";
    } else if (!isValidDate(compare)) {
      errors.dob2 = "Enter a valid second date";
    }
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function resultToCSV(birth: DateParts, asOf: DateParts, r: AgeResult): string {
  const nb = r.nextBirthday;
  const rows: (string | number)[][] = [
    ["Metric", "Value"],
    ["Date of Birth", fmtDate(birth)],
    ["Calculated As Of", fmtDate(asOf)],
    ["Age (Years/Months/Days)", `${r.years}y ${r.months}m ${r.days}d`],
    ["Day of Birth", r.dayOfBirth],
    ["Total Months", r.totalMonths],
    ["Total Weeks", r.totalWeeks],
    ["Total Days", r.totalDays],
    ["Total Hours", r.totalHours],
    ["Total Minutes", r.totalMinutes],
    ["Total Seconds", r.totalSeconds],
    ["Next Birthday", fmtDate(nb.date)],
    ["Next Birthday Weekday", nb.dayOfWeek],
    ["Days Until Next Birthday", nb.daysUntil],
    ["Turning", nb.turningAge],
  ];
  return rows.map((r2) => r2.join(",")).join("\n");
}

export function fmtDate(dp: DateParts): string {
  const mm = String(dp.month).padStart(2, "0");
  const dd = String(dp.day).padStart(2, "0");
  return `${dp.year}-${mm}-${dd}`;
}

/** Parse an ISO "YYYY-MM-DD" string to DateParts, or null. */
export function parseDate(value: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const dp = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isValidDate(dp) ? dp : null;
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}
