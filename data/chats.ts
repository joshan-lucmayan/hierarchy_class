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

export const CONVERSATIONS: Conversation[] = [
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
