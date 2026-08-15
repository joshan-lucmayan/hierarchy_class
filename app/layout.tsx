import type { Metadata } from "next";
import "./globals.css";
import { QuizProvider } from "@/lib/quizStore";
import { ChatProvider } from "@/lib/chatStore";
import { LibraryProvider } from "@/lib/libraryStore";
import { BannerProvider } from "@/lib/bannerStore";
import { FlorinProvider } from "@/lib/florinStore";
import { HabitProvider } from "@/lib/habitStore";
import { TeacherWorkspaceProvider } from "@/lib/teacherWorkspaceStore";
import { TeacherTasksProvider } from "@/lib/teacherTasksStore";
import { FriendsProvider } from "@/lib/friendsStore";
import { ClassroomHierarchyProvider } from "@/lib/classroomHierarchyStore";
import { NotificationsProvider } from "@/lib/notificationsStore";
import { StoriesProvider } from "@/lib/storiesStore";
import { SchoolFeedProvider } from "@/lib/schoolFeedStore";
import { MaterialsProvider } from "@/lib/materialsStore";
import { RankProvider } from "@/lib/rankStore";

export const metadata: Metadata = {
  title: "Hierarchy Class",
  description: "Climb the ranks - gamified academic tracking for students, teachers, and campuses",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-64x64.png", type: "image/png", sizes: "64x64" },
    ],
    apple: "/apple-touch-icon.png",
  },
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
        <MaterialsProvider>
          <SchoolFeedProvider>
            <StoriesProvider>
              <NotificationsProvider>
                <QuizProvider>
                  <ChatProvider>
                    <LibraryProvider>
                      <BannerProvider>
                        <FlorinProvider>
                          <HabitProvider>
                            <TeacherWorkspaceProvider>
                            <ClassroomHierarchyProvider>
                              <TeacherTasksProvider>
                                <RankProvider>
                                  <FriendsProvider>{children}</FriendsProvider>
                                </RankProvider>
                              </TeacherTasksProvider>
                            </ClassroomHierarchyProvider>
                          </TeacherWorkspaceProvider>
                          </HabitProvider>
                        </FlorinProvider>
                      </BannerProvider>
                    </LibraryProvider>
                  </ChatProvider>
                </QuizProvider>
                </NotificationsProvider>
              </StoriesProvider>
            </SchoolFeedProvider>
          </MaterialsProvider>
      </body>
    </html>
  );
}
