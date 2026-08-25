import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QuizProvider } from "@/lib/quizStore";
import { ChatProvider } from "@/lib/chatStore";
import { LibraryProvider } from "@/lib/libraryStore";
import { BannerProvider } from "@/lib/bannerStore";
import { FlorinProvider } from "@/lib/florinStore";
import { ShopProvider } from "@/lib/shopStore";
import { HabitProvider } from "@/lib/habitStore";
import { TeacherWorkspaceProvider } from "@/lib/teacherWorkspaceStore";
import { TeacherPrefsProvider } from "@/lib/teacherPrefsStore";
import { TeacherTasksProvider } from "@/lib/teacherTasksStore";
import { FriendsProvider } from "@/lib/friendsStore";
import { ClassroomHierarchyProvider } from "@/lib/classroomHierarchyStore";
import { NotificationsProvider } from "@/lib/notificationsStore";
import { StoriesProvider } from "@/lib/storiesStore";
import { SchoolFeedProvider } from "@/lib/schoolFeedStore";
import { MaterialsProvider } from "@/lib/materialsStore";
import { RankProvider } from "@/lib/rankStore";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { IOSInstallHint } from "@/components/pwa/IOSInstallHint";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eaed" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
};

export const metadata: Metadata = {
  title: "Hierarchy Class",
  description: "Make school feel like a game worth playing - gamified academic tracking for students, teachers, and campuses",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Hierarchy Class",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-64x64.png", type: "image/png", sizes: "64x64" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
    ],
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
                  var theme = saved === "dark" || saved === "pink" ? saved : "dark";
                  document.documentElement.classList.toggle("dark", theme === "dark");
                  document.documentElement.classList.toggle("pink", theme === "pink");
                  if (!saved) window.localStorage.setItem("hc-theme", "dark");
                } catch (e) {}
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
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
                          <ShopProvider>
                          <HabitProvider>
                            <TeacherWorkspaceProvider>
                            <TeacherPrefsProvider>
                            <ClassroomHierarchyProvider>
                              <TeacherTasksProvider>
                                <RankProvider>
                                  <FriendsProvider>{children}</FriendsProvider>
                                </RankProvider>
                              </TeacherTasksProvider>
                            </ClassroomHierarchyProvider>
                            </TeacherPrefsProvider>
                          </TeacherWorkspaceProvider>
                          </HabitProvider>
                          </ShopProvider>
                        </FlorinProvider>
                      </BannerProvider>
                    </LibraryProvider>
                  </ChatProvider>
                </QuizProvider>
                </NotificationsProvider>
              </StoriesProvider>
            </SchoolFeedProvider>
          </MaterialsProvider>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <IOSInstallHint />
      </body>
    </html>
  );
}
