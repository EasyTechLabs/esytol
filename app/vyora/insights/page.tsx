import type { Metadata } from "next";
import { Insights } from "@/features/vyora/screens/Insights";

export const metadata: Metadata = {
  title: "Insights · Vyora",
  robots: { index: false, follow: false },
};

export default function InsightsPage() {
  return <Insights />;
}
