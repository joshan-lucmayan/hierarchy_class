import { AppShell } from "@/components/navigation/AppShell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="teacher" brandHref="/teacher/home">
      {children}
    </AppShell>
  );
}
