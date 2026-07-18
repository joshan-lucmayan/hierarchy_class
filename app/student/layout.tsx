import { BottomNav } from "@/components/navigation/BottomNav";
import { StudentTopNav } from "@/components/navigation/StudentTopNav";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-6 py-6 xl:px-10">
        <main className="flex-1 rounded-[28px] border border-base bg-surface p-6 pb-24 xl:p-8 xl:pb-8">
          <StudentTopNav />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}