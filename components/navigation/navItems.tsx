import { TEACHER_PROFILE } from "@/data/mockStudents";

export type NavItem = {
  href?: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const iconProps = (active: boolean) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  className: active ? "text-navy" : "text-muted",
});

const messagesIcon = (active: boolean) => (
  <svg {...iconProps(active)}>
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);

export const STUDENT_NAV_ITEMS: NavItem[] = [
  {
    href: "/student/home",
    label: "Home",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M3 12l9-9 9 9" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/student/messages",
    label: "Messages",
    icon: messagesIcon,
  },
  {
    href: "/student/learning-materials",
    label: "Materials",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M4 19h16M4 5h16M4 12h16" />
      </svg>
    ),
  },
  {
    href: "/student/library",
    label: "Library",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M4 19V5h4v14M16 19V5h4v14M12 5v14" />
      </svg>
    ),
  },
  {
    href: "/student/quiz",
    label: "Quiz",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 1.5-2.5 3.5" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  {
    href: "/student/leaderboard",
    label: "Leaderboard",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M8 21V9M14 21V3M20 21v-6M4 21h16" />
      </svg>
    ),
  },
  {
    href: "/student/profile",
    label: "Profile",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    href: "/student/settings",
    label: "Settings",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 008.6 15a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0015 8.6a1.65 1.65 0 001.82.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9z" />
      </svg>
    ),
  },
];

export const TEACHER_NAV_ITEMS: NavItem[] = [
  {
    href: "/teacher/home",
    label: "Home",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M3 12l9-9 9 9" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/teacher/messages",
    label: "Messages",
    icon: messagesIcon,
  },
  {
    href: "/teacher/learning-materials",
    label: "Materials",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M4 19h16M4 5h16M4 12h16" />
      </svg>
    ),
  },
  {
    href: "/teacher/classroom",
    label: "Classroom",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    ),
  },
  {
    href: "/teacher/students",
    label: "Students",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="9" cy="7" r="3" />
        <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M15.5 21c.2-2.5 1.8-4.3 4-5" />
      </svg>
    ),
  },
  // TEMP: only teachers flagged as also managing the school library see this.
  // Once accounts are real, this should be filtered by the signed-in
  // teacher's own isLibrarian flag instead of the shared mock profile.
  ...(TEACHER_PROFILE.isLibrarian
    ? [
        {
          href: "/teacher/library-management",
          label: "Library Management",
          icon: (active: boolean) => (
            <svg {...iconProps(active)}>
              <path d="M4 19V5h4v14M16 19V5h4v14M12 5v14" />
              <circle cx="12" cy="9" r="2" />
            </svg>
          ),
        },
      ]
    : []),
  {
    href: "/teacher/settings",
    label: "Settings",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 008.6 15a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0015 8.6a1.65 1.65 0 001.82.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9z" />
      </svg>
    ),
  },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/home",
    label: "Dashboard",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/admin/messages",
    label: "Messages",
    icon: messagesIcon,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="9" cy="7" r="3" />
        <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M15.5 21c.2-2.5 1.8-4.3 4-5" />
      </svg>
    ),
  },
  {
    href: "/admin/programs",
    label: "Programs",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/students",
    label: "Students",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M22 10L12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
      </svg>
    ),
  },
  {
    href: "/admin/teachers",
    label: "Teachers",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 4v5" />
      </svg>
    ),
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M8 21V9M14 21V3M20 21v-6M4 21h16" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 008.6 15a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0015 8.6a1.65 1.65 0 001.82.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9z" />
      </svg>
    ),
  },
];
