export type Role = "student" | "teacher" | "admin";

// ============================================================================
// ROW TYPES (what you read from the DB)
// ============================================================================

export interface SchoolRow {
  id: string;
  name: string;
  abbreviation: string;
  active: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  user_id: string | null;
  school_id: string;
  role: Role;
  full_name: string;
  level_label: string | null;
  section: string | null;
  initials: string | null;
  bio: string | null;
  overall_rank: string;
  academic_excellence: number;
  favorite_subject: string | null;
  tags: string[];
  hobbies: string[];
  interests: string[];
  is_librarian: boolean;
  created_at: string;
}

export interface LearningMaterialRow {
  id: string;
  school_id: string;
  title: string;
  subject: string;
  level_label: string | null;
  type: string;
  uploaded_by: string;
  upload_date: string;
  description: string | null;
  url: string | null;
  created_at: string;
}

export interface LibraryBookRow {
  id: string;
  school_id: string;
  title: string;
  author: string;
  genre: string;
  status: string;
  borrowed_by: string | null;
  borrowed_by_name: string | null;
  borrowed_date: string | null;
  due_date: string | null;
  created_at: string;
}

export interface LibraryBorrowRequestRow {
  id: string;
  school_id: string;
  book_id: string;
  student_id: string;
  status: string;
  pickup_window: string | null;
  requested_at: string;
}

export interface LibraryBorrowLogRow {
  id: string;
  school_id: string;
  book_id: string;
  student_id: string;
  action: string;
  date: string;
}

export interface QuizRow {
  id: string;
  school_id: string;
  title: string;
  subject: string;
  level_label: string | null;
  time_limit_seconds: number;
  created_by: string;
  created_at: string;
}

export interface QuizQuestionRow {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
  created_at: string;
}

export interface QuizAttemptRow {
  id: string;
  school_id: string;
  student_id: string;
  quiz_id: string;
  score: number;
  total: number;
  completed_at: string;
}

export interface ConversationRow {
  id: string;
  school_id: string;
  participant_id: string;
  other_user_id: string;
  role: string;
  last_message: string | null;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  from_id: string | null;
  from_name: string;
  text: string;
  created_at: string;
}

export interface FriendsRow {
  id: string;
  school_id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
}

export interface SchoolFeedPostRow {
  id: string;
  school_id: string;
  tag: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
}

export interface BannerConfigRow {
  school_id: string;
  image_url: string | null;
  focal_y: number;
  updated_at: string;
}

export interface FlorinBalanceRow {
  student_id: string;
  balance: number;
  updated_at: string;
}

export type FlorinTransactionRow = {
  id: string;
  school_id: string;
  student_id: string;
  amount: number;
  reason: string | null;
  created_at: string;
};

// ============================================================================
// INSERT TYPES (for creating new rows)
// ============================================================================

export type SchoolInsert = Omit<SchoolRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ProfileInsert = {
  user_id: string;
  school_id: string;
  role: Role;
  full_name: string;
  level_label?: string | null;
  section?: string | null;
  initials?: string | null;
  bio?: string | null;
  overall_rank?: string;
  academic_excellence?: number;
  favorite_subject?: string | null;
  tags?: string[];
  hobbies?: string[];
  interests?: string[];
  is_librarian?: boolean;
};

export type LearningMaterialInsert = {
  school_id: string;
  title: string;
  subject: string;
  level_label?: string | null;
  type: string;
  uploaded_by: string;
  upload_date?: string;
  description?: string | null;
  url?: string | null;
};

export type LibraryBookInsert = {
  school_id: string;
  title: string;
  author: string;
  genre: string;
  status?: string;
  borrowed_by?: string | null;
  borrowed_by_name?: string | null;
  borrowed_date?: string | null;
  due_date?: string | null;
};

export type LibraryBorrowRequestInsert = Omit<LibraryBorrowRequestRow, "id" | "requested_at"> & {
  id?: string;
  requested_at?: string;
};

