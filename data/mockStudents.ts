import {
  StudentProfile,
  LeaderboardEntry,
  LearningMaterial,
  LibraryBook,
  BorrowRecord,
  StudentDirectoryEntry,
} from "@/types/student";

// TEMP: replace with a Supabase query resolving the active grading period.
export const CURRENT_QUARTER = "4th Quarter";

// TEMP: replace with a Supabase query joining students + grades + stat computations.
export const CURRENT_STUDENT: StudentProfile = {
  id: "s-001",
  name: "Miguel Santos",
  initials: "MS",
  gradeLevel: 10,
  section: "Zeus",
  quarter: CURRENT_QUARTER,
  overallRank: "S",
  academicExcellence: 91,
  stats: { academic: 88, physical: 72, charisma: 80 },
  subjectStats: [
    { subject: "Mathematics", statLabel: "Logic", category: "academic", value: 92, rank: "S" },
    { subject: "English", statLabel: "Communication", category: "academic", value: 85, rank: "A" },
    { subject: "Science", statLabel: "Insight", category: "academic", value: 89, rank: "S" },
    { subject: "PE", statLabel: "Physical", category: "physical", value: 72, rank: "B" },
    { subject: "Participation", statLabel: "Social", category: "charisma", value: 80, rank: "A" },
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
  },
];

export const LIBRARY_BOOKS: LibraryBook[] = [
  {
    id: "bk-001",
    title: "The Secret Garden",
    author: "Frances Hodgson Burnett",
    genre: "Fiction",
    description: "A lonely girl discovers a hidden, neglected garden and slowly brings it back to life, along with the people around her.",
    status: "available",
  },
  {
    id: "bk-002",
    title: "Science Explorer: Physics",
    author: "Anna V. Lee",
    genre: "Reference",
    description: "A visual guide to core physics concepts — motion, energy, and forces — explained with real-world examples.",
    status: "borrowed",
    borrowedDate: "2026-07-03",
    dueDate: "2026-07-17",
  },
  {
    id: "bk-003",
    title: "Philippine History for Young Readers",
    author: "Jose P. Laurel",
    genre: "Social Studies",
    description: "A concise walkthrough of Philippine history from pre-colonial times to the present, written for younger students.",
    status: "available",
  },
  {
    id: "bk-004",
    title: "Accelerated Math Challenges",
    author: "Mia Santos",
    genre: "Mathematics",
    description: "Challenge problems and worked solutions for students who want to go beyond the regular curriculum.",
    status: "borrowed",
    borrowedDate: "2026-07-01",
    dueDate: "2026-07-15",
  },
  {
    id: "bk-005",
    title: "The Grammar Companion",
    author: "Ruth D. Alvarez",
    genre: "English",
    description: "A friendly reference for grammar rules, common mistakes, and how to fix them, with practice exercises.",
    status: "available",
  },
  {
    id: "bk-006",
    title: "Introduction to Robotics",
    author: "Carlos Fernandez",
    genre: "Technology",
    description: "Beginner-friendly introduction to robotics concepts, sensors, and simple programmable builds.",
    status: "available",
  },
  {
    id: "bk-007",
    title: "World Atlas for Students",
    author: "Global Learning Press",
    genre: "Reference",
    description: "An illustrated atlas covering countries, capitals, and geography basics for young learners.",
    status: "available",
  },
  {
    id: "bk-008",
    title: "The Chemistry of Everyday Life",
    author: "Dr. Liza Montano",
    genre: "Science",
    description: "Explains the chemistry behind everyday things — cooking, cleaning, weather — in plain language.",
    status: "available",
  },
  {
    id: "bk-009",
    title: "Public Speaking for Students",
    author: "Ramon Cruz",
    genre: "English",
    description: "Practical tips for building confidence, structuring a speech, and handling nerves before presentations.",
    status: "available",
  },
  {
    id: "bk-010",
    title: "Philippine Folk Tales",
    author: "Aida Rivera-Ford",
    genre: "Fiction",
    description: "A collection of classic Filipino folk tales and legends, retold for a new generation of readers.",
    status: "available",
  },
];

