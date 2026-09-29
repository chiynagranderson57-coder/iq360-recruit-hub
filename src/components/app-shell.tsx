import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NAV_CAPABILITIES } from "@/lib/capabilities";
import { Badge } from "@/components/ui/badge";

interface AppShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function AppShell({ eyebrow, title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">
              IQ
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-semibold tracking-wide">
                Sports Recruit IQ360&trade;
              </span>
              <span className="text-xs text-muted-foreground">Athlete intelligence platform</span>
            </span>
          </Link>

          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {NAV_CAPABILITIES.map((capability) => (
              <Link
                key={capability.path}
                to={capability.path}
                className="shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                {shortLabel(capability.name)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="max-w-3xl">
          {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p>
            Canonical Sports Recruit IQ360 application. Operated by BFM. Separate from any marketing
            site.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Deny-by-default access</Badge>
            <Badge variant="outline">Consent aware</Badge>
            <Badge variant="outline">No recruiting guarantees</Badge>
          </div>
        </div>
      </footer>
    </div>
  );
}

function shortLabel(name: string) {
  const base = name.split(" & ")[0] ?? name;
  return base.replace("Resource", "Library").replace("My Plan", "Plan");
}

