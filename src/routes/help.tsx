import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Human Help Request — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Request help from BFM operations staff with a clear, auditable record of the request.",
      },
      { property: "og:title", content: "Human Help Request — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Escalate to BFM operations staff with an auditable request trail.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <AppShell
      eyebrow="Capability 10"
      title="Human help request"
      description="When the platform cannot answer, an athlete or authorized guardian reaches a real person at BFM."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Request flow"
          items={[
            "Athlete or consented guardian submits a request with topic and context.",
            "The request captures which surface it came from, without attaching private documents by default.",
            "Status is visible to the requester: received, in progress, resolved.",
            "Assignment to ops staff grants scoped access to that athlete only, for that request.",
          ]}
        />
        <ScopePanel
          title="Accountability"
          items={[
            "Creation, assignment, access, and resolution each emit audit events.",
            "Staff replies are recorded in the request thread, not in side channels.",
            "Access granted for a request is time-bound and revocable.",
          ]}
          footer={
            <GuardrailNote>
              BFM staff provide guidance and support. They do not represent colleges and cannot
              promise recruiting outcomes.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}
