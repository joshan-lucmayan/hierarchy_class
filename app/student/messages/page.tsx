import { Suspense } from "react";
import { MessengerView } from "@/components/chat/MessengerView";

export default function StudentMessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessengerView />
    </Suspense>
  );
}
