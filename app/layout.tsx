import type { Metadata } from "next";
import "./globals.css";
import { QuizProvider } from "@/lib/quizStore";
import { ChatProvider } from "@/lib/chatStore";
import { LibraryProvider } from "@/lib/libraryStore";

export const metadata: Metadata = {
  title: "Hierarchy Class",
  description: "Climb the ranks — gamified academic tracking for Grade 1-10 students",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = window.localStorage.getItem("hc-theme");
                  var theme = saved === "light" || saved === "dark" ? saved : "dark";
                  document.documentElement.classList.toggle("dark", theme === "dark");
                  if (!saved) window.localStorage.setItem("hc-theme", "dark");
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <QuizProvider>
          <ChatProvider>
            <LibraryProvider>{children}</LibraryProvider>
          </ChatProvider>
        </QuizProvider>
      </body>
    </html>
  );
}
