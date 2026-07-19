export interface Friend {
  id: string;
  name: string;
  initials: string;
  note?: string;
  isCurrentUser?: boolean;
  hasUpdate?: boolean;
}

export const FRIENDS: Friend[] = [
  { id: "s-001", name: "You", initials: "MS", isCurrentUser: true, note: "Studying for finals" },
  { id: "s-010", name: "Andrea", initials: "AC", note: "Top of the leaderboard", hasUpdate: true },
  { id: "s-014", name: "Bea", initials: "BR", hasUpdate: true },
  { id: "s-022", name: "Carlo", initials: "CD", note: "New PB in PE", hasUpdate: true },
  { id: "s-031", name: "Ella", initials: "ER", hasUpdate: false },
  { id: "s-042", name: "Jomar", initials: "JV", note: "Library grind", hasUpdate: true },
];
