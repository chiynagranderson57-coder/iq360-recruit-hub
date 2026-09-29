import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";
import { AI_UNCERTAINTY_DISCLOSURE } from "@/lib/authorization";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "AskNavaria360 — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Guided recruiting guidance that cites its basis, discloses uncertainty, and hands off to humans.",
      },
      { property: "og:title", content: "AskNavaria360 — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Ask recruiting questions and get sourced guidance with uncertainty disclosed.",
      },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  return (
    <AppShell
      eyebrow="Capability 08"
      title="AskNavaria360"
      description="A guided assistant for recruiting questions, grounded in the resource library and the athlete's authorized record."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="How answers are produced"
          items={[
            "Answers are grounded in the versioned resource library and curated catalog.",
            "Athlete context is used only after a server-side authorization check passes.",
            "Every answer states what it is based on and how confident it is.",
            "Low-confidence or out-of-scope questions route to a human help request.",
          ]}
        />
        <ScopePanel
          title="Prohibited outputs"
          items={[
            "No predictions about offers, scholarships, or coach interest.",
            "No invented statistics, rankings, contacts, or program requirements.",
            "No eligibility, legal, medical, or financial determinations.",
            "No information about any athlete other than the one in scope.",
          ]}
          footer={<GuardrailNote>{AI_UNCERTAINTY_DISCLOSURE}</GuardrailNote>}
        />
      </div>
    </AppShell>
  );
}
