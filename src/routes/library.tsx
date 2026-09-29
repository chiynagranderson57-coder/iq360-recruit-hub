import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Resource & Pathway Library — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Versioned recruiting education: pathways, timelines, and reference material with sources.",
      },
      { property: "og:title", content: "Resource & Pathway Library — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Recruiting pathways, timelines, and reference material with attribution.",
      },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  return (
    <AppShell
      eyebrow="Capability 09"
      title="Resource & pathway library"
      description="The shared knowledge base that grounds the plan, the readiness snapshot, and AskNavaria360."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Library structure"
          items={[
            "Pathways organized by sport, level, and stage of the recruiting timeline.",
            "Each article is versioned with an author, source, and last-reviewed date.",
            "Content is readable without exposing any athlete data.",
            "Plan actions and assistant answers link back to the exact article version used.",
          ]}
        />
        <ScopePanel
          title="Editorial rules"
          items={[
            "Guidance is educational and never presented as a guarantee of results.",
            "Rules that vary by association or state are labeled with their jurisdiction.",
            "Outdated articles are retired or flagged, never left silently in place.",
          ]}
          footer={
            <GuardrailNote>
              Library content is general education. Athletes should confirm association and school
              rules with the official source or BFM staff.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}
