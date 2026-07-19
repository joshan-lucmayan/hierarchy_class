export interface SchoolPost {
  id: string;
  tag: string;
  title: string;
  body: string;
  image: string;
}

export const SCHOOL_POSTS: SchoolPost[] = [
  {
    id: "post-1",
    tag: "Campaign",
    title: "Anti-Bullying Campaign",
    body: "Choose kindness. Stop harm. Build a safe school. Be an upstander, not a bystander.",
    image: "/feed/csa1p.jpg",
  },
  {
    id: "post-2",
    tag: "Enrollment",
    title: "Enrollment SY 2026-2027 Now Open",
    body: "Academic Track and Tech-Pro Track slots available. Training and education for a better life.",
    image: "/feed/csa2p.jpg",
  },
  {
    id: "post-3",
    tag: "Enrollment",
    title: "Class of 2026-2027",
    body: "Enroll now for Tech-Pro and Academic tracks. Visit us at 118 Gen. Luna St., San Agustin, Malabon City.",
    image: "/feed/csa3p.jpg",
  },
  {
    id: "post-4",
    tag: "Advisory",
    title: "#WalangPasok",
    body: "Classes are suspended due to weather conditions. Stay safe and check for updates before heading out.",
    image: "/feed/csa4p.jpg",
  },
];
