export type StatCategory = "academic" | "physical" | "charisma";

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
  coverUrl?: string;
  isbn?: string;
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

