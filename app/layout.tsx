import type { Metadata } from "next";
import "./globals.css";
import { QuizProvider } from "@/lib/quizStore";

export const metadata: Metadata = {
  title: "Hierarchy Class",
  description: "Climb the ranks — gamified academic tracking for Grade 1-10 students",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QuizProvider>{children}</QuizProvider>
      </body>
    </html>
  );
}
