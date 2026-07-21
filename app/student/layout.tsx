import { AppShell } from "@/components/navigation/AppShell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="student" brandHref="/student/home">
      {children}
    </AppShell>
  );
}
