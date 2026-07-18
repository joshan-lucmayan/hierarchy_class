import {
  StudentProfile,
  LeaderboardEntry,
  LearningMaterial,
  LibraryBook,
  BorrowRecord,
  StudentDirectoryEntry,
} from "@/types/student";

// TEMP: replace with a Supabase query joining students + grades + stat computations.
export const CURRENT_STUDENT: StudentProfile = {
  id: "s-001",
  name: "Miguel Santos",
  initials: "MS",
  gradeLevel: 10,
  section: "Zeus",
  overallRank: "S",
  academicExcellence: 91,
  stats: { academic: 88, physical: 72, charisma: 80 },
  subjectStats: [
    { subject: "Mathematics", statLabel: "Logic", category: "academic", value: 92, rank: "S" },
    { subject: "English", statLabel: "Communication", category: "academic", value: 85, rank: "A" },
    { subject: "Science", statLabel: "Insight", category: "academic", value: 89, rank: "S" },
    { subject: "PE", statLabel: "Physical", category: "physical", value: 72, rank: "B" },
    { subject: "Participation", statLabel: "Charisma", category: "charisma", value: 80, rank: "A" },
  ],
  bio: "Aspiring engineer who likes solving puzzles and helping classmates with math.",
  hobbies: ["Chess", "Basketball", "Reading manga"],
  interests: ["Robotics", "Astronomy"],
  favoriteSubject: "Mathematics",
  tags: ["Math Wizard", "Team Player"],
};

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, student: { id: "s-010", name: "Andrea Cruz", initials: "AC", gradeLevel: 10, section: "Zeus", overallRank: "S++", academicExcellence: 98 } },
  { rank: 2, student: { id: "s-001", name: "Miguel Santos", initials: "MS", gradeLevel: 10, section: "Zeus", overallRank: "S", academicExcellence: 91 } },
  { rank: 3, student: { id: "s-014", name: "Bea Reyes", initials: "BR", gradeLevel: 10, section: "Zeus", overallRank: "S", academicExcellence: 90 } },
  { rank: 4, student: { id: "s-022", name: "Carlo Dizon", initials: "CD", gradeLevel: 10, section: "Zeus", overallRank: "A", academicExcellence: 84 } },
  { rank: 5, student: { id: "s-031", name: "Ella Ramos", initials: "ER", gradeLevel: 10, section: "Zeus", overallRank: "A", academicExcellence: 81 } },
  { rank: 6, student: { id: "s-042", name: "Jomar Villa", initials: "JV", gradeLevel: 10, section: "Zeus", overallRank: "B", academicExcellence: 74 } },
];

export const LEARNING_MATERIALS: LearningMaterial[] = [
  {
    id: "lm-001",
    title: "Algebra Practice: Linear Equations",
    subject: "Mathematics",
    gradeLevel: 10,
    type: "Worksheet",
    uploadedBy: "Mr. Cruz",
    uploadDate: "2026-07-09",
    description: "Solve the set of linear equations with one variable and graph the results.",
    url: "#",
  },
  {
    id: "lm-002",
    title: "Reading Comprehension: Philippine Heroes",
    subject: "English",
    gradeLevel: 10,
    type: "Article",
    uploadedBy: "Ms. Santos",
    uploadDate: "2026-07-06",
    description: "Read the short profiles of national heroes and answer the comprehension questions.",
    url: "#",
  },
  {
    id: "lm-003",
    title: "Science Lab: Energy Transformation",
    subject: "Science",
    gradeLevel: 10,
    type: "Video",
    uploadedBy: "Ms. Fernandez",
    uploadDate: "2026-07-08",
    description: "Watch the lab walkthrough and complete the worksheet after the video.",
    url: "#",
  },
  {
    id: "lm-004",
    title: "PE Warm-up Routine",
    subject: "PE",
    gradeLevel: 10,
    type: "Guide",
    uploadedBy: "Coach Reyes",
    uploadDate: "2026-07-05",
    description: "Perform the warm-up drills before practical PE classes.",
    url: "#",
  },
  {
    id: "lm-005",
    title: "Study Guide: Earth and Space",
    subject: "Science",
    gradeLevel: 9,
    type: "Worksheet",
    uploadedBy: "Ms. Fernandez",
    uploadDate: "2026-06-28",
    description: "Review the Earth, moon, and planetary motion topics.",
    url: "#",
  },
];

