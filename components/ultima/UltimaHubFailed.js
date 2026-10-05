"use client";

import { useRouter } from "next/navigation";
import UltimaStaffMessage from "./UltimaStaffMessage";

/** Names the Hub sections whose read failed, with a retry. */
export default function UltimaHubFailed({ sections = [] }) {
  const router = useRouter();
  return (
    <UltimaStaffMessage
      subject={`${sections.join(", ")} did not load`}
      body="Those parts may look empty. They are not. Try again."
      actionLabel="Retry"
      onAction={() => router.refresh()}
    />
  );
}
