export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
}

export interface Conversation {
  id: string;
  name: string;
  initials: string;
  lastMessage: string;
  messages: ChatMessage[];
}

export const STUDENT_CONVERSATIONS: Conversation[] = [
  {
    id: "s-010",
    name: "Andrea",
    initials: "AC",
    lastMessage: "See you at the review session!",
    messages: [
      { id: "m1", from: "them", text: "Hey! Are you joining the math review later?" },
      { id: "m2", from: "me", text: "Yeah, what time?" },
      { id: "m3", from: "them", text: "See you at the review session!" },
    ],
  },
  {
    id: "s-014",
    name: "Bea",
    initials: "BR",
    lastMessage: "Thanks for the notes!",
    messages: [
      { id: "m1", from: "me", text: "Sent you my Science notes" },
      { id: "m2", from: "them", text: "Thanks for the notes!" },
    ],
  },
  {
    id: "s-042",
    name: "Jomar",
    initials: "JV",
    lastMessage: "Library at 3pm?",
    messages: [
      { id: "m1", from: "them", text: "Library at 3pm?" },
    ],
  },
];

export const TEACHER_CONVERSATIONS: Conversation[] = [
  {
    id: "admin-office",
    name: "Admin Office",
    initials: "AO",
    lastMessage: "Reminder: grade submissions close Friday.",
    messages: [
      { id: "m1", from: "them", text: "Hi Ms. Fernandez, just a reminder that Q4 grade submissions close this Friday." },
      { id: "m2", from: "me", text: "Noted, I'll have Grade 10 - Zeus submitted by tomorrow." },
      { id: "m3", from: "them", text: "Reminder: grade submissions close Friday." },
    ],
  },
  {
    id: "s-001",
    name: "Miguel Santos",
    initials: "MS",
    lastMessage: "Is there a make-up quiz for the one I missed?",
    messages: [
      { id: "m1", from: "them", text: "Good afternoon po, Ms. Fernandez." },
      { id: "m2", from: "them", text: "Is there a make-up quiz for the one I missed?" },
    ],
  },
  {
    id: "parent-cruz",
    name: "Mrs. Cruz (Parent)",
    initials: "MC",
    lastMessage: "Thank you for the update on Andrea's progress.",
    messages: [
      { id: "m1", from: "me", text: "Hi Mrs. Cruz, Andrea's Science grade improved this quarter - great work on her part." },
      { id: "m2", from: "them", text: "Thank you for the update on Andrea's progress." },
    ],
  },
];

export const ADMIN_CONVERSATIONS: Conversation[] = [
  {
    id: "t-001",
    name: "Ms. Daniela Fernandez",
    initials: "DF",
    lastMessage: "Grade 10 - Zeus submissions are in for review.",
    messages: [
      { id: "m1", from: "them", text: "Hi, Grade 10 - Zeus submissions are in for review." },
      { id: "m2", from: "me", text: "Thanks, I'll take a look today." },
    ],
  },
  {
    id: "t-010",
    name: "Mr. Ramon Cruz",
    initials: "RC",
    lastMessage: "Can I get an extra day for Math Circle grades?",
    messages: [
      { id: "m1", from: "them", text: "Can I get an extra day for Math Circle grades? A few students are still finishing makeups." },
    ],
  },
  {
    id: "it-support",
    name: "IT Support",
    initials: "IT",
    lastMessage: "Scheduled maintenance this weekend, 12am-2am.",
    messages: [
      { id: "m1", from: "them", text: "Scheduled maintenance this weekend, 12am-2am. The portal may be briefly unavailable." },
    ],
  },
];