export const LIBRARY_BOOKS: LibraryBook[] = [
  {
    id: "bk-001",
    title: "The Secret Garden",
    author: "Frances Hodgson Burnett",
    genre: "Fiction",
    status: "available",
  },
  {
    id: "bk-002",
    title: "Science Explorer: Physics",
    author: "Anna V. Lee",
    genre: "Reference",
    status: "borrowed",
    borrowedDate: "2026-07-03",
    dueDate: "2026-07-17",
  },
  {
    id: "bk-003",
    title: "Philippine History for Young Readers",
    author: "Jose P. Laurel",
    genre: "Social Studies",
    status: "available",
  },
  {
    id: "bk-004",
    title: "Accelerated Math Challenges",
    author: "Mia Santos",
    genre: "Mathematics",
    status: "borrowed",
    borrowedDate: "2026-07-01",
    dueDate: "2026-07-15",
  },
];

export const BORROW_HISTORY: BorrowRecord[] = [
  { id: "h1", bookId: "bk-004", title: "Accelerated Math Challenges", action: "Borrowed", date: "2026-07-01", dueDate: "2026-07-15" },
  { id: "h2", bookId: "bk-002", title: "Science Explorer: Physics", action: "Borrowed", date: "2026-07-03", dueDate: "2026-07-17" },
  { id: "h3", bookId: "bk-003", title: "Philippine History for Young Readers", action: "Returned", date: "2026-06-20" },
];

export const STUDENT_DIRECTORY: StudentDirectoryEntry[] = [
  { id: "s-010", name: "Andrea Cruz", initials: "AC", gradeLevel: 10, section: "Zeus", overallRank: "S++", favoriteSubject: "Mathematics", tags: ["Top Scholar", "Debate Club"] },
  { id: "s-014", name: "Bea Reyes", initials: "BR", gradeLevel: 10, section: "Zeus", overallRank: "S", favoriteSubject: "Science", tags: ["Eco Leader", "Science Fair"] },
  { id: "s-022", name: "Carlo Dizon", initials: "CD", gradeLevel: 10, section: "Zeus", overallRank: "A", favoriteSubject: "English", tags: ["Writer", "Orator"] },
  { id: "s-031", name: "Ella Ramos", initials: "ER", gradeLevel: 10, section: "Zeus", overallRank: "A", favoriteSubject: "PE", tags: ["Athlete", "Team Captain"] },
  { id: "s-042", name: "Jomar Villa", initials: "JV", gradeLevel: 10, section: "Zeus", overallRank: "B", favoriteSubject: "Science", tags: ["Lab Partner", "Robot Club"] },
  { id: "s-055", name: "Kyla Mendoza", initials: "KM", gradeLevel: 9, section: "Poseidon", overallRank: "B", favoriteSubject: "Mathematics", tags: ["Quiz Bee", "Math Circle"] },
];

export const TEACHER_PROFILE = {
  id: "t-001",
  name: "Ms. Daniela Fernandez",
  initials: "DF",
  subject: "Science",
  gradeLevel: "10",
  section: "Zeus",
  email: "d.fernandez@csa.edu",
  office: "Room 204",
  experienceYears: 8,
  focus: "Science and robotics enrichment",
};

export const CLASS_STUDENTS = STUDENT_DIRECTORY;

export const PENDING_GRADE_SUBMISSIONS = [
  {
    id: "ps-001",
    teacher: "Ms. Fernandez",
    subject: "Science",
    level: "Grade 10 · Zeus",
    submittedAt: "2026-07-15",
    status: "pending",
    students: [
      { studentId: "s-001", name: "Miguel Santos", grade: "83" },
      { studentId: "s-014", name: "Bea Reyes", grade: "89" },
      { studentId: "s-022", name: "Carlo Dizon", grade: "78" },
    ],
  },
  {
    id: "ps-002",
    teacher: "Mr. Cruz",
    subject: "Mathematics",
    level: "Grade 10 · Zeus",
    submittedAt: "2026-07-14",
    status: "pending",
    students: [
      { studentId: "s-010", name: "Andrea Cruz", grade: "97" },
      { studentId: "s-031", name: "Ella Ramos", grade: "88" },
      { studentId: "s-042", name: "Jomar Villa", grade: "76" },
    ],
  },
];

export const ANNOUNCEMENTS = [
  { id: "a1", title: "Intramurals sign-up open", body: "Register your team by Friday." },
  { id: "a2", title: "New learning materials: Physics Ch. 4", body: "Uploaded by Ms. Fernandez." },
];
