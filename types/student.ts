export type TierRank = "S++" | "S" | "A" | "B" | "C" | "D";

export type StatCategory = "academic" | "physical" | "charisma";

export interface SubjectStat {
  subject: string;
  statLabel: string; // e.g. "Logic", "Communication"
  category: StatCategory;
  value: number; // 0-100
  rank: TierRank;
}

export interface StudentProfile {
  id: string;
  name: string;
  initials: string;
  gradeLevel: number; // 1-10
  section: string; // e.g. "Zeus"
  quarter: string; // e.g. "4th Quarter"
  overallRank: TierRank;
  academicExcellence: number; // 0-100 composite
  stats: Record<StatCategory, number>; // 0-100 each
  subjectStats: SubjectStat[];
  bio: string;
  hobbies: string[];
  interests: string[];
  favoriteSubject: string;
  tags: string[];
}

export interface LeaderboardEntry {
  rank: number;
  student: Pick<StudentProfile, "id" | "name" | "initials" | "gradeLevel" | "section" | "overallRank" | "academicExcellence">;
}

export interface LearningMaterial {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  type: string;
  uploadedBy: string;
  uploadDate: string;
  description: string;
  url?: string;
}

export type LibraryStatus = "available" | "requested" | "borrowed";

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  status: LibraryStatus;
  borrowedBy?: string;
  borrowedByName?: string;
  borrowedDate?: string;
  dueDate?: string;
}

export interface BorrowRecord {
  id: string;
  bookId: string;
  title: string;
  action: "Borrowed" | "Returned";
  date: string;
  dueDate?: string;
}

export interface LibraryBorrowRequest {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  gradeSection: string;
  requestedAt: string;
}

export interface LibraryBorrowLogEntry {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  gradeSection: string;
  borrowedDate: string;
  returnedDate?: string;
}

export interface StudentDirectoryEntry {
  id: string;
  name: string;
  initials: string;
  gradeLevel: number;
  section: string;
  overallRank: TierRank;
  favoriteSubject: string;
  tags: string[];
  bio: string;
  stats: Record<StatCategory, number>;
}
