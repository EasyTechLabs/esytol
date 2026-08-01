import { FounderMode } from "@/features/vyora/screens/FounderMode";

export const metadata = {
  title: "Founder Mode · Vyora",
  // Hidden diagnostics: never indexed, never linked.
  robots: { index: false, follow: false },
};

export default function VyoraFounderPage() {
  return <FounderMode />;
}
