export interface Friend {
  id: string;
  name: string;
  initials: string;
  note?: string;
  isCurrentUser?: boolean;
  dayImage?: string;
  viewers?: string[];
}

export const FRIENDS: Friend[] = [
  {
    id: "s-001",
    name: "You",
    initials: "MS",
    isCurrentUser: true,
    note: "Studying for finals",
    dayImage: "/myday/md1.jpg",
    viewers: ["Andrea", "Bea", "Jomar"],
  },
  { id: "s-010", name: "Andrea", initials: "AC", note: "Coffee, books, and a green matcha", dayImage: "/myday/md2.jpg" },
  { id: "s-014", name: "Bea", initials: "BR" },
  { id: "s-022", name: "Carlo", initials: "CD" },
  { id: "s-031", name: "Ella", initials: "ER" },
  { id: "s-042", name: "Jomar", initials: "JV" },
];
