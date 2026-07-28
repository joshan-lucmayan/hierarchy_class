import { Suspense } from "react";
import { MessengerView } from "@/components/chat/MessengerView";

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessengerView role="admin" />
    </Suspense>
  );
}