export const BORROW_HISTORY: BorrowRecord[] = [
  { id: "h1", bookId: "bk-004", title: "Accelerated Math Challenges", action: "Borrowed", date: "2026-07-01", dueDate: "2026-07-15" },
  { id: "h2", bookId: "bk-002", title: "Science Explorer: Physics", action: "Borrowed", date: "2026-07-03", dueDate: "2026-07-17" },
  { id: "h3", bookId: "bk-003", title: "Philippine History for Young Readers", action: "Returned", date: "2026-06-20" },
  { id: "h4", bookId: "bk-010", title: "Philippine Folk Tales", action: "Borrowed", date: "2026-06-10", dueDate: "2026-06-24" },
  { id: "h5", bookId: "bk-010", title: "Philippine Folk Tales", action: "Returned", date: "2026-06-22" },
  { id: "h6", bookId: "bk-006", title: "Introduction to Robotics", action: "Borrowed", date: "2026-05-28", dueDate: "2026-06-11" },
  { id: "h7", bookId: "bk-006", title: "Introduction to Robotics", action: "Returned", date: "2026-06-09" },
  { id: "h8", bookId: "bk-001", title: "The Secret Garden", action: "Borrowed", date: "2026-05-05", dueDate: "2026-05-19" },
  { id: "h9", bookId: "bk-001", title: "The Secret Garden", action: "Returned", date: "2026-05-17" },
];

export const STUDENT_DIRECTORY: StudentDirectoryEntry[] = [
  { id: "s-010", name: "Andrea Cruz", initials: "AC", gradeLevel: 10, section: "Zeus", overallRank: "S++", favoriteSubject: "Mathematics", tags: ["Top Scholar", "Debate Club"], bio: "Loves a good proof and an even better debate.", stats: { academic: 97, physical: 68, charisma: 90 } },
  { id: "s-014", name: "Bea Reyes", initials: "BR", gradeLevel: 10, section: "Zeus", overallRank: "S", favoriteSubject: "Science", tags: ["Eco Leader", "Science Fair"], bio: "Runs the school's recycling drive and never misses a lab.", stats: { academic: 90, physical: 74, charisma: 82 } },
  { id: "s-022", name: "Carlo Dizon", initials: "CD", gradeLevel: 10, section: "Zeus", overallRank: "A", favoriteSubject: "English", tags: ["Writer", "Orator"], bio: "Writes short stories and joins every declamation contest.", stats: { academic: 84, physical: 65, charisma: 88 } },
  { id: "s-031", name: "Ella Ramos", initials: "ER", gradeLevel: 10, section: "Zeus", overallRank: "A", favoriteSubject: "PE", tags: ["Athlete", "Team Captain"], bio: "Team captain for volleyball, big on team spirit.", stats: { academic: 78, physical: 95, charisma: 84 } },
  { id: "s-042", name: "Jomar Villa", initials: "JV", gradeLevel: 10, section: "Zeus", overallRank: "B", favoriteSubject: "Science", tags: ["Lab Partner", "Robot Club"], bio: "Building a line-following robot for the fair.", stats: { academic: 74, physical: 70, charisma: 66 } },
  { id: "s-055", name: "Kyla Mendoza", initials: "KM", gradeLevel: 9, section: "Poseidon", overallRank: "B", favoriteSubject: "Mathematics", tags: ["Quiz Bee", "Math Circle"], bio: "Practices for the regional math quiz bee every weekend.", stats: { academic: 76, physical: 60, charisma: 72 } },
];

export const TEACHER_PROFILE = {
  id: "t-001",
  name: "Ms. Daniela Fernandez",
  initials: "DF",
  subject: "Science",
  gradeLevel: "10",
  section: "Zeus",
  quarter: CURRENT_QUARTER,
  email: "d.fernandez@csa.edu",
  office: "Room 204",
  experienceYears: 8,
  focus: "Science and robotics enrichment",
};

export const CLASS_STUDENTS = STUDENT_DIRECTORY;

export const TEACHER_DIRECTORY = [
  {
    id: "t-001",
    name: "Ms. Daniela Fernandez",
    initials: "DF",
    subject: "Science",
    office: "Room 204",
    bio: "Runs the science and robotics enrichment program.",
    tags: ["Science", "Robotics Club"],
  },
  {
    id: "t-010",
    name: "Mr. Ramon Cruz",
    initials: "RC",
    subject: "Mathematics",
    office: "Room 108",
    bio: "Teaches Grade 10 Mathematics and coaches the Math Circle.",
    tags: ["Mathematics", "Math Circle"],
  },
  {
    id: "t-014",
    name: "Ms. Carmela Santos",
    initials: "CS",
    subject: "English",
    office: "Room 112",
    bio: "Teaches English and advises the school paper.",
    tags: ["English", "School Paper"],
  },
  {
    id: "t-022",
    name: "Coach Bea Reyes",
    initials: "BR",
    subject: "PE",
    office: "Gym Office",
    bio: "PE teacher and varsity volleyball coach.",
    tags: ["PE", "Volleyball"],
  },
];

export const ADMIN_PROFILE = {
  id: "a-001",
  name: "Rafael Ortega",
  initials: "RO",
  roleLabel: "System Admin",
};

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
