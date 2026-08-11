import type { Metadata } from "next";
import "./globals.css";
import { QuizProvider } from "@/lib/quizStore";
import { ChatProvider } from "@/lib/chatStore";
import { LibraryProvider } from "@/lib/libraryStore";
import { BannerProvider } from "@/lib/bannerStore";
import { FlorinProvider } from "@/lib/florinStore";
import { TeacherWorkspaceProvider } from "@/lib/teacherWorkspaceStore";
import { TeacherTasksProvider } from "@/lib/teacherTasksStore";
import { FriendsProvider } from "@/lib/friendsStore";
import { ClassroomHierarchyProvider } from "@/lib/classroomHierarchyStore";
import { NotificationsProvider } from "@/lib/notificationsStore";
import { StoriesProvider } from "@/lib/storiesStore";
import { SchoolFeedProvider } from "@/lib/schoolFeedStore";
import { MaterialsProvider } from "@/lib/materialsStore";

export const metadata: Metadata = {
  title: "Hierarchy Class",
  description: "Climb the ranks - gamified academic tracking for students, teachers, and campuses",
  icons: {
    icon: "/icon.svg",
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
                          <TeacherWorkspaceProvider>
                            <ClassroomHierarchyProvider>
                              <TeacherTasksProvider>
                                <FriendsProvider>{children}</FriendsProvider>
                              </TeacherTasksProvider>
                            </ClassroomHierarchyProvider>
                          </TeacherWorkspaceProvider>
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