export type LibraryBorrowLogInsert = Omit<LibraryBorrowLogRow, "id"> & {
  id?: string;
};

export type QuizInsert = Omit<QuizRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type QuizQuestionInsert = Omit<QuizQuestionRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type QuizAttemptInsert = Omit<QuizAttemptRow, "id" | "completed_at"> & {
  id?: string;
  completed_at?: string;
};

export type ConversationInsert = {
  school_id: string;
  participant_id: string;
  other_user_id: string;
  role: string;
  last_message?: string | null;
};

export type ChatMessageInsert = {
  conversation_id: string;
  from_id?: string | null;
  from_name: string;
  text: string;
};

export type FriendsInsert = Omit<FriendsRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type SchoolFeedPostInsert = {
  school_id: string;
  tag: string;
  title: string;
  body: string;
  image_url?: string | null;
};

export type BannerConfigInsert = {
  school_id: string;
  image_url?: string | null;
  focal_y?: number;
};

export type FlorinBalanceInsert = {
  student_id: string;
  balance?: number;
};

export type FlorinTransactionInsert = {
  school_id: string;
  student_id: string;
  amount: number;
  reason?: string | null;
};

// ============================================================================
// DATABASE TYPE DEFINITION
// ============================================================================

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow;
        Insert: SchoolInsert;
        Update: Partial<Omit<SchoolRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<Omit<ProfileRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      learning_materials: {
        Row: LearningMaterialRow;
        Insert: LearningMaterialInsert;
        Update: Partial<Omit<LearningMaterialRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      library_books: {
        Row: LibraryBookRow;
        Insert: LibraryBookInsert;
        Update: Partial<Omit<LibraryBookRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      library_borrow_requests: {
        Row: LibraryBorrowRequestRow;
        Insert: LibraryBorrowRequestInsert;
        Update: Partial<Omit<LibraryBorrowRequestRow, "id" | "requested_at">> & {
          id?: string;
          requested_at?: string;
        };
      };
      library_borrow_log: {
        Row: LibraryBorrowLogRow;
        Insert: LibraryBorrowLogInsert;
        Update: Partial<Omit<LibraryBorrowLogRow, "id">> & {
          id?: string;
        };
      };
      quizzes: {
        Row: QuizRow;
        Insert: QuizInsert;
        Update: Partial<Omit<QuizRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      quiz_questions: {
        Row: QuizQuestionRow;
        Insert: QuizQuestionInsert;
        Update: Partial<Omit<QuizQuestionRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      quiz_attempts: {
        Row: QuizAttemptRow;
        Insert: QuizAttemptInsert;
        Update: Partial<Omit<QuizAttemptRow, "id" | "completed_at">> & {
          id?: string;
          completed_at?: string;
        };
      };
      conversations: {
        Row: ConversationRow;
        Insert: ConversationInsert;
        Update: Partial<Omit<ConversationRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: ChatMessageInsert;
        Update: Partial<Omit<ChatMessageRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      friends: {
        Row: FriendsRow;
        Insert: FriendsInsert;
        Update: Partial<Omit<FriendsRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      school_feed_posts: {
        Row: SchoolFeedPostRow;
        Insert: SchoolFeedPostInsert;
        Update: Partial<Omit<SchoolFeedPostRow, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      banner_config: {
        Row: BannerConfigRow;
        Insert: BannerConfigInsert;
        Update: Partial<Omit<BannerConfigRow, "updated_at">> & {
          updated_at?: string;
        };
      };
      florin_balances: {
        Row: FlorinBalanceRow;
        Insert: FlorinBalanceInsert;
        Update: Partial<Omit<FlorinBalanceRow, "updated_at">> & {
          updated_at?: string;
        };
      };
      florin_transactions: {
        Row: FlorinTransactionRow;
        Insert: FlorinTransactionInsert;
        Update: Partial<Omit<FlorinTransactionRow, "id">> & {
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
