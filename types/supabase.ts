export type Role = "student" | "teacher" | "admin";

export interface ProfileRow {
  id: string;
  user_id: string;
  role: Role;
  school_id: string;
  full_name: string;
  grade_level: number | null;
  section: string | null;
  favorite_subject: string | null;
  created_at: string;
}

export interface SchoolRow {
  id: string;
  name: string;
  abbreviation: string;
  active: boolean;
  createdAt: string;
}

export interface LearningMaterialRow {
  id: string;
  title: string;
  subject: string;
  grade_level: number;
  type: string;
  uploaded_by: string;
  upload_date: string;
  description: string;
  url: string | null;
  school_id: string;
}

export interface LibraryBookRow {
  id: string;
  title: string;
  author: string;
  genre: string;
  status: string;
  borrowed_date: string | null;
  due_date: string | null;
  school_id: string;
}

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow;
        Insert: Omit<SchoolRow, "id" | "createdAt"> & {
          id?: string;
          createdAt?: string;
        };
        Update: Partial<Omit<SchoolRow, "id" | "createdAt">> & {
          id?: string;
          createdAt?: string;
        };
      };
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProfileRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      learning_materials: {
        Row: LearningMaterialRow;
        Insert: Omit<LearningMaterialRow, "id"> & {
          id?: string;
        };
        Update: Partial<Omit<LearningMaterialRow, "id">> & {
          id?: string;
        };
      };
      library_books: {
        Row: LibraryBookRow;
        Insert: Omit<LibraryBookRow, "id"> & {
          id?: string;
        };
        Update: Partial<Omit<LibraryBookRow, "id">> & {
          id?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      Role: "student" | "teacher" | "admin";
    };
  };
}
