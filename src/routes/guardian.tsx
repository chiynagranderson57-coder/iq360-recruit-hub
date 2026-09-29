import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/guardian")({
  head: () => ({
    meta: [
      { title: "Guardian & Consent — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Guardian linkage, consent scope, and immediate revocation for minor athlete accounts.",
      },
      { property: "og:title", content: "Guardian & Consent — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Manage guardian linkage, delegated scope, and consent revocation.",
      },
    ],
  }),
  component: GuardianPage,
});

function GuardianPage() {
  return (
    <AppShell
      eyebrow="Capability 03"
      title="Guardian & consent"
      description="Guardian access exists only while an explicit consent grant is active, and it ends the moment consent is revoked."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Consent lifecycle"
          items={[
            "Invite and verify a guardian, then link them to exactly one athlete per grant.",
            "Grant records the scope: which sections may be read, edited, or submitted.",
            "Revocation takes effect immediately on the next server-side authorization check.",
            "Expiring grants are re-confirmed rather than silently extended.",
            "Grant, change, and revoke events are all written to the audit log.",
          ]}
        />
        <ScopePanel
          title="Minor boundaries"
          items={[
            "Minor athlete accounts cannot proceed past intake without an active grant.",
            "Guardians never gain visibility into other athletes, even within the same family invite flow.",
            "Sensitive documents remain in private storage; guardians receive signed, expiring links.",
            "Ops staff can see that consent exists, not the guardian's private contact details beyond what support requires.",
          ]}
          footer={
            <GuardrailNote>
              Consent is recorded as a first-class object with its own history. No implied or
              carried-over consent is ever assumed.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}
