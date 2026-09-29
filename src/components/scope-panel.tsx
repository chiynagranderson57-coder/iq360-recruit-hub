import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ScopePanelProps {
  title: string;
  description?: string;
  items: string[];
  footer?: ReactNode;
}

/**
 * Foundation-stage surface: states what the capability will do and the rules it
 * must honor. Replaced feature-by-feature once the canonical backend is bound.
 */
export function ScopePanel({ title, description, items, footer }: ScopePanelProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant="secondary">Foundation</Badge>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {footer}
      </CardContent>
    </Card>
  );
}

export function GuardrailNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
