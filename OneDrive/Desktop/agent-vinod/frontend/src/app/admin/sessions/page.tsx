import { Suspense } from "react";

import AdminSessionsClient from "./sessions-client";

export default function AdminSessionsPage({
  searchParams,
}: {
  searchParams?: { workspaceId?: string; session?: string };
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)] p-10 text-[var(--text-secondary)]">Loading sessions...</div>}>
      <AdminSessionsClient
        initialWorkspaceId={searchParams?.workspaceId}
        initialSessionId={searchParams?.session}
      />
    </Suspense>
  );
}
