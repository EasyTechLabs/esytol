import type { Metadata } from "next";
import { ImportWizard } from "@/features/vyora/screens/ImportWizard";

export const metadata: Metadata = {
  title: "Import · Vyora",
  robots: { index: false, follow: false },
};

export default function ImportPage() {
  return <ImportWizard />;
}
