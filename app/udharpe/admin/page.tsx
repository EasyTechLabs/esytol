import { AdminPanel } from "@/features/udharpe/admin/AdminPanel";

export const metadata = {
  title: "Udharpe — administration",
  robots: { index: false, follow: false },
};

export default function UdharpeAdminPage() {
  return <AdminPanel />;
}
