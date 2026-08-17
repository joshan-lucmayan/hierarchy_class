import { AppShell } from "@/components/navigation/AppShell";
import { AdminPrefsProvider } from "@/lib/adminPrefsStore";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="admin" brandHref="/admin/home">
      <AdminPrefsProvider>{children}</AdminPrefsProvider>
    </AppShell>
  );
}
