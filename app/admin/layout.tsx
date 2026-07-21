import { AppShell } from "@/components/navigation/AppShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="admin" brandHref="/admin/home">
      {children}
    </AppShell>
  );
}
