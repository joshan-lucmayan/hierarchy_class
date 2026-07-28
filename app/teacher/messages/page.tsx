import { Suspense } from "react";
import { MessengerView } from "@/components/chat/MessengerView";

export default function TeacherMessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessengerView role="teacher" />
    </Suspense>
  );
}
